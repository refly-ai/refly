import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ActionResultNotFoundError } from '@refly/errors';
import { AbortActionRequest, EntityType, GetActionResultData, User } from '@refly/openapi-schema';
import { batchReplaceRegex, genActionResultID, pick } from '@refly/utils';
import pLimit from 'p-limit';
import { ActionResult } from '../../generated/client';
import { ActionDetail } from '../action/action.dto';
import { PrismaService } from '../common/prisma.service';
import { providerItem2ModelInfo } from '../provider/provider.dto';
import { ProviderService } from '../provider/provider.service';
import { StepService } from '../step/step.service';
import { ToolCallService } from '../tool-call/tool-call.service';
import { DriveService } from '../drive/drive.service';
import { RedisService } from '../common/redis.service';
import { QUEUE_SKILL } from '../../utils';
import { InvokeSkillJobData } from '../skill/skill.dto';

type GetActionResultParams = GetActionResultData['query'] & {
  includeFiles?: boolean;
};

@Injectable()
export class ActionService {
  private readonly logger = new Logger(ActionService.name);

  // Store active abort controllers with timeout cleanup to prevent memory leaks
  private activeAbortControllers = new Map<
    string,
    { controller: AbortController; timeoutId: NodeJS.Timeout }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: ProviderService,
    private readonly toolCallService: ToolCallService,
    private readonly stepService: StepService,
    private readonly driveService: DriveService,
    private readonly redis: RedisService,
    @Optional()
    @InjectQueue(QUEUE_SKILL)
    private skillQueue?: Queue<InvokeSkillJobData>,
  ) {}

  async getActionResult(user: User, param: GetActionResultParams): Promise<ActionDetail> {
    const { resultId, version, includeFiles = false } = param;

    const result = await this.prisma.actionResult.findFirst({
      where: {
        resultId,
        version,
        uid: user.uid,
      },
      orderBy: { version: 'desc' },
    });
    if (!result) {
      throw new ActionResultNotFoundError();
    }

    const enrichedResult = await this.enrichActionResultWithDetails(user, result);

    if (includeFiles) {
      enrichedResult.files = await this.driveService.listDriveFiles(user, {
        canvasId: result.targetId,
        source: 'agent',
        resultId,
        resultVersion: version,
        includeContent: true,
      });
    }

    return enrichedResult;
  }

  private async enrichActionResultWithDetails(
    user: User,
    result: ActionResult,
  ): Promise<ActionDetail> {
    const item =
      (result.providerItemId
        ? await this.providerService.findProviderItemById(user, result.providerItemId)
        : null) ||
      (result.modelName
        ? (await this.providerService.findLLMProviderItemByModelID(user, result.modelName)) ||
          (await this.providerService.findMediaProviderItemByModelID(user, result.modelName))
        : null);
    const modelInfo = item ? providerItem2ModelInfo(item) : null;

    const steps = await this.stepService.getSteps(result.resultId, result.version);
    const toolCalls = await this.toolCallService.fetchToolCalls(result.resultId, result.version);

    if (!steps || steps.length === 0) {
      return { ...result, steps: [], modelInfo };
    }

    const stepsWithToolCalls = this.toolCallService.attachToolCallsToSteps(steps, toolCalls);
    return { ...result, steps: stepsWithToolCalls, modelInfo };
  }

  async batchProcessActionResults(user: User, results: ActionResult[]): Promise<ActionDetail[]> {
    // Group results by resultId and keep only the latest version for each, maintaining input order
    const latestResultsMap = new Map<string, ActionResult>();
    const orderedResultIds: string[] = [];

    for (const result of results) {
      const existing = latestResultsMap.get(result.resultId);
      if (!existing || (result.version ?? 0) > (existing.version ?? 0)) {
        latestResultsMap.set(result.resultId, result);
        // Only add to ordered list if this is the first time we encounter this resultId
        if (!existing) {
          orderedResultIds.push(result.resultId);
        }
      }
    }

    // Get filtered results in the order they first appeared in the input
    const filteredResults = orderedResultIds.map((resultId) => latestResultsMap.get(resultId));

    // If no results found, return empty array
    if (!filteredResults.length) {
      return [];
    }

    // Use concurrency limit to prevent overwhelming the database
    const limit = pLimit(5);

    // Process each result in parallel to fetch related data
    const processedResultsPromises = filteredResults.map((result) =>
      limit(async () => {
        try {
          return await this.enrichActionResultWithDetails(user, result);
        } catch (error) {
          this.logger.error(`Failed to process action result ${result.resultId}:`, error);
          // Return result with empty steps and no model info on error
          return { ...result, steps: [], modelInfo: null };
        }
      }),
    );

    const processedResults = await Promise.all(processedResultsPromises);
    return processedResults;
  }

  async duplicateActionResults(
    user: User,
    param: {
      sourceResultIds: string[];
      targetId: string;
      targetType: EntityType;
      replaceEntityMap: Record<string, string>;
    },
    options?: { checkOwnership?: boolean },
  ) {
    const { sourceResultIds, targetId, targetType, replaceEntityMap } = param;

    // Get all action results for the given resultIds
    const allResults = await this.prisma.actionResult.findMany({
      where: {
        resultId: { in: sourceResultIds },
      },
      orderBy: { version: 'desc' },
    });

    if (!allResults?.length) {
      return [];
    }

    // Filter to keep only the latest version of each resultId
    const latestResultsMap = new Map<string, ActionResult>();
    for (const result of allResults) {
      if (
        !latestResultsMap.has(result.resultId) ||
        latestResultsMap.get(result.resultId).version < result.version
      ) {
        latestResultsMap.set(result.resultId, result);
      }
    }

    const filteredOriginalResults = Array.from(latestResultsMap.values());

    if (!filteredOriginalResults.length) {
      return [];
    }

    // Generate new resultIds beforehand to facilitate the replacement of history results
    for (const sourceResultId of sourceResultIds) {
      replaceEntityMap[sourceResultId] = genActionResultID();
    }

    const limit = pLimit(5);

    // Process each original result in parallel
    const newResultsPromises = filteredOriginalResults.map((originalResult) =>
      limit(async () => {
        const { resultId, version, context, history } = originalResult;

        // Check if the user has access to the result
        if (options?.checkOwnership && user.uid !== originalResult.uid) {
          const shareCnt = await this.prisma.shareRecord.count({
            where: {
              entityId: resultId,
              entityType: 'skillResponse',
              deletedAt: null,
            },
          });

          if (shareCnt === 0) {
            return null; // Skip this result if user doesn't have access
          }
        }

        const newResultId = replaceEntityMap[resultId];

        // Get the original steps
        const originalSteps = await this.prisma.actionStep.findMany({
          where: {
            resultId,
            version,
            deletedAt: null,
          },
          orderBy: { order: 'asc' },
        });

        // Create new action result with a new resultId
        const newResult = await this.prisma.actionResult.create({
          data: {
            ...pick(originalResult, [
              'type',
              'title',
              'tier',
              'modelName',
              'input',
              'actionMeta',
              'tplConfig',
              'runtimeConfig',
              'locale',
              'status',
              'errors',
              'errorType',
            ]),
            context: batchReplaceRegex(JSON.stringify(context), replaceEntityMap),
            history: batchReplaceRegex(JSON.stringify(history), replaceEntityMap),
            resultId: newResultId,
            uid: user.uid,
            targetId,
            targetType,
            duplicateFrom: resultId,
            version: 0, // Reset version to 0 for the new duplicate
          },
        });

        // Create new steps for the duplicated result
        if (originalSteps?.length > 0) {
          await this.prisma.actionStep.createMany({
            data: originalSteps.map((step) => ({
              ...pick(step, [
                'order',
                'name',
                'content',
                'reasoningContent',
                'structuredData',
                'logs',
                'tokenUsage',
              ]),
              resultId: newResult.resultId,
              artifacts: batchReplaceRegex(JSON.stringify(step.artifacts), replaceEntityMap),
              version: 0, // Reset version to 0 for the new duplicate
            })),
          });
        }

        return newResult;
      }),
    );

    // Wait for all promises to resolve and filter out null results (skipped due to access check)
    const results = await Promise.all(newResultsPromises);

    return results.filter((result) => result !== null);
  }

  /**
   * Register an abort controller for a running action with timeout cleanup
   */
  registerAbortController(resultId: string, controller: AbortController) {
    // Set up automatic cleanup after 30 minutes to prevent memory leaks
    const timeoutId = setTimeout(
      () => {
        this.logger.warn(`Auto-cleaning up abort controller for action: ${resultId} after timeout`);
        this.unregisterAbortController(resultId);
      },
      30 * 60 * 1000,
    ); // 30 minutes

    this.activeAbortControllers.set(resultId, { controller, timeoutId });
    this.logger.debug(`Registered abort controller for action: ${resultId}`);
  }

  /**
   * Unregister an abort controller when action completes
   */
  unregisterAbortController(resultId: string) {
    const entry = this.activeAbortControllers.get(resultId);
    if (entry) {
      clearTimeout(entry.timeoutId);
      this.activeAbortControllers.delete(resultId);
      this.logger.debug(`Unregistered abort controller for action: ${resultId}`);
    }
  }

  /**
   * Abort a running action
   */
  async abortAction(user: User, result: ActionResult, reason?: string) {
    const { resultId } = result;

    this.logger.debug(`Attempting to abort action: ${resultId} for user: ${user.uid}`);

    // Get the abort controller for this action
    const entry = this.activeAbortControllers.get(resultId);

    // Determine the error message based on the reason
    const defaultReason = 'User aborted the action';
    const abortReason = reason || 'User requested abort';
    const errorMessage = reason || defaultReason;

    if (entry) {
      // Abort the action
      entry.controller.abort(abortReason);
      this.logger.log(`Aborted action: ${resultId} - ${abortReason}`);

      // Clean up the entry
      this.unregisterAbortController(resultId);
    } else {
      this.logger.log(`No active abort controller found for action: ${resultId}`);
    }

    // Always update the action status to failed, regardless of whether we found an active controller
    // This handles cases where the action might be stuck without an active controller
    try {
      await this.prisma.actionResult.updateMany({
        where: {
          pk: result.pk,
          status: 'executing', // Only update if still executing to avoid race conditions
        },
        data: {
          status: 'failed',
          errors: JSON.stringify([errorMessage]),
          errorType: 'userAbort',
        },
      });
      this.logger.log(`Updated action ${resultId} status to failed: ${errorMessage}`);
    } catch (updateError) {
      // If the update fails (e.g., because the status is no longer 'executing'),
      // log the error but don't throw it
      this.logger.warn(`Failed to update action ${resultId} status: ${updateError?.message}`);
    }
  }

  async abortActionFromReq(user: User, req: AbortActionRequest, reason?: string) {
    const { resultId, version } = req;

    // Try exact version first, fallback to latest version if not found (handles rapid start-stop)
    let result = await this.prisma.actionResult.findFirst({
      where: {
        resultId,
        version,
        uid: user.uid,
      },
    });

    // If exact version not found, try to find the latest version for this resultId
    if (!result) {
      this.logger.warn(
        `Action result ${resultId} version ${version} not found, trying to find latest version`,
      );
      result = await this.prisma.actionResult.findFirst({
        where: {
          resultId,
          uid: user.uid,
        },
        orderBy: {
          version: 'desc',
        },
      });
    }

    if (!result) {
      throw new ActionResultNotFoundError();
    }

    const abortReason = reason || 'User requested abort';
    const actualVersion = result.version;

    // Step 1: Check if controller is in memory (same pod) - FASTEST
    // Note: If controller exists, Redis mapping has already been deleted when execution started
    const entry = this.activeAbortControllers.get(resultId);
    if (entry) {
      this.logger.log(`Found controller in memory for ${resultId}, aborting directly`);
      entry.controller.abort(abortReason);
      this.unregisterAbortController(resultId);
      // Update database status
      await this.markAbortRequested(resultId, actualVersion, abortReason);
      this.logger.log(`Successfully aborted executing action (same pod): ${resultId}`);
      return;
    }

    // Step 2: Check if job is still queued in BullMQ
    const jobId = await this.getQueuedJobId(resultId);
    if (jobId && this.skillQueue) {
      this.logger.log(`Job ${resultId} is still queued, removing from queue`);
      const job = await this.skillQueue.getJob(jobId);
      if (job) {
        await job.remove();
        await this.deleteQueuedJob(resultId);
        // Update database status (only for queued jobs, no need to check status)
        await this.markAbortRequested(resultId, actualVersion, abortReason);
        this.logger.log(`Successfully aborted queued job: ${resultId}`);
        return;
      }
    }

    // Step 3: Neither in memory nor in queue - must be executing on another pod
    // Mark database status to 'failed' so the other pod can detect it
    this.logger.log(
      `Controller not found in memory for ${resultId}, marking database for cross-pod abort`,
    );
    await this.markAbortRequested(resultId, actualVersion, abortReason);
  }

  /**
   * Register a queued job in Redis for abortion support
   * Stores resultId -> jobId mapping for jobs in BullMQ queue
   */
  async registerQueuedJob(resultId: string, jobId: string): Promise<void> {
    const key = `skill:abort:${resultId}`;
    await this.redis.setex(key, 1800, jobId); // 30 minutes TTL
    this.logger.debug(`Registered queued job: ${resultId} -> ${jobId}`);
  }

  /**
   * Delete queued job mapping from Redis when job starts executing
   */
  async deleteQueuedJob(resultId: string): Promise<void> {
    const key = `skill:abort:${resultId}`;
    await this.redis.del(key);
    this.logger.debug(`Deleted queued job mapping for: ${resultId}`);
  }

  /**
   * Get job ID for a queued action
   */
  async getQueuedJobId(resultId: string): Promise<string | null> {
    const key = `skill:abort:${resultId}`;
    return await this.redis.get(key);
  }

  /**
   * Mark an action for abortion in the database (for cross-pod scenarios)
   *
   * Updates all non-terminal states to prevent race conditions during queue-to-execution transition
   */
  async markAbortRequested(resultId: string, version: number, reason: string): Promise<void> {
    const updated = await this.prisma.actionResult.updateMany({
      where: {
        resultId,
        version,
        status: { notIn: ['finish', 'failed'] }, // Update any non-terminal status
      },
      data: {
        status: 'failed',
        errors: JSON.stringify([reason]),
        errorType: 'userAbort',
      },
    });

    if (updated.count > 0) {
      this.logger.log(
        `Marked abort requested for action: ${resultId} v${version} by setting status to failed`,
      );
    } else {
      this.logger.warn(
        `Action ${resultId} v${version} not found or already in terminal state, skipping abort mark`,
      );
    }
  }

  /**
   * Check if an action has been requested to abort (for polling from executing pod)
   */
  async isAbortRequested(resultId: string, version: number): Promise<boolean> {
    const result = await this.prisma.actionResult.findFirst({
      where: { resultId, version },
      select: { status: true },
    });

    if (!result) {
      return false;
    }

    return result.status === 'failed';
  }
}
