import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowCompletedEvent, WorkflowFailedEvent } from '../workflow/workflow.events';
import { CanvasDeletedEvent } from '../canvas/canvas.events';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationService } from '../notification/notification.service';
import { CreditService } from '../credit/credit.service';
import {
  generateScheduleSuccessEmail,
  generateScheduleFailedEmail,
  formatDateTime,
} from './schedule-email-templates';
import {
  classifyScheduleError,
  ScheduleFailureReason,
  SCHEDULE_REDIS_KEYS,
} from './schedule.constants';
import { CronExpressionParser } from 'cron-parser';
import type { User } from '@refly/openapi-schema';

@Injectable()
export class ScheduleEventListener {
  private readonly logger = new Logger(ScheduleEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    private readonly creditService: CreditService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent('workflow.completed')
  async handleWorkflowCompleted(event: WorkflowCompletedEvent) {
    if (!event.scheduleId) return;

    await this.handleWorkflowEvent(event, 'success');
  }

  @OnEvent('workflow.failed')
  async handleWorkflowFailed(event: WorkflowFailedEvent) {
    if (!event.scheduleId) return;

    await this.handleWorkflowEvent(event, 'failed');
  }

  /**
   * Common handler for both workflow.completed and workflow.failed events
   */
  private async handleWorkflowEvent(
    event: WorkflowCompletedEvent | WorkflowFailedEvent,
    status: 'success' | 'failed',
  ) {
    const eventType = status === 'success' ? 'workflow.completed' : 'workflow.failed';
    let record: { uid: string } | null = null;
    let counterDecremented = false;
    const isScheduledTrigger = event.triggerType === 'scheduled';

    try {
      this.logger.log(`Processing ${eventType} event for schedule record ${event.scheduleId}`);

      // 1. Get schedule record
      record = await this.getScheduleRecord(event.scheduleId!);
      if (!record) {
        this.logger.warn(`Record ${event.scheduleId} not found for ${eventType} event`);
        return;
      }

      // 2. Decrement Redis counter (only for scheduled runs)
      if (isScheduledTrigger) {
        counterDecremented = await this.decrementRedisCounter(record.uid);
      }

      // 3. Calculate credit usage
      const creditUsed = await this.calculateCreditUsage(record.uid, event.executionId);

      // 4. Prepare update data based on status
      const updateData: any = {
        status: status === 'success' ? 'success' : 'failed',
        completedAt: new Date(),
        creditUsed,
      };

      if (status === 'failed' && 'error' in event) {
        const errorDetails = event.error;
        const failureReason = errorDetails?.errorMessage
          ? classifyScheduleError(errorDetails.errorMessage)
          : ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED;
        updateData.failureReason = failureReason;
        updateData.errorDetails = JSON.stringify(errorDetails);
      }

      // 5. Update database
      await this.updateScheduleRecord(event.scheduleId!, updateData);

      // 6. Send notification email (only for scheduled runs)
      if (isScheduledTrigger) {
        await this.sendEmail(event, status);
      }
    } catch (error: any) {
      this.logger.error(`Failed to process ${eventType} event: ${error.message}`);

      // Ensure Redis counter is decremented in error case
      if (isScheduledTrigger && record?.uid && !counterDecremented) {
        await this.decrementRedisCounter(record.uid, true);
      }
    }
  }

  /**
   * Get schedule record by scheduleRecordId
   */
  private async getScheduleRecord(scheduleRecordId: string): Promise<{ uid: string } | null> {
    return await this.prisma.workflowScheduleRecord.findUnique({
      where: { scheduleRecordId },
      select: { uid: true },
    });
  }

  /**
   * Decrement Redis counter for user concurrency tracking
   * @param uid User ID
   * @param isErrorHandler Whether this is called from error handler
   * @returns true if decrement succeeded, false otherwise
   */
  private async decrementRedisCounter(uid: string, isErrorHandler = false): Promise<boolean> {
    try {
      const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${uid}`;
      await this.redisService.decr(redisKey);
      const context = isErrorHandler ? 'in error handler' : '';
      this.logger.debug(`Decremented Redis counter for user ${uid} ${context}`);
      return true;
    } catch (redisError) {
      const context = isErrorHandler ? 'in error handler' : '';
      this.logger.warn(`Failed to decrement Redis counter for user ${uid} ${context}`, redisError);
      return false;
    }
  }

  /**
   * Calculate credit usage for execution (actual usage without markup)
   */
  private async calculateCreditUsage(uid: string, executionId: string): Promise<number> {
    try {
      const user: User = { uid } as User;
      return await this.creditService.countExecutionCreditUsageByExecutionId(user, executionId);
    } catch (creditErr: any) {
      this.logger.warn(
        `Failed to calculate credit usage for execution ${executionId}: ${creditErr?.message}`,
      );
      return 0;
    }
  }

  /**
   * Update schedule record in database
   */
  private async updateScheduleRecord(
    scheduleRecordId: string,
    data: {
      status: string;
      completedAt: Date;
      creditUsed: number;
      failureReason?: string;
      errorDetails?: string;
    },
  ): Promise<void> {
    await this.prisma.workflowScheduleRecord.update({
      where: { scheduleRecordId },
      data,
    });
  }

  /**
   * Send notification email for schedule execution result
   */
  private async sendEmail(
    event: WorkflowCompletedEvent | WorkflowFailedEvent,
    status: 'success' | 'failed',
  ) {
    try {
      const fullUser = await this.prisma.user.findUnique({ where: { uid: event.userId } });
      if (!fullUser) {
        this.logger.warn(
          `Cannot send ${status} email: user ${event.userId} not found for schedule record ${event.scheduleId}`,
        );
        return;
      }
      if (!fullUser.email) {
        this.logger.warn(
          `Cannot send ${status} email: user ${event.userId} has no email address for schedule record ${event.scheduleId}`,
        );
        return;
      }

      const scheduleRecord = await this.prisma.workflowScheduleRecord.findUnique({
        where: { scheduleRecordId: event.scheduleId },
      });
      const scheduleName = scheduleRecord?.workflowTitle || 'Scheduled Workflow';
      const { nextRunTime, timezone } = await this.calculateNextRunTime(scheduleRecord?.scheduleId);

      const scheduleRecordId = scheduleRecord?.scheduleRecordId || '';
      const origin = this.config.get<string>('origin');
      const runDetailsLink = `${origin}/run-history/${scheduleRecordId}`;

      // Use scheduledAt as the run time
      const scheduledAtDate = scheduleRecord?.scheduledAt || new Date();

      const emailData = {
        userName: fullUser.nickname || 'User',
        scheduleName,
        scheduledAt: formatDateTime(scheduledAtDate, timezone),
        nextRunTime,
        schedulesLink: runDetailsLink,
        runDetailsLink,
      };

      const { subject, html } =
        status === 'success'
          ? generateScheduleSuccessEmail(emailData)
          : generateScheduleFailedEmail(emailData);

      await this.notificationService.sendEmail(
        {
          to: fullUser.email,
          subject,
          html,
        },
        fullUser,
      );
    } catch (error: any) {
      // Log email sending failure but don't throw - email is non-critical
      this.logger.error(
        `Failed to send ${status} email for schedule record ${event.scheduleId}: ${error?.message}`,
      );
    }
  }

  /**
   * Calculate next run time from schedule cron expression
   * Returns both the formatted time string and the timezone for consistent formatting
   */
  private async calculateNextRunTime(
    scheduleId: string | undefined,
  ): Promise<{ nextRunTime: string; timezone: string }> {
    const defaultTimezone = 'Asia/Shanghai';

    if (!scheduleId) {
      return { nextRunTime: 'Check Dashboard', timezone: defaultTimezone };
    }

    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId },
    });

    const timezone = schedule?.timezone || defaultTimezone;

    if (!schedule?.cronExpression) {
      return { nextRunTime: 'Check Dashboard', timezone };
    }

    try {
      const interval = CronExpressionParser.parse(schedule.cronExpression, {
        tz: timezone,
      });
      return { nextRunTime: formatDateTime(interval.next().toDate(), timezone), timezone };
    } catch (err: any) {
      this.logger.warn(
        `Failed to calculate next run time for schedule ${scheduleId}: ${err?.message}`,
      );
      return { nextRunTime: 'Check Dashboard', timezone };
    }
  }

  /**
   * Handle canvas.deleted event - release associated schedule resources
   *
   * When a canvas is deleted, we need to:
   * 1. Soft-delete and disable all associated WorkflowSchedule records
   * 2. Update pending/scheduled records to 'failed' status
   * 3. Leave processing/running records as-is (they will complete normally, but won't be rescheduled)
   *
   * Note: We don't interrupt processing/running tasks because:
   * - The workflow is already executing and interrupting might cause data inconsistency
   * - The executor (ScheduleProcessor) will detect the deleted schedule on next execution attempt
   */
  @OnEvent('canvas.deleted')
  async handleCanvasDeleted(event: CanvasDeletedEvent) {
    const { canvasId, uid } = event;
    this.logger.log(`Processing canvas.deleted event for canvas ${canvasId}`);

    try {
      // 1. Find all schedules associated with this canvas
      const associatedSchedules = await this.prisma.workflowSchedule.findMany({
        where: { canvasId, uid, deletedAt: null },
        select: { scheduleId: true },
      });

      if (associatedSchedules.length === 0) {
        this.logger.debug(`No active schedules found for canvas ${canvasId}`);
        return;
      }

      const scheduleIds = associatedSchedules.map((s) => s.scheduleId);
      this.logger.log(
        `Releasing ${scheduleIds.length} schedule(s) for deleted canvas ${canvasId}: ${scheduleIds.join(', ')}`,
      );

      // 2. Soft-delete and disable schedules
      await this.prisma.workflowSchedule.updateMany({
        where: { canvasId, uid, deletedAt: null },
        data: {
          isEnabled: false,
          deletedAt: new Date(),
          nextRunAt: null, // Clear next run time to prevent any race conditions
        },
      });

      // 3. Update pending/scheduled records to 'failed' status
      // Note: We do NOT update 'processing' or 'running' records because:
      // - They are currently executing and should complete their execution
      // - The workflow.completed/workflow.failed events will handle their final status
      // - When they try to reschedule, they will find the schedule is deleted
      const updateResult = await this.prisma.workflowScheduleRecord.updateMany({
        where: {
          scheduleId: { in: scheduleIds },
          status: { in: ['pending', 'scheduled'] },
        },
        data: {
          status: 'failed',
          failureReason: ScheduleFailureReason.CANVAS_DELETED,
          errorDetails: JSON.stringify({
            reason: 'Canvas was deleted, schedule has been released',
            deletedAt: new Date().toISOString(),
          }),
          completedAt: new Date(),
        },
      });

      // 4. Log processing/running records for visibility
      const processingCount = await this.prisma.workflowScheduleRecord.count({
        where: {
          scheduleId: { in: scheduleIds },
          status: { in: ['processing', 'running'] },
        },
      });

      if (processingCount > 0) {
        this.logger.log(
          `Canvas ${canvasId}: ${processingCount} task(s) are still processing/running, they will complete normally`,
        );
      }

      this.logger.log(
        `Successfully released schedules for canvas ${canvasId}: ${updateResult.count} pending records failed`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to release schedules for canvas ${canvasId}: ${error?.message}`);
      // Don't throw - this is a cleanup operation and shouldn't block canvas deletion
    }
  }
}
