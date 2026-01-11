import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowCompletedEvent, WorkflowFailedEvent } from '../workflow/workflow.events';
import { CanvasDeletedEvent } from '../canvas/canvas.events';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationService } from '../notification/notification.service';
import { CreditService } from '../credit/credit.service';
import { CanvasService } from '../canvas/canvas.service';
import { MiscService } from '../misc/misc.service';
import { genCreditUsageId } from '@refly/utils';
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
import type { User, RawCanvasData } from '@refly/openapi-schema';

@Injectable()
export class ScheduleEventListener {
  private readonly logger = new Logger(ScheduleEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    private readonly creditService: CreditService,
    private readonly config: ConfigService,
    private readonly canvasService: CanvasService,
    private readonly miscService: MiscService,
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

      // 6. Create snapshot for workflow executions (runs on original canvas)
      // For 'workflow' triggerType, snapshot should be created after execution completes
      // to capture the final state of the canvas
      await this.createSnapshotIfNeeded(event.scheduleId!, event.canvasId, event.userId);

      // 7. Send notification email
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
   * Create snapshot for workflow executions if needed
   * For 'workflow' triggerType (runs on original canvas), create snapshot after execution completes
   * Strategy: Duplicate the original canvas to a new canvas to preserve execution state
   */
  private async createSnapshotIfNeeded(
    scheduleRecordId: string,
    _canvasId: string,
    _userId: string,
  ): Promise<void> {
    try {
      // Get full record to check triggerType, snapshotStorageKey, and sourceCanvasId
      const record = await this.prisma.workflowScheduleRecord.findUnique({
        where: { scheduleRecordId },
        select: {
          triggerType: true,
          snapshotStorageKey: true,
          uid: true,
          sourceCanvasId: true,
          workflowTitle: true,
        },
      });

      if (!record) {
        this.logger.warn(`Record ${scheduleRecordId} not found for snapshot creation`);
        return;
      }

      // Only create snapshot for 'workflow' triggerType (runs on original canvas)
      if (record.triggerType !== 'workflow') {
        return;
      }

      // Check if snapshot canvas already exists
      // We use snapshotStorageKey to store the snapshot canvas ID
      if (record.snapshotStorageKey) {
        // Check if the canvas exists (snapshotStorageKey contains canvasId)
        const snapshotCanvasId = record.snapshotStorageKey;
        const snapshotCanvas = await this.prisma.canvas.findUnique({
          where: { canvasId: snapshotCanvasId },
          select: { canvasId: true },
        });
        if (snapshotCanvas) {
          this.logger.log(
            `Snapshot canvas already exists for ${scheduleRecordId}: ${snapshotCanvasId}`,
          );
          return;
        }
      }

      this.logger.log(
        `Creating snapshot canvas for workflow execution ${scheduleRecordId} after completion`,
      );

      // For 'workflow' triggerType, use sourceCanvasId (the original canvas where workflow runs)
      const sourceCanvasId = record.sourceCanvasId || _canvasId;

      // Duplicate the original canvas to create a snapshot canvas
      // This preserves the execution state without affecting the original canvas
      const user = { uid: record.uid } as User;
      const snapshotCanvas = await this.canvasService.duplicateCanvas(
        user,
        {
          canvasId: sourceCanvasId,
          title: `${record.workflowTitle}`,
          duplicateEntities: true, // Duplicate files and resources to ensure snapshot is complete
        },
        { checkOwnership: true },
      );

      const snapshotCanvasId = snapshotCanvas.canvasId;

      // Hide the snapshot canvas from canvas list
      // Set visibility to false so it won't appear in workflow list
      await this.prisma.canvas.update({
        where: { canvasId: snapshotCanvasId },
        data: { visibility: false },
      });

      // Get the current version of the snapshot canvas
      const snapshotCanvasWithVersion = await this.prisma.canvas.findUnique({
        where: { canvasId: snapshotCanvasId },
        select: { version: true },
      });

      if (!snapshotCanvasWithVersion) {
        throw new Error(`Failed to get snapshot canvas version for ${snapshotCanvasId}`);
      }

      // Update action results and duplicate credit records
      // This ensures result records and credit records can be matched to the snapshot canvas
      await this.updateActionResultsAndCredits(sourceCanvasId, snapshotCanvasId, record.uid);

      // Store snapshot canvas ID in snapshotStorageKey
      // Format: canvasId:version for easy retrieval
      const snapshotStorageKey = `${snapshotCanvasId}:${snapshotCanvasWithVersion.version}`;

      // Update record with snapshot storage key (contains canvasId:version)
      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId },
        data: { snapshotStorageKey },
      });

      this.logger.log(
        `Successfully created snapshot canvas ${snapshotCanvasId} (version: ${snapshotCanvasWithVersion.version}) for ${scheduleRecordId}`,
      );
    } catch (error: any) {
      // Snapshot creation failure should not affect the main flow
      this.logger.warn(`Failed to create snapshot for ${scheduleRecordId}: ${error?.message}`);
    }
  }

  /**
   * Update action results and duplicate credit records for snapshot canvas
   * This ensures both result records and credit records can be matched to the snapshot canvas
   */
  private async updateActionResultsAndCredits(
    sourceCanvasId: string,
    snapshotCanvasId: string,
    uid: string,
  ): Promise<void> {
    try {
      // Step 1: Get original action results from source canvas (before duplication)
      const originalResults = await this.prisma.actionResult.findMany({
        where: {
          targetId: sourceCanvasId,
          targetType: 'canvas',
          uid,
        },
        select: {
          resultId: true,
          version: true,
        },
      });

      if (originalResults.length === 0) {
        this.logger.log(
          `No action results found for canvas ${sourceCanvasId}, skipping credit duplication`,
        );
        return;
      }

      // Step 2: Get duplicated action results from snapshot canvas (after duplication)
      // These have new resultIds generated during canvas duplication
      const duplicatedResults = await this.prisma.actionResult.findMany({
        where: {
          targetId: snapshotCanvasId,
          targetType: 'canvas',
          uid,
        },
        select: {
          resultId: true,
          version: true,
          duplicateFrom: true, // This field contains the original resultId
        },
      });

      // Step 3: Build mapping from old resultId to new resultId
      const resultIdMap = new Map<string, { newResultId: string; newVersion: number }>();
      for (const duplicatedResult of duplicatedResults) {
        if (duplicatedResult.duplicateFrom) {
          resultIdMap.set(duplicatedResult.duplicateFrom, {
            newResultId: duplicatedResult.resultId,
            newVersion: duplicatedResult.version, // Usually 0 for duplicated results
          });
        }
      }

      if (resultIdMap.size === 0) {
        this.logger.log(
          `No resultId mapping found for snapshot canvas ${snapshotCanvasId}. Credit duplication skipped.`,
        );
        return;
      }

      // Step 4: Duplicate credit usage records for the new resultIds
      let totalDuplicatedCredits = 0;
      const creditDuplicatePromises: Promise<any>[] = [];

      for (const [oldResultId, mapping] of resultIdMap.entries()) {
        // Find the original result's latest version to get credit records
        const originalResult = originalResults.find((r) => r.resultId === oldResultId);
        if (!originalResult) {
          continue;
        }

        // Get credit usage records for the original resultId and version
        const creditUsages = await this.prisma.creditUsage.findMany({
          where: {
            uid,
            actionResultId: oldResultId,
            version: originalResult.version,
          },
        });

        // Duplicate each credit record with the new resultId and version
        for (const creditUsage of creditUsages) {
          creditDuplicatePromises.push(
            this.prisma.creditUsage.create({
              data: {
                usageId: genCreditUsageId(),
                uid: creditUsage.uid,
                amount: creditUsage.amount,
                dueAmount: creditUsage.dueAmount,
                providerItemId: creditUsage.providerItemId,
                modelName: creditUsage.modelName,
                usageType: creditUsage.usageType,
                actionResultId: mapping.newResultId, // Point to new resultId
                version: mapping.newVersion, // Use new version (usually 0)
                pilotSessionId: creditUsage.pilotSessionId,
                description: creditUsage.description,
                toolCallId: creditUsage.toolCallId,
                toolCallMeta: creditUsage.toolCallMeta,
                appId: creditUsage.appId,
                extraData: creditUsage.extraData,
                modelUsageDetails: creditUsage.modelUsageDetails,
                createdAt: creditUsage.createdAt,
              },
            }),
          );
          totalDuplicatedCredits++;
        }
      }

      // Execute all credit duplication in parallel
      if (creditDuplicatePromises.length > 0) {
        await Promise.all(creditDuplicatePromises);
        this.logger.log(
          `Duplicated ${totalDuplicatedCredits} credit records for snapshot canvas ${snapshotCanvasId}`,
        );
      } else {
        this.logger.log(
          `No credit records found to duplicate for snapshot canvas ${snapshotCanvasId}`,
        );
      }

      this.logger.log(
        `Successfully updated action results and credits for snapshot canvas ${snapshotCanvasId}`,
      );
    } catch (error: any) {
      // Log error but don't fail the snapshot creation
      this.logger.warn(
        `Failed to update action results and credits: ${error?.message}. Snapshot creation will continue.`,
      );
    }
  }

  /**
   * Create snapshot from canvas data with files and resources
   */
  private async createSnapshotFromCanvas(
    user: { uid: string },
    canvasId: string,
  ): Promise<RawCanvasData> {
    // 1. Get raw canvas data (nodes, edges, variables)
    const rawData = await this.canvasService.getCanvasRawData(user as any, canvasId);

    // 2. Get drive files associated with this canvas
    const driveFiles = await this.prisma.driveFile.findMany({
      where: {
        uid: user.uid,
        canvasId,
        scope: 'present',
        deletedAt: null,
      },
    });

    const files = driveFiles.map((file) => ({
      fileId: file.fileId,
      canvasId: file.canvasId,
      name: file.name,
      type: file.type,
      category: file.category,
      size: Number(file.size),
      source: file.source,
      scope: file.scope,
      summary: file.summary ?? undefined,
      variableId: file.variableId ?? undefined,
      resultId: file.resultId ?? undefined,
      resultVersion: file.resultVersion ?? undefined,
      storageKey: file.storageKey ?? undefined,
      createdAt: file.createdAt.toJSON(),
      updatedAt: file.updatedAt.toJSON(),
    }));

    // 3. Get resources associated with this canvas
    const resources = await this.prisma.resource.findMany({
      where: {
        uid: user.uid,
        canvasId,
        deletedAt: null,
      },
      select: {
        resourceId: true,
        title: true,
        resourceType: true,
        storageKey: true,
        storageSize: true,
        contentPreview: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 4. Combine into snapshot format
    return {
      title: rawData.title,
      canvasId: rawData.canvasId,
      variables: rawData.variables || [],
      nodes: rawData.nodes || [],
      edges: rawData.edges || [],
      files: files as any,
      resources: resources as any,
    } as RawCanvasData;
  }

  /**
   * Upload snapshot to object storage
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
    this.logger.log(`Uploaded snapshot to: ${storageKey}`);
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

      // Debug: Check if execution exists
      const execution = await this.prisma.workflowExecution.findUnique({
        where: { executionId, uid },
      });
      if (!execution) {
        this.logger.warn(
          `Execution ${executionId} not found for user ${uid}, cannot calculate credit usage`,
        );
        return 0;
      }

      // Debug: Check action results
      const actionResults = await this.prisma.actionResult.findMany({
        where: {
          workflowExecutionId: executionId,
          uid,
        },
        select: {
          resultId: true,
          version: true,
          status: true,
        },
      });

      this.logger.log(
        `Found ${actionResults.length} action results for execution ${executionId}: ${actionResults.map((r) => `${r.resultId}:${r.version} (${r.status})`).join(', ')}`,
      );

      // Debug: Check credit usages
      if (actionResults.length > 0) {
        const creditCounts = await Promise.all(
          actionResults.map(async (result) => {
            const count = await this.prisma.creditUsage.count({
              where: {
                uid,
                actionResultId: result.resultId,
                version: result.version,
              },
            });
            return { resultId: result.resultId, version: result.version, count };
          }),
        );
        this.logger.log(
          `Credit usage counts: ${creditCounts.map((c) => `${c.resultId}:${c.version} = ${c.count} records`).join(', ')}`,
        );
      }

      const totalCredits = await this.creditService.countExecutionCreditUsageByExecutionId(
        user,
        executionId,
      );
      this.logger.log(`Total credit usage for execution ${executionId}: ${totalCredits} credits`);
      return totalCredits;
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
