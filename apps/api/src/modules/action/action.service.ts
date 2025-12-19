import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ActionResultNotFoundError } from '@refly/errors';
import {
  AbortActionRequest,
  ActionErrorType,
  EntityType,
  GetActionResultData,
  User,
} from '@refly/openapi-schema';
import {
  batchReplaceRegex,
  genActionResultID,
  genActionMessageID,
  pick,
  safeParseJSON,
} from '@refly/utils';
import pLimit from 'p-limit';
import {
  ActionResult,
  ActionMessage as ActionMessageModel,
  ToolCallResult as ToolCallResultModel,
} from '@prisma/client';
import { ActionDetail, actionMessagePO2DTO, sanitizeToolOutput } from '../action/action.dto';
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
  sanitizeForDisplay?: boolean;
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
    const { resultId, version, includeFiles = false, sanitizeForDisplay = false } = param;

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

    const enrichedResult = await this.enrichActionResultWithDetails(user, result, {
      sanitizeForDisplay,
    });

    if (includeFiles) {
      enrichedResult.files = await this.driveService.listAllDriveFiles(user, {
        canvasId: result.targetId,
        source: 'agent',
        resultId,
        includeContent: true,
        ...(version ? { resultVersion: version } : { scope: 'present' }),
      });
    }

    return enrichedResult;
  }

  private async enrichActionResultWithDetails(
    user: User,
    result: ActionResult,
    options?: { sanitizeForDisplay?: boolean },
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

    // Get messages for this action result
    const messages = await this.prisma.actionMessage.findMany({
      where: {
        resultId: result.resultId,
        version: result.version,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Create a map of tool call results by callId for quick lookup
    const toolCallResultMap = new Map<string, ToolCallResultModel>();
    if (toolCalls?.length) {
      for (const toolCall of toolCalls) {
        toolCallResultMap.set(toolCall.callId, toolCall);
      }
    }

    // Enrich messages with tool call results for tool type messages
    const enrichedMessages = messages.map((message: ActionMessageModel) => {
      const enrichedMessage = actionMessagePO2DTO(message);

      // For tool type messages, find and attach the corresponding tool call result
      if (message.type === 'tool' && message.toolCallId) {
        const toolCallResult = toolCallResultMap.get(message.toolCallId);
        if (toolCallResult) {
          const rawOutput = safeParseJSON(toolCallResult.output || '{}') ?? {
            rawOutput: toolCallResult.output,
          };
          // Apply sanitization if needed
          const output = options?.sanitizeForDisplay
            ? sanitizeToolOutput(toolCallResult.toolName, rawOutput)
            : rawOutput;

          // Attach the tool call result to the message
          enrichedMessage.toolCallResult = {
            callId: toolCallResult.callId,
            uid: toolCallResult.uid,
            toolsetId: toolCallResult.toolsetId,
            toolName: toolCallResult.toolName,
            stepName: toolCallResult.stepName,
            input: safeParseJSON(toolCallResult.input || '{}') ?? {},
            output,
            error: toolCallResult.error || '',
            status: toolCallResult.status as 'executing' | 'completed' | 'failed',
            createdAt: toolCallResult.createdAt.getTime(),
            updatedAt: toolCallResult.updatedAt.getTime(),
            deletedAt: toolCallResult.deletedAt?.getTime(),
          };
        }
      }

      return enrichedMessage;
    });

    if (!steps || steps.length === 0) {
      return { ...result, steps: [], messages: enrichedMessages, modelInfo };
    }

    const stepsWithToolCalls = this.toolCallService.attachToolCallsToSteps(steps, toolCalls);
    return { ...result, steps: stepsWithToolCalls, messages: enrichedMessages, modelInfo };
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
          // Return result with empty steps, messages and no model info on error
          return { ...result, steps: [], messages: [], modelInfo: null };
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
      fileIdMap?: Record<string, string>;
    },
    options?: { checkOwnership?: boolean },
  ) {
    const { sourceResultIds, targetId, targetType, replaceEntityMap, fileIdMap } = param;

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

    // Create a combined replacement map that includes both entity IDs and file IDs
    const combinedReplaceMap: Record<string, string> = { ...replaceEntityMap };
    if (fileIdMap) {
      Object.assign(combinedReplaceMap, fileIdMap);
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
            context: batchReplaceRegex(context ?? '{}', combinedReplaceMap),
            history: batchReplaceRegex(history ?? '[]', combinedReplaceMap),
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
              artifacts: batchReplaceRegex(JSON.stringify(step.artifacts), combinedReplaceMap),
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
   * Duplicate ActionMessage records for given resultIds
   * @param param.sourceResultIds - Source result IDs to duplicate messages from
   * @param param.resultIdMap - Map of old resultId -> new resultId
   * @param param.replaceIdMap - Optional map for replacing IDs in content fields (includes entityIds and fileIds)
   * @param param.callIdMap - Optional map for replacing toolCallId references (old callId -> new callId)
   */
  async duplicateActionMessages(param: {
    sourceResultIds: string[];
    resultIdMap: Record<string, string>;
    replaceIdMap?: Record<string, string>;
    callIdMap?: Record<string, string>;
  }) {
    const { sourceResultIds, resultIdMap, replaceIdMap, callIdMap } = param;

    if (!sourceResultIds.length) {
      return [];
    }

    // Get all action messages for the given resultIds (latest version only)
    // Order by createdAt to preserve message ordering
    const allMessages = await this.prisma.actionMessage.findMany({
      where: {
        resultId: { in: sourceResultIds },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!allMessages?.length) {
      return [];
    }

    // Filter to keep only the latest version messages for each resultId
    const latestVersionMap = new Map<string, number>();
    for (const msg of allMessages) {
      const currentMax = latestVersionMap.get(msg.resultId) ?? -1;
      if (msg.version > currentMax) {
        latestVersionMap.set(msg.resultId, msg.version);
      }
    }

    const filteredMessages = allMessages.filter(
      (msg) => msg.version === latestVersionMap.get(msg.resultId),
    );

    if (!filteredMessages.length) {
      return [];
    }

    // Create new messages with new IDs, preserving order
    const newMessages = filteredMessages.map((msg) => {
      const newResultId = resultIdMap[msg.resultId];
      if (!newResultId) {
        return null; // Skip if no mapping exists
      }

      let content = msg.content;
      let toolCallMeta = msg.toolCallMeta;

      // Apply ID replacements if provided
      if (replaceIdMap && Object.keys(replaceIdMap).length > 0) {
        content = batchReplaceRegex(content, replaceIdMap);
        if (toolCallMeta) {
          toolCallMeta = batchReplaceRegex(toolCallMeta, replaceIdMap);
        }
      }

      // Replace toolCallId with new callId if mapping exists
      let newToolCallId = msg.toolCallId;
      if (msg.toolCallId && callIdMap && callIdMap[msg.toolCallId]) {
        newToolCallId = callIdMap[msg.toolCallId];
      }

      return {
        messageId: genActionMessageID(),
        resultId: newResultId,
        version: 0, // Reset version to 0 for the new duplicate
        type: msg.type,
        content,
        reasoningContent: msg.reasoningContent,
        usageMeta: msg.usageMeta,
        toolCallMeta,
        toolCallId: newToolCallId,
      };
    });

    const validMessages = newMessages.filter((msg) => msg !== null);

    if (validMessages.length > 0) {
      await this.prisma.actionMessage.createMany({
        data: validMessages,
      });
    }

    return validMessages;
  }

  /**
   * Duplicate ToolCallResult records for given resultIds
   * @param user - User performing the duplication
   * @param param.sourceResultIds - Source result IDs to duplicate tool calls from
   * @param param.resultIdMap - Map of old resultId -> new resultId
   * @param param.replaceIdMap - Optional map for replacing IDs in input/output fields (includes entityIds and fileIds)
   * @returns Object containing the created tool calls and callIdMap (old callId -> new callId)
   */
  async duplicateToolCallResults(
    user: User,
    param: {
      sourceResultIds: string[];
      resultIdMap: Record<string, string>;
      replaceIdMap?: Record<string, string>;
    },
  ): Promise<{ toolCalls: any[]; callIdMap: Record<string, string> }> {
    const { sourceResultIds, resultIdMap, replaceIdMap } = param;
    const callIdMap: Record<string, string> = {};

    if (!sourceResultIds.length) {
      return { toolCalls: [], callIdMap };
    }

    // Get all tool call results for the given resultIds (latest version only)
    const allToolCalls = await this.prisma.toolCallResult.findMany({
      where: {
        resultId: { in: sourceResultIds },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!allToolCalls?.length) {
      return { toolCalls: [], callIdMap };
    }

    // Filter to keep only the latest version tool calls for each resultId
    const latestVersionMap = new Map<string, number>();
    for (const tc of allToolCalls) {
      const currentMax = latestVersionMap.get(tc.resultId) ?? -1;
      if (tc.version > currentMax) {
        latestVersionMap.set(tc.resultId, tc.version);
      }
    }

    const filteredToolCalls = allToolCalls.filter(
      (tc) => tc.version === latestVersionMap.get(tc.resultId),
    );

    if (!filteredToolCalls.length) {
      return { toolCalls: [], callIdMap };
    }

    // Create new tool call results with new IDs and build callIdMap
    const newToolCalls = filteredToolCalls.map((tc) => {
      const newResultId = resultIdMap[tc.resultId];
      if (!newResultId) {
        return null; // Skip if no mapping exists
      }

      let input = tc.input;
      let output = tc.output;

      // Apply ID replacements if provided
      if (replaceIdMap && Object.keys(replaceIdMap).length > 0) {
        input = batchReplaceRegex(input, replaceIdMap);
        output = batchReplaceRegex(output, replaceIdMap);
      }

      const newCallId = this.toolCallService.generateToolCallId({
        resultId: newResultId,
        version: 0,
        toolsetId: tc.toolsetId,
        toolName: tc.toolName,
      });
      // Build callIdMap for ActionMessage.toolCallId replacement
      callIdMap[tc.callId] = newCallId;

      return {
        callId: newCallId,
        resultId: newResultId,
        version: 0, // Reset version to 0 for the new duplicate
        uid: user.uid,
        toolsetId: tc.toolsetId,
        toolName: tc.toolName,
        stepName: tc.stepName,
        input,
        output,
        status: tc.status,
        error: tc.error,
      };
    });

    const validToolCalls = newToolCalls.filter((tc) => tc !== null);

    if (validToolCalls.length > 0) {
      await this.prisma.toolCallResult.createMany({
        data: validToolCalls,
      });
    }

    return { toolCalls: validToolCalls, callIdMap };
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

  async abortActionFromReq(
    user: User,
    req: AbortActionRequest,
    reason?: string,
    errorType?: ActionErrorType,
  ) {
    const { resultId, version } = req;
    const startTime = Date.now();

    this.logger.log(
      `[WORKFLOW_ABORT][ACTION] resultId=${resultId} version=${version} phase=start reason="${reason || 'User requested abort'}"`,
    );

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
        `[WORKFLOW_ABORT][ACTION] resultId=${resultId} version=${version} phase=version_fallback`,
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
      this.logger.error(
        `[WORKFLOW_ABORT][ACTION] resultId=${resultId} phase=not_found elapsed=${Date.now() - startTime}ms`,
      );
      throw new ActionResultNotFoundError();
    }

    const abortReason = reason || 'User requested abort';
    const actualVersion = result.version;
    const currentStatus = result.status;

    this.logger.log(
      `[WORKFLOW_ABORT][ACTION] resultId=${resultId} actualVersion=${actualVersion} currentStatus=${currentStatus} phase=found`,
    );

    await this.markAbortRequested(resultId, actualVersion, abortReason, errorType);

    // Step 1: Check if controller is in memory (same pod) - FASTEST
    // Note: If controller exists, Redis mapping has already been deleted when execution started
    const entry = this.activeAbortControllers.get(resultId);
    if (entry) {
      entry.controller.abort(abortReason);
      this.unregisterAbortController(resultId);
      this.logger.log(
        `[WORKFLOW_ABORT][ACTION] resultId=${resultId} phase=controller_aborted method=same_pod elapsed=${Date.now() - startTime}ms`,
      );
    } else {
      this.logger.log(
        `[WORKFLOW_ABORT][ACTION] resultId=${resultId} phase=no_controller method=cross_pod_or_queued`,
      );
    }

    // Step 2: Check if job is still queued in BullMQ
    const jobId = await this.getQueuedJobId(resultId);
    if (jobId && this.skillQueue) {
      const job = await this.skillQueue.getJob(jobId);
      if (job) {
        await job.remove();
        await this.deleteQueuedJob(resultId);
        this.logger.log(
          `[WORKFLOW_ABORT][ACTION] resultId=${resultId} jobId=${jobId} phase=queue_job_removed elapsed=${Date.now() - startTime}ms`,
        );
      } else {
        this.logger.log(
          `[WORKFLOW_ABORT][ACTION] resultId=${resultId} jobId=${jobId} phase=queue_job_not_found`,
        );
      }
    }

    this.logger.log(
      `[WORKFLOW_ABORT][ACTION] resultId=${resultId} phase=completed elapsed=${Date.now() - startTime}ms`,
    );
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
  async markAbortRequested(
    resultId: string,
    version: number,
    reason: string,
    errorType: ActionErrorType = 'userAbort',
  ): Promise<void> {
    const updated = await this.prisma.actionResult.updateMany({
      where: {
        resultId,
        version,
      },
      data: {
        status: 'failed',
        errors: JSON.stringify([reason]),
        errorType,
      },
    });

    if (updated.count > 0) {
      this.logger.log(
        `[WORKFLOW_ABORT][DB] resultId=${resultId} version=${version} phase=status_updated updatedCount=${updated.count}`,
      );
    } else {
      this.logger.warn(
        `[WORKFLOW_ABORT][DB] resultId=${resultId} version=${version} phase=skip_update reason=not_found_or_terminal`,
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
