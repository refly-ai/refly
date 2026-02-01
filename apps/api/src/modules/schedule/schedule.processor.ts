import { Processor, WorkerHost } from '@nestjs/bullmq';
import { DelayedError, Job } from 'bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { MiscService } from '../misc/misc.service';
import { CanvasService } from '../canvas/canvas.service';
import { WorkflowAppService } from '../workflow-app/workflow-app.service';
import { CreditService } from '../credit/credit.service';
import {
  QUEUE_SCHEDULE_EXECUTION,
  SCHEDULE_REDIS_KEYS,
  ScheduleFailureReason,
  classifyScheduleError,
  getScheduleConfig,
  type ScheduleConfig,
  DEFAULT_SCHEDULE_CONFIG,
} from './schedule.constants';
import {
  generateInsufficientCreditsEmail,
  generateScheduleFailedEmail,
  formatDateTime,
} from './schedule-email-templates';
import { NotificationService } from '../notification/notification.service';
import { ScheduleMetrics } from './schedule.metrics';
import { genScheduleRecordId, safeParseJSON } from '@refly/utils';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import type { RawCanvasData } from '@refly/openapi-schema';
import { CronExpressionParser } from 'cron-parser';

/**
 * Job data structure for schedule execution
 */
interface ScheduleExecutionJobData {
  scheduleId: string;
  canvasId: string;
  uid: string;
  scheduledAt: string;
  priority: number;
  // If provided, indicates a retry and should use existing snapshot
  scheduleRecordId?: string;
}

@Processor(QUEUE_SCHEDULE_EXECUTION, {
  // Worker concurrency: max concurrent jobs this worker can process
  // Jobs beyond this limit stay in queue and wait for available slots
  // Note: This uses default value; actual value is configured via module factory
  concurrency: DEFAULT_SCHEDULE_CONFIG.globalMaxConcurrent,
  // Rate limiter: limit jobs processed per duration
  // - max: maximum number of jobs to process
  // - duration: time window in milliseconds
  // Jobs exceeding this rate are automatically delayed, NOT rejected
  limiter: {
    max: DEFAULT_SCHEDULE_CONFIG.rateLimitMax,
    duration: DEFAULT_SCHEDULE_CONFIG.rateLimitDurationMs,
  },
})
export class ScheduleProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduleProcessor.name);
  private readonly scheduleConfig: ScheduleConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly miscService: MiscService,
    private readonly canvasService: CanvasService,
    private readonly metrics: ScheduleMetrics,
    private readonly creditService: CreditService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => WorkflowAppService))
    private readonly workflowAppService: WorkflowAppService,
    private readonly config: ConfigService,
  ) {
    super();
    this.scheduleConfig = getScheduleConfig(config);
  }

  async process(job: Job<ScheduleExecutionJobData, any, string>): Promise<any> {
    const {
      scheduleId,
      canvasId,
      uid,
      scheduledAt,
      priority,
      scheduleRecordId: existingRecordId,
    } = job.data;
    this.logger.log(`Processing schedule execution job ${job.id} for schedule ${scheduleId}`);

    let scheduleRecordId = existingRecordId || '';
    let isRetry = false;

    // Track if Redis counter was successfully incremented and not rolled back
    // This is critical for proper cleanup in listener
    let redisCounterActive = false;

    try {
      // 1. User-level concurrency check using Redis atomic operations
      // Use Redis INCR for atomic concurrency control, with database fallback
      const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${uid}`;

      let incrSucceeded = false;

      try {
        // Check if Redis counter exists, if not recover from database
        const counterExists = await this.redisService.existsBoolean(redisKey);
        if (!counterExists) {
          // Redis counter doesn't exist (e.g., after Redis restart)
          // Recover from database: count actual running records
          const actualRunningCount = await this.prisma.workflowScheduleRecord.count({
            where: {
              uid,
              status: { in: ['processing', 'running'] },
            },
          });

          // Initialize Redis counter with actual database count
          await this.redisService.setex(
            redisKey,
            this.scheduleConfig.userConcurrentTtl,
            String(actualRunningCount),
          );
          this.logger.debug(
            `Redis counter recovered from DB for user ${uid}: ${actualRunningCount} running records`,
          );
        }

        // Atomically increment counter
        const currentCount = await this.redisService.incr(redisKey);
        incrSucceeded = true;

        // Set TTL to prevent counter leakage (only if key is new or expired)
        await this.redisService.expire(redisKey, this.scheduleConfig.userConcurrentTtl);

        if (currentCount > this.scheduleConfig.userMaxConcurrent) {
          // Exceeded limit, rollback and delay
          await this.redisService.decr(redisKey);
          incrSucceeded = false;
          this.logger.warn(
            `User ${uid} has ${currentCount} concurrent executions (Redis), delaying job ${job.id}`,
          );
          await job.moveToDelayed(Date.now() + this.scheduleConfig.userRateLimitDelayMs, job.token);
          throw new DelayedError();
        }

        // Redis check passed, counter is active
        redisCounterActive = true;
      } catch (redisError) {
        // If it's a DelayedError from above, just rethrow
        if (redisError instanceof DelayedError) {
          throw redisError;
        }

        // If incr succeeded but subsequent operation failed, try to rollback
        if (incrSucceeded) {
          try {
            await this.redisService.decr(redisKey);
            this.logger.debug(`Rolled back Redis counter for user ${uid} after partial failure`);
          } catch {
            // Rollback failed, but we'll continue with DB fallback
            this.logger.warn(
              `Failed to rollback Redis counter for user ${uid} after partial failure`,
            );
          }
          incrSucceeded = false;
        }

        // Redis failed, use database fallback
        this.logger.warn(`Redis unavailable for user ${uid}, using database-only mode`, redisError);

        const runningCount = await this.prisma.workflowScheduleRecord.count({
          where: {
            uid,
            status: { in: ['processing', 'running'] },
          },
        });

        if (runningCount >= this.scheduleConfig.userMaxConcurrent) {
          this.logger.warn(
            `User ${uid} has ${runningCount} concurrent executions (DB fallback), delaying job ${job.id}`,
          );
          await job.moveToDelayed(Date.now() + this.scheduleConfig.userRateLimitDelayMs, job.token);
          throw new DelayedError();
        }

        // DB check passed, try to recover Redis counter from database
        // Note: runningCount already calculated above, reuse it to avoid duplicate query
        try {
          // Set Redis counter to match database state (recovery from Redis restart)
          // Then increment for this job
          await this.redisService.setex(
            redisKey,
            this.scheduleConfig.userConcurrentTtl,
            String(runningCount),
          );
          await this.redisService.incr(redisKey);
          redisCounterActive = true;
          this.logger.debug(
            `Redis recovered, counter restored from DB (${runningCount}) and incremented for user ${uid}`,
          );
        } catch (recoverError) {
          // Redis still unavailable, continue without Redis tracking
          this.logger.warn(
            `Redis still unavailable for user ${uid}, continuing without Redis tracking`,
            recoverError,
          );
        }
      }

      // 3. Create simple user object (only uid needed, avoid BigInt serialization issues)
      // Note: We don't query the full user object to avoid passing BigInt fields to queues
      const user = { uid };

      // 3. Find or verify the WorkflowScheduleRecord for this execution
      // The record should already exist with 'pending' status (set by CronService when job was queued)
      let existingRecord = null;
      if (existingRecordId) {
        existingRecord = await this.prisma.workflowScheduleRecord.findUnique({
          where: { scheduleRecordId: existingRecordId },
        });
        if (existingRecord?.snapshotStorageKey) {
          isRetry = true;
          this.logger.log(`Retry detected for scheduleRecordId: ${existingRecordId}`);
        }
        if (existingRecord) {
          scheduleRecordId = existingRecord.scheduleRecordId;
        }
      }

      // If no record ID was passed, try to find a pending record for this schedule
      if (!scheduleRecordId) {
        existingRecord = await this.prisma.workflowScheduleRecord.findFirst({
          where: {
            scheduleId,
            status: { in: ['pending', 'scheduled'] }, // Could be pending (queued) or scheduled (waiting)
            workflowExecutionId: null,
          },
          orderBy: { scheduledAt: 'asc' },
        });
        if (existingRecord) {
          scheduleRecordId = existingRecord.scheduleRecordId;
          this.logger.log(`Found existing record ${scheduleRecordId} for execution`);
        }
      }

      // 3.1 Check if the current record has already failed
      // This prevents re-execution of already failed records
      if (existingRecord && existingRecord.status === 'failed') {
        this.logger.warn(
          `Schedule record ${scheduleRecordId} has already failed with reason ${existingRecord.failureReason}, skipping execution for job ${job.id}`,
        );

        // Rollback Redis counter since we're not proceeding with execution
        if (redisCounterActive) {
          try {
            const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${uid}`;
            await this.redisService.decr(redisKey);
            this.logger.debug(`Rolled back Redis counter for user ${uid} (record already failed)`);
          } catch (redisError) {
            this.logger.warn(`Failed to rollback Redis counter for user ${uid}`, redisError);
          }
        }

        // Record metric based on failure reason
        const failureReason = existingRecord.failureReason || 'unknown_error';
        this.metrics.execution.fail('cron', failureReason);
        return null; // Exit gracefully without error
      }

      const schedule = await this.prisma.workflowSchedule.findUnique({
        where: { scheduleId },
      });

      // Check if schedule exists (may have been deleted while job was queued)
      if (!schedule) {
        this.logger.warn(
          `Schedule ${scheduleId} not found, likely deleted while job was queued. Skipping execution for job ${job.id}`,
        );

        // Rollback Redis counter since we're not proceeding with execution
        if (redisCounterActive) {
          try {
            const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${uid}`;
            await this.redisService.decr(redisKey);
            this.logger.debug(`Rolled back Redis counter for user ${uid} (schedule not found)`);
          } catch (redisError) {
            this.logger.warn(`Failed to rollback Redis counter for user ${uid}`, redisError);
          }
        }

        // Record metric
        this.metrics.execution.fail('cron', 'schedule_not_found');
        return null; // Exit gracefully without error
      }

      // 4. Create new WorkflowScheduleRecord only if no existing record was found
      // This is a fallback for edge cases (e.g., manual trigger without scheduled record)
      if (!scheduleRecordId) {
        scheduleRecordId = genScheduleRecordId();
        await this.prisma.workflowScheduleRecord.create({
          data: {
            scheduleRecordId,
            scheduleId,
            uid,
            sourceCanvasId: canvasId, // Source canvas (template)
            canvasId: '', // Will be updated after execution with actual execution canvas
            workflowTitle: '',
            scheduledAt: new Date(scheduledAt),
            status: 'processing', // Skip pending since we're already in processor
            priority,
            triggeredAt: new Date(),
          },
        });
        this.logger.log(`Created new schedule record ${scheduleRecordId}`);
      } else if (isRetry) {
        // Update status for retry
        await this.prisma.workflowScheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'processing',
            failureReason: null,
            errorDetails: null,
            triggeredAt: new Date(),
          },
        });
      } else {
        // 4.1 Update status to 'processing' - job has been dequeued from BullMQ
        // This indicates the job is now actively being handled by the processor

        // 4.2 Re-check concurrency using database query (as fallback validation)
        // Note: The first Redis INCR already reserved the slot atomically.
        // This database check is a secondary validation to catch edge cases where
        // Redis state might be inconsistent with actual database state.
        // DO NOT use INCR here again - the slot was already reserved in step 1.
        const currentRunningCount = await this.prisma.workflowScheduleRecord.count({
          where: {
            uid,
            status: { in: ['processing', 'running'] },
          },
        });

        if (currentRunningCount >= this.scheduleConfig.userMaxConcurrent) {
          // Database shows we're at limit, but Redis already incremented.
          // This indicates Redis counter might be ahead of actual state.
          // Rollback Redis counter and delay.
          this.logger.warn(
            `Secondary check failed: User ${uid} has ${currentRunningCount} concurrent executions (DB), delaying job ${job.id}`,
          );
          if (redisCounterActive) {
            try {
              const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${uid}`;
              await this.redisService.decr(redisKey);
            } catch (redisError) {
              this.logger.warn(`Failed to rollback Redis counter for user ${uid}`, redisError);
            }
          }
          await job.moveToDelayed(Date.now() + this.scheduleConfig.userRateLimitDelayMs, job.token);
          throw new DelayedError();
        }

        await this.prisma.workflowScheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'processing', // Processor is handling the job (creating snapshot, etc.)
            triggeredAt: existingRecord?.triggeredAt ? undefined : new Date(),
          },
        });
      }

      // 5. Get or create snapshot
      let canvasData: RawCanvasData;
      let snapshotStorageKey: string;

      if (isRetry && existingRecord?.snapshotStorageKey) {
        // Retry: Load existing snapshot
        snapshotStorageKey = existingRecord.snapshotStorageKey;
        canvasData = await this.loadSnapshot(snapshotStorageKey);
        this.logger.log(`Loaded existing snapshot from: ${snapshotStorageKey}`);
      } else {
        // New execution: Create snapshot from raw canvas data
        // Note: We use getCanvasRawData instead of processCanvasForShare because:
        // - processCanvasForShare is designed for sharing existing content (creates ShareRecords)
        // - Schedule needs raw canvas data for execution (no ShareRecords needed)
        // - processCanvasForShare would fail if skillResponse nodes have no action results
        canvasData = await this.canvasService.createSnapshotFromCanvas(user, canvasId);

        // Upload snapshot to private storage
        snapshotStorageKey = `schedules/${uid}/${scheduleRecordId}/snapshot.json`;
        await this.uploadSnapshot(user, canvasData, snapshotStorageKey);
        this.logger.log(`Created new snapshot at: ${snapshotStorageKey}`);
      }

      // 6. Check credit balance before execution
      // This prevents wasting resources on execution that will fail due to insufficient credits
      const fullUser = await this.prisma.user.findUnique({ where: { uid } });
      if (fullUser) {
        const creditBalance = await this.creditService.getCreditBalance(fullUser);
        if (creditBalance.creditBalance <= 0) {
          this.logger.warn(
            `User ${uid} has insufficient credits (${creditBalance.creditBalance}), failing schedule ${scheduleId}`,
          );

          // Rollback Redis counter since we're not proceeding with execution
          if (redisCounterActive) {
            try {
              const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${uid}`;
              await this.redisService.decr(redisKey);
              this.logger.debug(`Rolled back Redis counter for user ${uid} (insufficient credits)`);
            } catch (redisError) {
              this.logger.warn(`Failed to rollback Redis counter for user ${uid}`, redisError);
            }
          }

          await this.prisma.workflowScheduleRecord.update({
            where: { scheduleRecordId },
            data: {
              status: 'failed',
              failureReason: ScheduleFailureReason.INSUFFICIENT_CREDITS,
              errorDetails: JSON.stringify({
                message: 'Insufficient credits to execute scheduled workflow',
                creditBalance: creditBalance.creditBalance,
              }),
              snapshotStorageKey,
              completedAt: new Date(),
            },
          });
          this.metrics.execution.fail('cron', 'insufficient_credits');

          // Send Email
          if (fullUser.email) {
            // Calculate next run time from cron expression
            const timezone = schedule.timezone || 'Asia/Shanghai';
            let nextRunTime: string | undefined;
            if (schedule.cronExpression) {
              try {
                const interval = CronExpressionParser.parse(schedule.cronExpression, {
                  tz: timezone,
                });
                nextRunTime = formatDateTime(interval.next().toDate(), timezone);
              } catch (err) {
                this.logger.warn(`Failed to calculate next run time for email: ${err}`);
              }
            }

            const { subject, html } = generateInsufficientCreditsEmail({
              userName: fullUser.nickname || 'User',
              scheduleName: schedule.name || 'Scheduled Workflow',
              currentBalance: creditBalance.creditBalance,
              schedulesLink: `${this.config.get<string>('origin')}/run-history/${scheduleRecordId}`,
              nextRunTime,
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

          return null;
        }
      }

      // 7. Update status to 'running' before executing workflow
      // This indicates the workflow is actually being executed
      // Extract used tools from canvas nodes
      const toolsetsWithNodes = extractToolsetsWithNodes(canvasData?.nodes ?? []);
      const usedToolIds = toolsetsWithNodes.map((t) => t.toolset?.toolset?.key).filter(Boolean);

      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId },
        data: {
          status: 'running', // Workflow is actually executing
          snapshotStorageKey,
          workflowTitle: canvasData?.title || 'Untitled',
          usedTools: JSON.stringify(usedToolIds),
        },
      });

      // 7. Execute workflow using WorkflowAppService
      // Note: user is a simple object { uid } to avoid BigInt serialization issues
      // The methods called inside executeFromCanvasData only need user.uid
      const { executionId, canvasId: newCanvasId } =
        await this.workflowAppService.executeFromCanvasData(
          user,
          canvasData,
          canvasData.variables || [],
          {
            scheduleId,
            scheduleRecordId,
            triggerType: 'scheduled',
          },
        );

      // 8. Update WorkflowScheduleRecord with execution canvas ID and workflow execution ID
      // Final status (success/failed) will be updated by pollWorkflow when execution completes
      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId },
        data: {
          canvasId: newCanvasId, // Actual execution canvas (newly created)
          workflowExecutionId: executionId,
          // Note: completedAt will be set by pollWorkflow when workflow finishes
        },
      });

      this.logger.log(
        `Successfully started workflow for schedule ${scheduleId}, executionId: ${executionId}`,
      );
      // Record started metric (not success - that will be recorded by pollWorkflow)
      this.metrics.execution.success('cron');
      return executionId;
    } catch (error) {
      // Don't log or update record for DelayedError (rate limiting)
      // Count was already rolled back in the check logic
      if (error instanceof DelayedError) {
        this.metrics.queue.delayed();
        throw error;
      }

      this.logger.error(`Failed to process schedule ${scheduleId}`, error);

      // If Redis counter was incremented, we need to decrement it
      // This handles cases where task fails after passing checks but before workflow starts
      if (redisCounterActive) {
        try {
          const redisKey = `${SCHEDULE_REDIS_KEYS.USER_CONCURRENT_PREFIX}${uid}`;
          await this.redisService.decr(redisKey);
          this.logger.debug(`Decremented Redis counter for user ${uid} due to task failure`);
        } catch (redisError) {
          // Redis failure is not critical here, just log
          this.logger.warn(
            `Failed to decrement Redis counter for user ${uid} in error handler`,
            redisError,
          );
        }
      }

      // Classify error and get standardized failure reason
      const failureReason = classifyScheduleError(error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record failure metric
      this.metrics.execution.fail('cron', failureReason);

      if (scheduleRecordId) {
        await this.prisma.workflowScheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'failed',
            failureReason,
            errorDetails: JSON.stringify({
              message: errorMessage,
              name: error instanceof Error ? error.name : 'Error',
              stack: error instanceof Error ? error.stack : undefined,
            }),
            completedAt: new Date(),
          },
        });

        // Send failure email (safe catch)
        try {
          // 1. Get user details
          const fullUser = await this.prisma.user.findUnique({ where: { uid } });
          if (!fullUser) {
            this.logger.warn(
              `Cannot send failure email: user ${uid} not found for schedule ${scheduleId}`,
            );
          } else if (!fullUser.email) {
            this.logger.warn(
              `Cannot send failure email: user ${uid} has no email address for schedule ${scheduleId}`,
            );
          } else {
            // 2. Get schedule details for context
            const schedule = await this.prisma.workflowSchedule.findUnique({
              where: { scheduleId },
            });

            // 2.1 Get schedule record to retrieve triggeredAt
            const scheduleRecord = await this.prisma.workflowScheduleRecord.findUnique({
              where: { scheduleRecordId },
            });

            // 3. Calculate next run with timezone
            const timezone = schedule?.timezone || 'Asia/Shanghai';
            let nextRunTime = 'Check Dashboard';
            if (schedule?.cronExpression) {
              try {
                const interval = CronExpressionParser.parse(schedule.cronExpression, {
                  tz: timezone,
                });
                nextRunTime = formatDateTime(interval.next().toDate(), timezone);
              } catch (_) {
                // Ignore cron parse error
              }
            }

            // 4. Use scheduledAt as the run time
            const scheduledAtDate = scheduleRecord?.scheduledAt || new Date();

            // 5. Send email
            const { subject, html } = generateScheduleFailedEmail({
              userName: fullUser.nickname || 'User',
              scheduleName: schedule?.name || 'Scheduled Workflow',
              scheduledAt: formatDateTime(scheduledAtDate, timezone),
              nextRunTime,
              schedulesLink: `${this.config.get<string>('origin')}/run-history/${scheduleRecordId}`,
              runDetailsLink: `${this.config.get<string>('origin')}/run-history/${scheduleRecordId}`,
            });
            await this.notificationService.sendEmail(
              { to: fullUser.email, subject, html },
              fullUser,
            );
          }
        } catch (emailError: any) {
          this.logger.error(
            `Failed to send failure email for schedule ${scheduleId}: ${emailError?.message}`,
            emailError,
          );
        }
      }
      throw error;
    }
    // Note: Redis counter will be decremented by ScheduleEventListener when workflow completes/fails
    // This ensures accurate concurrency tracking based on actual workflow execution status
  }

  /**
   * Load snapshot from storage
   */
  private async loadSnapshot(storageKey: string): Promise<RawCanvasData> {
    const buffer = await this.miscService.downloadFile({
      storageKey,
      visibility: 'private',
    });
    const data = safeParseJSON(buffer.toString());
    if (!data) {
      throw new Error(`Failed to parse snapshot from ${storageKey}`);
    }
    return data as RawCanvasData;
  }

  /**
   * Upload snapshot to storage
   */
  private async uploadSnapshot(
    user: { uid: string },
    canvasData: RawCanvasData,
    storageKey: string,
  ): Promise<void> {
    await this.miscService.uploadBuffer(user as any, {
      fpath: 'snapshot.json',
      buf: Buffer.from(JSON.stringify(canvasData)),
      visibility: 'private',
      storageKey,
    });
  }

  // classifyError moved to schedule.constants.ts as classifyScheduleError
}
