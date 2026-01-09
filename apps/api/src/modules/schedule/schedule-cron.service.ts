import { Injectable, Logger, OnModuleInit, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationService } from '../notification/notification.service';
import { generateLimitExceededEmail } from './schedule-email-templates';
import { SchedulePriorityService } from './schedule-priority.service';
import { ScheduleService } from './schedule.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QUEUE_SCHEDULE_EXECUTION,
  SCHEDULE_JOB_OPTIONS,
  ScheduleAnalyticsEvents,
  SchedulePeriodType,
  ScheduleFailureReason,
  getScheduleQuota,
  getScheduleConfig,
  type ScheduleConfig,
} from './schedule.constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronExpressionParser } from 'cron-parser';
import { genScheduleRecordId } from '@refly/utils';
import { logEvent } from '@refly/telemetry-node';

/**
 * Extract schedule type from scheduleConfig JSON
 * @param scheduleConfig - JSON string like { type: 'daily|weekly|monthly', ... }
 * @returns Schedule period type
 */
function getScheduleType(scheduleConfig: string | null | undefined): string {
  if (!scheduleConfig) {
    return SchedulePeriodType.CUSTOM;
  }
  try {
    const config = JSON.parse(scheduleConfig);
    if (config.type && ['daily', 'weekly', 'monthly'].includes(config.type)) {
      return config.type;
    }
    return SchedulePeriodType.CUSTOM;
  } catch {
    return SchedulePeriodType.CUSTOM;
  }
}

@Injectable()
export class ScheduleCronService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleCronService.name);
  private readonly scheduleConfig: ScheduleConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly priorityService: SchedulePriorityService,
    @Inject(forwardRef(() => ScheduleService))
    private readonly scheduleService: ScheduleService,
    @InjectQueue(QUEUE_SCHEDULE_EXECUTION) private readonly scheduleQueue: Queue,
    private readonly notificationService: NotificationService,
    private readonly config: ConfigService,
  ) {
    this.scheduleConfig = getScheduleConfig(config);
  }

  onModuleInit() {
    this.logger.log('ScheduleCronService initialized');
  }

  // Run every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async scanAndTriggerSchedules() {
    const lockKey = 'lock:schedule:scan';
    // Lock for 2 minutes to handle large batches of due schedules
    const releaseLock = await this.redisService.acquireLock(lockKey, 120);

    if (!releaseLock) {
      this.logger.debug('Schedule scan lock not acquired, skipping');
      return;
    }

    try {
      await this.processDueSchedules();
    } catch (error) {
      this.logger.error('Error processing due schedules', error);
    } finally {
      await releaseLock();
    }
  }

  private async processDueSchedules() {
    const now = new Date();

    // 1. Find due schedules
    // We fetch a batch to avoid memory issues, though usually not too many per minute
    const schedules = await this.prisma.workflowSchedule.findMany({
      where: {
        isEnabled: true,
        deletedAt: null,
        nextRunAt: { lte: now },
      },
      orderBy: { nextRunAt: 'asc' },
    });

    if (schedules.length === 0) {
      return;
    }

    this.logger.log(`Found ${schedules.length} due schedules`);

    for (const schedule of schedules) {
      try {
        await this.triggerSchedule(schedule);
      } catch (error) {
        this.logger.error(`Failed to trigger schedule ${schedule.scheduleId}`, error);
      }
    }
  }

  /**
   * Check and trigger a specific schedule if it's due
   * This is used to immediately check schedules that were just created/updated
   * with a near-future nextRunAt to avoid missing the first execution
   * @param scheduleId - Schedule ID to check
   * @returns true if schedule was triggered, false otherwise
   */
  async checkAndTriggerSchedule(scheduleId: string): Promise<boolean> {
    const now = new Date();

    // Find the specific schedule
    const schedule = await this.prisma.workflowSchedule.findFirst({
      where: {
        scheduleId,
        isEnabled: true,
        deletedAt: null,
        nextRunAt: { lte: now },
      },
    });

    if (!schedule) {
      return false;
    }

    try {
      await this.triggerSchedule(schedule);
      this.logger.log(`Immediately triggered schedule ${scheduleId} after creation/update`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to immediately trigger schedule ${scheduleId}`, error);
      return false;
    }
  }

  private async triggerSchedule(schedule: any) {
    // Re-check schedule status from database in case it was disabled by another schedule's
    // quota check in the same batch (the in-memory schedule object may be stale)
    const freshSchedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId: schedule.scheduleId },
      select: { isEnabled: true, deletedAt: true, nextRunAt: true },
    });

    if (!freshSchedule || !freshSchedule.isEnabled || freshSchedule.deletedAt) {
      this.logger.debug(
        `Schedule ${schedule.scheduleId} was disabled/deleted during batch processing, skipping`,
      );
      return;
    }

    // Race condition guard: Check if schedule was already processed by another instance/request
    // If nextRunAt is in the future, it means another process already triggered it and updated the time
    if (freshSchedule.nextRunAt && freshSchedule.nextRunAt > new Date()) {
      this.logger.debug(
        `Schedule ${schedule.scheduleId} was passed to trigger but nextRunAt is in future (${freshSchedule.nextRunAt.toISOString()}). Skipping to prevent double execution.`,
      );
      return;
    }

    // 3.1 Calculate next run time
    let nextRunAt: Date | null = null;
    try {
      const interval = CronExpressionParser.parse(schedule.cronExpression, {
        currentDate: new Date(), // Calculate from now, or from last run? usually from now or schedule.nextRunAt
        tz: schedule.timezone || 'Asia/Shanghai',
      });
      nextRunAt = interval.next().toDate();
    } catch (e) {
      this.logger.error(`Invalid cron for schedule ${schedule.scheduleId}`, e);
      // Auto-disable invalid schedule to prevent repeated failures
      const disabledReason = `Invalid cron expression: ${e instanceof Error ? e.message : String(e)}`;
      // Parse existing config if it's a JSON string, merge with disabled info
      let existingConfig = {};
      try {
        existingConfig = schedule.scheduleConfig
          ? JSON.parse(schedule.scheduleConfig as string)
          : {};
      } catch {
        // If parsing fails, start fresh
      }
      await this.prisma.workflowSchedule.update({
        where: { scheduleId: schedule.scheduleId },
        data: {
          isEnabled: false,
          nextRunAt: null,
          // Store the reason in scheduleConfig for transparency
          scheduleConfig: JSON.stringify({
            ...existingConfig,
            _disabledReason: disabledReason,
            _disabledAt: new Date().toISOString(),
          }),
        },
      });
      this.logger.warn(
        `Auto-disabled schedule ${schedule.scheduleId} due to invalid cron expression`,
      );
      return;
    }

    // 3.1.5 Check Schedule Limit and Concurrency
    const userSubscription = await this.prisma.subscription.findFirst({
      where: { uid: schedule.uid, status: 'active' },
    });
    const limit = getScheduleQuota(userSubscription?.lookupKey, this.scheduleConfig);

    const activeSchedulesCount = await this.prisma.workflowSchedule.count({
      where: { uid: schedule.uid, isEnabled: true, deletedAt: null },
    });

    // If user exceeds quota, disable other schedules and send email
    if (activeSchedulesCount > limit) {
      this.logger.warn(
        `User ${schedule.uid} has ${activeSchedulesCount} active schedules, exceeding limit of ${limit}`,
      );

      // Get all active schedules except the current one, ordered by creation time (oldest first)
      const otherSchedules = await this.prisma.workflowSchedule.findMany({
        where: {
          uid: schedule.uid,
          isEnabled: true,
          deletedAt: null,
          scheduleId: { not: schedule.scheduleId },
        },
        orderBy: { createdAt: 'desc' }, // Disable newest schedules first
        select: { scheduleId: true, name: true },
      });

      // Calculate how many schedules need to be disabled
      const schedulesToDisableCount = activeSchedulesCount - limit;
      const schedulesToDisable = otherSchedules.slice(0, schedulesToDisableCount);

      // Disable excess schedules
      if (schedulesToDisable.length > 0) {
        const scheduleIdsToDisable = schedulesToDisable.map((s) => s.scheduleId);

        await this.prisma.workflowSchedule.updateMany({
          where: {
            scheduleId: { in: scheduleIdsToDisable },
          },
          data: {
            isEnabled: false,
            nextRunAt: null,
          },
        });

        // Update all WorkflowScheduleRecord for disabled schedules to failed status
        const now = new Date();
        const { count } = await this.prisma.workflowScheduleRecord.updateMany({
          where: {
            scheduleId: { in: scheduleIdsToDisable },
            status: { in: ['pending', 'scheduled', 'processing'] }, // Only update records that haven't completed
          },
          data: {
            status: 'failed',
            failureReason: ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED,
            errorDetails: JSON.stringify({
              reason: 'Schedule was disabled due to quota exceeded',
              disabledAt: now.toISOString(),
            }),
            completedAt: now,
          },
        });

        // Remove pending jobs from BullMQ queue to prevent duplicate failures
        // This ensures jobs don't run and overwrite the SCHEDULE_LIMIT_EXCEEDED status with SCHEDULE_DISABLED
        try {
          const waitingJobs = await this.scheduleQueue.getJobs(['waiting', 'delayed']);
          let removedJobsCount = 0;
          for (const job of waitingJobs) {
            if (job.data?.scheduleId && scheduleIdsToDisable.includes(job.data.scheduleId)) {
              await job.remove();
              removedJobsCount++;
              this.logger.debug(
                `Removed job ${job.id} for disabled schedule ${job.data.scheduleId}`,
              );
            }
          }
          if (removedJobsCount > 0) {
            this.logger.log(`Removed ${removedJobsCount} pending jobs for disabled schedules`);
          }
        } catch (queueError) {
          // Queue operation failure is not critical, jobs will be skipped by processor anyway
          this.logger.warn('Failed to remove pending jobs for disabled schedules', queueError);
        }

        this.logger.log(
          `Auto-disabled ${schedulesToDisable.length} schedules for user ${schedule.uid} due to quota exceeded, updated ${count} schedule records to failed`,
        );
      }

      // Send email notification
      const user = await this.prisma.user.findUnique({ where: { uid: schedule.uid } });
      if (user?.email) {
        const { subject, html } = generateLimitExceededEmail({
          userName: user.nickname || 'User',
          scheduleName: schedulesToDisable.map((s) => s.name).join(', ') || 'Untitled Schedule',
          limit,
          currentCount: activeSchedulesCount,
          schedulesLink: `${this.config.get<string>('origin')}/workflow-list`,
        });

        await this.notificationService.sendEmail(
          {
            to: user.email,
            subject,
            html,
          },
          user,
        );
      }
    }

    // 3.2 Update schedule with next run time (Optimistic locking via updateMany not strictly needed if we process sequentially or have row lock, but safe enough here)
    // We update first to avoid double triggering if this takes long
    // 3.2 Update schedule with next run time using Optimistic Locking
    // preventing double execution if multiple pods race here
    const updateResult = await this.prisma.workflowSchedule.updateMany({
      where: {
        scheduleId: schedule.scheduleId,
        nextRunAt: freshSchedule.nextRunAt, // Optimistic lock version check
      },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });

    if (updateResult.count === 0) {
      this.logger.debug(
        `Schedule ${schedule.scheduleId} was updated by another process during execution preparation. Skipping to prevent double trigger.`,
      );
      return;
    }

    // 3.3 Find or create the WorkflowScheduleRecord for this execution
    // First, check if there's a 'scheduled' record that should be converted
    const scheduleRecord = await this.prisma.workflowScheduleRecord.findFirst({
      where: {
        scheduleId: schedule.scheduleId,
        status: 'scheduled',
        workflowExecutionId: null,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    let currentRecordId = scheduleRecord?.scheduleRecordId;

    if (scheduleRecord) {
      // Update existing scheduled record to 'pending' (queued in BullMQ)
      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId: scheduleRecord.scheduleRecordId },
        data: {
          status: 'pending', // Job is now in the BullMQ queue, waiting to be processed
          triggeredAt: new Date(),
        },
      });
    } else {
      // No existing record - create a new 'pending' record now
      // This ensures frontend can always see the job is queued
      currentRecordId = genScheduleRecordId();
      const canvas = await this.prisma.canvas.findUnique({
        where: { canvasId: schedule.canvasId },
        select: { title: true },
      });
      await this.prisma.workflowScheduleRecord.create({
        data: {
          scheduleRecordId: currentRecordId,
          scheduleId: schedule.scheduleId,
          uid: schedule.uid,
          sourceCanvasId: schedule.canvasId, // Source canvas (template)
          canvasId: '', // Will be updated after execution with actual execution canvas
          workflowTitle: canvas?.title || 'Untitled',
          scheduledAt: schedule.nextRunAt,
          status: 'pending', // Job is queued in BullMQ
          triggeredAt: new Date(),
          priority: 5, // Default, will be updated by processor
        },
      });
      this.logger.log(
        `Created pending record ${currentRecordId} for schedule ${schedule.scheduleId}`,
      );
    }

    // 3.4 Create or update scheduled record for the NEXT execution (future)
    if (nextRunAt) {
      await this.scheduleService.createOrUpdateScheduledRecord(
        schedule.uid,
        schedule.scheduleId,
        schedule.canvasId,
        nextRunAt,
      );
    }

    // 3.5 Calculate user execution priority
    // Priority range: 1-10 (lower number = higher priority, matching BullMQ convention)
    const priority = await this.priorityService.calculateExecutionPriority(schedule.uid);

    // 3.6 Push to execution queue with priority
    // The job will stay in 'wait' state in BullMQ until a worker picks it up
    // During this time, the ScheduleRecord status is 'pending' (visible to frontend)
    const timestamp = Date.now();
    await this.scheduleQueue.add(
      'execute-scheduled-workflow',
      {
        scheduleId: schedule.scheduleId,
        canvasId: schedule.canvasId,
        uid: schedule.uid,
        scheduledAt: schedule.nextRunAt!.toISOString(),
        priority,
        scheduleRecordId: currentRecordId,
      },
      {
        jobId: `schedule:${schedule.scheduleId}:${timestamp}`,
        priority,
        ...SCHEDULE_JOB_OPTIONS,
      },
    );

    this.logger.log(`Triggered schedule ${schedule.scheduleId} with priority ${priority}`);

    // Get user information once for telemetry (avoid duplicate query)
    const user = await this.prisma.user.findUnique({
      where: { uid: schedule.uid },
      select: { uid: true, email: true },
    });

    // Track analytics event for schedule trigger
    await this.trackScheduleEvent(
      ScheduleAnalyticsEvents.SCHEDULE_RUN_TRIGGERED,
      schedule.uid,
      {
        type: getScheduleType(schedule.scheduleConfig),
      },
      user,
    );
  }

  /**
   * Track analytics event using telemetry service
   * @param eventName - Event name from ScheduleAnalyticsEvents
   * @param uid - User ID
   * @param metadata - Event metadata
   * @param user - Optional user object to avoid duplicate query
   */
  private async trackScheduleEvent(
    eventName: string,
    uid: string,
    metadata?: Record<string, any>,
    user?: { uid: string; email?: string | null },
  ): Promise<void> {
    try {
      // Use provided user or query if not provided
      let userForEvent = user;
      if (!userForEvent) {
        userForEvent = await this.prisma.user.findUnique({
          where: { uid },
          select: { uid: true, email: true },
        });
      }

      if (userForEvent) {
        logEvent(userForEvent, eventName, null, metadata);
        this.logger.debug(`Analytics event: ${eventName}`, { uid, ...metadata });
      } else {
        this.logger.warn(`User not found for analytics event ${eventName}, uid: ${uid}`);
      }
    } catch (error) {
      // Don't fail the schedule trigger if analytics fails
      this.logger.error(`Failed to track analytics event ${eventName}:`, error);
    }
  }
}
