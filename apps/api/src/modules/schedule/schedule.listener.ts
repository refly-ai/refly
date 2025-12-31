import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowCompletedEvent, WorkflowFailedEvent } from '../workflow/workflow.events';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationService } from '../notification/notification.service';
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

@Injectable()
export class ScheduleEventListener {
  private readonly logger = new Logger(ScheduleEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent('workflow.completed')
  async handleWorkflowCompleted(event: WorkflowCompletedEvent) {
    if (!event.scheduleId) return;

    let record: any = null;
    let counterDecremented = false; // Track if counter was already decremented

    try {
      this.logger.log(
        `Processing workflow.completed event for schedule record ${event.scheduleId}`,
      );

      // 1. First query record to get uid for Redis counter
      record = await this.prisma.workflowScheduleRecord.findUnique({
        where: { scheduleRecordId: event.scheduleId },
        select: { uid: true },
      });

      if (!record) {
        this.logger.warn(`Record ${event.scheduleId} not found for workflow.completed event`);
        return;
      }

      // 2. Decrement Redis counter first (release slot immediately)
      try {
        const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${record.uid}`;
        await this.redisService.decr(redisKey);
        counterDecremented = true;
        this.logger.debug(`Decremented Redis counter for user ${record.uid}`);
      } catch (redisError) {
        // Redis failure is not critical, just log
        this.logger.warn(`Failed to decrement Redis counter for user ${record.uid}`, redisError);
      }

      // 3. Update database status
      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId: event.scheduleId },
        data: {
          status: 'success',
          completedAt: new Date(),
        },
      });

      // 4. Send notification email (non-critical, won't affect counter)
      await this.sendEmail(event, 'success');
    } catch (error: any) {
      this.logger.error(`Failed to process workflow.completed event: ${error.message}`);

      // Only decrement if not already done (avoid double decrement)
      if (record?.uid && !counterDecremented) {
        try {
          const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${record.uid}`;
          await this.redisService.decr(redisKey);
          this.logger.debug(`Decremented Redis counter for user ${record.uid} in error handler`);
        } catch (redisError) {
          this.logger.warn(
            `Failed to decrement Redis counter in error handler for user ${record.uid}`,
            redisError,
          );
        }
      }
    }
  }

  @OnEvent('workflow.failed')
  async handleWorkflowFailed(event: WorkflowFailedEvent) {
    if (!event.scheduleId) return;

    let record: any = null;
    let counterDecremented = false; // Track if counter was already decremented

    try {
      this.logger.log(`Processing workflow.failed event for schedule record ${event.scheduleId}`);

      // 1. First query record to get uid for Redis counter
      record = await this.prisma.workflowScheduleRecord.findUnique({
        where: { scheduleRecordId: event.scheduleId },
        select: { uid: true },
      });

      if (!record) {
        this.logger.warn(`Record ${event.scheduleId} not found for workflow.failed event`);
        return;
      }

      // 2. Decrement Redis counter first (release slot immediately)
      try {
        const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${record.uid}`;
        await this.redisService.decr(redisKey);
        counterDecremented = true;
        this.logger.debug(`Decremented Redis counter for user ${record.uid}`);
      } catch (redisError) {
        // Redis failure is not critical, just log
        this.logger.warn(`Failed to decrement Redis counter for user ${record.uid}`, redisError);
      }

      // 3. Classify error and get failure reason
      const errorDetails = event.error;
      let failureReason: string = ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED;
      if (errorDetails?.errorMessage) {
        failureReason = classifyScheduleError(errorDetails.errorMessage);
      }

      // 4. Update database status
      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId: event.scheduleId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          failureReason,
          errorDetails: JSON.stringify(errorDetails),
        },
      });

      // 5. Send notification email (non-critical, won't affect counter)
      await this.sendEmail(event, 'failed');
    } catch (error: any) {
      this.logger.error(`Failed to process workflow.failed event: ${error.message}`);

      // Only decrement if not already done (avoid double decrement)
      if (record?.uid && !counterDecremented) {
        try {
          const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${record.uid}`;
          await this.redisService.decr(redisKey);
          this.logger.debug(`Decremented Redis counter for user ${record.uid} in error handler`);
        } catch (redisError) {
          this.logger.warn(
            `Failed to decrement Redis counter in error handler for user ${record.uid}`,
            redisError,
          );
        }
      }
    }
  }

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
      // Fallback to schedule name or Generic
      const scheduleName = scheduleRecord?.workflowTitle || 'Scheduled Workflow';

      let nextRunTime = 'Check Dashboard';
      if (scheduleRecord?.scheduleId) {
        const schedule = await this.prisma.workflowSchedule.findUnique({
          where: { scheduleId: scheduleRecord.scheduleId },
        });

        if (schedule?.cronExpression) {
          try {
            const interval = CronExpressionParser.parse(schedule.cronExpression, {
              tz: schedule.timezone || 'Asia/Shanghai',
            });
            nextRunTime = interval.next().toDate().toLocaleString();
          } catch (err) {
            this.logger.warn(
              `Failed to calculate next run time for schedule ${schedule.scheduleId}: ${err.message}`,
            );
          }
        }
      }

      if (status === 'success') {
        // Get the execution canvas ID for the run-history link
        const scheduleRecordId = scheduleRecord?.scheduleRecordId || '';
        const origin = this.config.get<string>('origin');

        const { subject, html } = generateScheduleSuccessEmail({
          userName: fullUser.nickname || 'User',
          scheduleName: scheduleName,
          runTime: new Date().toLocaleString(),
          nextRunTime: nextRunTime,
          schedulesLink: `${origin}/run-history/${scheduleRecordId}`,
          runDetailsLink: `${origin}/run-history/${scheduleRecordId}`,
        });
        await this.notificationService.sendEmail(
          {
            to: fullUser.email,
            subject,
            html,
          },
          fullUser,
        );
      } else {
        // Get the execution canvas ID for the run-history link
        const scheduleRecordId = scheduleRecord?.scheduleRecordId || '';
        const origin = this.config.get<string>('origin');

        const { subject, html } = generateScheduleFailedEmail({
          userName: fullUser.nickname || 'User',
          scheduleName: scheduleName,
          runTime: new Date().toLocaleString(),
          nextRunTime: nextRunTime,
          schedulesLink: `${origin}/run-history/${scheduleRecordId}`,
          runDetailsLink: `${origin}/run-history/${scheduleRecordId}`,
        });
        await this.notificationService.sendEmail(
          {
            to: fullUser.email,
            subject,
            html,
          },
          fullUser,
        );
      }
    } catch (error: any) {
      // Log email sending failure but don't throw - email is non-critical
      this.logger.error(
        `Failed to send ${status} email for schedule record ${event.scheduleId}: ${error?.message}`,
      );
    }
  }
}
