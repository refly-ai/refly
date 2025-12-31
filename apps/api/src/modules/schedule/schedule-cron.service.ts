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
  ScheduleFailureReason,
  ScheduleAnalyticsEvents,
  SchedulePeriodType,
  getScheduleQuota,
  getScheduleConfig,
  type ScheduleConfig,
} from './schedule.constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronExpressionParser } from 'cron-parser';
import { genScheduleRecordId } from '@refly/utils';

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

  private async triggerSchedule(schedule: any) {
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

    // 3.1.5 Check Schedule Limit
    //  Fetch actual limit from subscription plan. Currently mocking Free=1, Plus=20.
    const userSubscription = await this.prisma.subscription.findFirst({
      where: { uid: schedule.uid, status: 'active' },
    });
    // Simple logic: if has active subscription -> 20, else 1
    const limit = getScheduleQuota(userSubscription?.lookupKey, this.scheduleConfig);

    const activeSchedulesCount = await this.prisma.workflowSchedule.count({
      where: { uid: schedule.uid, isEnabled: true, deletedAt: null },
    });

    if (activeSchedulesCount > limit) {
      // Check if this schedule is among the allowed set (earliest created)
      const allowedSchedules = await this.prisma.workflowSchedule.findMany({
        where: { uid: schedule.uid, isEnabled: true, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: { scheduleId: true },
      });

      const isAllowed = allowedSchedules.some((s) => s.scheduleId === schedule.scheduleId);

      if (!isAllowed) {
        this.logger.warn(
          `Schedule ${schedule.scheduleId} excluded from execution due to limit exceeded (${activeSchedulesCount}/${limit})`,
        );

        // Update record to failed if exists (or create one for history)
        const recordId = genScheduleRecordId();
        await this.prisma.workflowScheduleRecord.create({
          data: {
            scheduleRecordId: recordId,
            scheduleId: schedule.scheduleId,
            uid: schedule.uid,
            sourceCanvasId: schedule.canvasId,
            canvasId: '',
            workflowTitle: 'Schedule Limit Exceeded',
            status: 'failed',
            failureReason: ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED,
            errorDetails: JSON.stringify({
              message: `Active schedule limit exceeded (${activeSchedulesCount}/${limit}). This schedule is not among the earliest ${limit}.`,
            }),
            scheduledAt: schedule.nextRunAt ?? new Date(),
            triggeredAt: new Date(),
            completedAt: new Date(),
            priority: 0,
          },
        });

        // Send Email
        const user = await this.prisma.user.findUnique({ where: { uid: schedule.uid } });
        if (user?.email) {
          const { subject, html } = generateLimitExceededEmail({
            userName: user.nickname || 'User',
            scheduleName: schedule.name || 'Untitled Schedule',
            limit,
            currentCount: activeSchedulesCount,
            schedulesLink: `${this.config.get<string>('origin')}/workflow/${schedule.canvasId}`,
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

        return; // Skip execution
      }
    }

    // 3.2 Update schedule with next run time (Optimistic locking via updateMany not strictly needed if we process sequentially or have row lock, but safe enough here)
    // We update first to avoid double triggering if this takes long
    await this.prisma.workflowSchedule.update({
      where: { scheduleId: schedule.scheduleId },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });

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

    // Track analytics event for schedule trigger
    this.trackScheduleEvent(ScheduleAnalyticsEvents.SCHEDULE_RUN_TRIGGERED, {
      uid: schedule.uid,
      scheduleId: schedule.scheduleId,
      scheduleRecordId: currentRecordId,
      type: getScheduleType(schedule.scheduleConfig),
      priority,
    });
  }

  /**
   * Track analytics event (placeholder - integrate with actual analytics service)
   * @param eventName - Event name from ScheduleAnalyticsEvents
   * @param properties - Event properties
   */
  private trackScheduleEvent(eventName: string, properties: Record<string, any>): void {
    this.logger.debug(`Analytics event: ${eventName}`, properties);
    // TODO: Integrate with actual analytics service (e.g., Mixpanel, Amplitude)
  }
}
