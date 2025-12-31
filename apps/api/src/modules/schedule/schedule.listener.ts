import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowCompletedEvent, WorkflowFailedEvent } from '../workflow/workflow.events';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationService } from '../notification/notification.service';
import { CreditService } from '../credit/credit.service';
import {
  generateScheduleSuccessEmail,
  generateScheduleFailedEmail,
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

    try {
      this.logger.log(`Processing ${eventType} event for schedule record ${event.scheduleId}`);

      // 1. Get schedule record
      record = await this.getScheduleRecord(event.scheduleId!);
      if (!record) {
        this.logger.warn(`Record ${event.scheduleId} not found for ${eventType} event`);
        return;
      }

      // 2. Decrement Redis counter
      counterDecremented = await this.decrementRedisCounter(record.uid);

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

      // 6. Send notification email
      await this.sendEmail(event, status);
    } catch (error: any) {
      this.logger.error(`Failed to process ${eventType} event: ${error.message}`);

      // Ensure Redis counter is decremented in error case
      if (record?.uid && !counterDecremented) {
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
      const nextRunTime = await this.calculateNextRunTime(scheduleRecord?.scheduleId);

      const scheduleRecordId = scheduleRecord?.scheduleRecordId || '';
      const origin = this.config.get<string>('origin');
      const runDetailsLink = `${origin}/run-history/${scheduleRecordId}`;

      const emailData = {
        userName: fullUser.nickname || 'User',
        scheduleName,
        runTime: new Date().toLocaleString(),
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
   */
  private async calculateNextRunTime(scheduleId: string | undefined): Promise<string> {
    if (!scheduleId) {
      return 'Check Dashboard';
    }

    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId },
    });

    if (!schedule?.cronExpression) {
      return 'Check Dashboard';
    }

    try {
      const interval = CronExpressionParser.parse(schedule.cronExpression, {
        tz: schedule.timezone || 'Asia/Shanghai',
      });
      return interval.next().toDate().toLocaleString();
    } catch (err: any) {
      this.logger.warn(
        `Failed to calculate next run time for schedule ${scheduleId}: ${err?.message}`,
      );
      return 'Check Dashboard';
    }
  }
}
