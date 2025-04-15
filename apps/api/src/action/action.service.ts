import { ActionDetail } from '@/action/action.dto';
import { PrismaService } from '@/common/prisma.service';
import { SubscriptionService } from '@/subscription/subscription.service';
import { Injectable } from '@nestjs/common';
import { ActionResultNotFoundError } from '@refly-packages/errors';
import { ActionResult } from '@prisma/client';
import { EntityType, GetActionResultData, User } from '@refly-packages/openapi-schema';
import { batchReplaceRegex, genActionResultID, pick } from '@refly-packages/utils';
import pLimit from 'p-limit';

@Injectable()
export class ActionService {
  constructor(
    private readonly prisma: PrismaService,
    private subscriptionService: SubscriptionService,
  ) {}

  async getActionResult(user: User, param: GetActionResultData['query']): Promise<ActionDetail> {
    const { resultId, version } = param;

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

    // If the result is executing and the last updated time is more than 3 minutes ago,
    // mark it as failed.
    if (result.status === 'executing' && result.updatedAt < new Date(Date.now() - 1000 * 60 * 3)) {
      const updatedResult = await this.prisma.actionResult.update({
        where: {
          pk: result.pk,
          status: 'executing',
        },
        data: {
          status: 'failed',
          errors: `["Execution timeout"]`,
        },
      });
      return updatedResult;
    }

    const modelList = await this.subscriptionService.getModelList();
    const modelInfo = modelList.find((model) => model.name === result.modelName);

    const steps = await this.prisma.actionStep.findMany({
      where: {
        resultId: result.resultId,
        version: result.version,
        deletedAt: null,
      },
      orderBy: { order: 'asc' },
    });

    return { ...result, steps, modelInfo };
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
}
