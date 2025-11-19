import { Injectable, Logger } from '@nestjs/common';
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

    // Verify that the action belongs to the user
    const result = await this.prisma.actionResult.findFirst({
      where: {
        resultId,
        version,
        uid: user.uid,
      },
    });

    if (!result) {
      throw new ActionResultNotFoundError();
    }

    await this.abortAction(user, result, reason);
  }
}
