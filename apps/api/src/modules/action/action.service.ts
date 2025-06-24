import { ActionDetail } from '../action/action.dto';
import { PrismaService } from '../common/prisma.service';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ActionResultNotFoundError } from '@refly/errors';
import { ActionResult } from '../../generated/client';
import { EntityType, GetActionResultData, User } from '@refly/openapi-schema';
import { batchReplaceRegex, genActionResultID, pick } from '@refly/utils';
import pLimit from 'p-limit';
import { ProviderService } from '../provider/provider.service';
import { providerItem2ModelInfo } from '../provider/provider.dto';
import { ConfigService } from '@nestjs/config';

// Interface for tracking abort controller with metadata
interface AbortControllerEntry {
  controller: AbortController;
  resultId: string;
  createdAt: number;
  uid?: string; // Optional user identifier for better tracking
}

@Injectable()
export class ActionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActionService.name);

  // Store active abort controllers with metadata for better management
  private activeAbortControllers = new Map<string, AbortControllerEntry>();

  // Cleanup interval for expired controllers
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Configurable timeouts
  private readonly ABORT_CONTROLLER_TIMEOUT: number;
  private readonly CLEANUP_INTERVAL: number;
  private readonly STALE_RESULT_THRESHOLD: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: ProviderService,
    private readonly config: ConfigService,
  ) {
    // Load configuration with fallback defaults
    this.ABORT_CONTROLLER_TIMEOUT =
      this.config.get<number>('ABORT_CONTROLLER_TIMEOUT') || 30 * 60 * 1000; // 30 minutes
    this.CLEANUP_INTERVAL = this.config.get<number>('CLEANUP_INTERVAL') || 5 * 60 * 1000; // 5 minutes
    this.STALE_RESULT_THRESHOLD =
      this.config.get<number>('STALE_RESULT_THRESHOLD') || 60 * 60 * 1000; // 1 hour

    this.logger.log(
      `Initialized with timeouts: controller=${this.ABORT_CONTROLLER_TIMEOUT}ms, ` +
        `cleanup=${this.CLEANUP_INTERVAL}ms, stale=${this.STALE_RESULT_THRESHOLD}ms`,
    );
  }

  async onModuleInit() {
    this.logger.log('Initializing ActionService with memory leak prevention measures');

    // Start periodic cleanup
    this.startPeriodicCleanup();

    // Recover from potential previous crashes
    await this.recoverFromPreviousCrashes();
  }

  async onModuleDestroy() {
    this.logger.log('Destroying ActionService, cleaning up resources');

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Abort all active controllers
    await this.abortAllActiveControllers('Service shutdown');

    // Clear the map
    this.activeAbortControllers.clear();
  }

  /**
   * Start periodic cleanup of expired abort controllers
   */
  private startPeriodicCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredControllers();
    }, this.CLEANUP_INTERVAL);

    this.logger.log(`Started periodic cleanup with interval: ${this.CLEANUP_INTERVAL}ms`);
  }

  /**
   * Clean up expired abort controllers
   */
  private cleanupExpiredControllers() {
    const now = Date.now();
    const expiredEntries: string[] = [];

    for (const [resultId, entry] of this.activeAbortControllers.entries()) {
      const age = now - entry.createdAt;

      if (age > this.ABORT_CONTROLLER_TIMEOUT) {
        this.logger.warn(
          `Found expired abort controller for action: ${resultId}, age: ${Math.round(age / 1000)}s`,
        );

        // Abort the expired controller
        try {
          if (!entry.controller.signal.aborted) {
            entry.controller.abort('Timeout cleanup');
          }
        } catch (error) {
          this.logger.error(`Error aborting expired controller for ${resultId}: ${error.message}`);
        }

        expiredEntries.push(resultId);
      }
    }

    // Remove expired entries
    for (const resultId of expiredEntries) {
      this.activeAbortControllers.delete(resultId);
    }

    if (expiredEntries.length > 0) {
      this.logger.log(`Cleaned up ${expiredEntries.length} expired abort controllers`);
    }

    // Log current state for monitoring
    const activeCount = this.activeAbortControllers.size;
    if (activeCount > 0) {
      this.logger.debug(`Active abort controllers: ${activeCount}`);
    }
  }

  /**
   * Recover from potential previous crashes by cleaning up stale database records
   */
  private async recoverFromPreviousCrashes() {
    try {
      this.logger.log('Checking for stale action results from previous crashes');

      // Find action results that are still in 'executing' state
      // These might be left over from previous crashes
      const staleResults = await this.prisma.actionResult.findMany({
        where: {
          status: 'executing',
          // Consider results older than 1 hour as potentially stale
          createdAt: {
            lt: new Date(Date.now() - this.STALE_RESULT_THRESHOLD),
          },
        },
        select: {
          pk: true,
          resultId: true,
          uid: true,
          createdAt: true,
        },
      });

      if (staleResults.length > 0) {
        this.logger.warn(`Found ${staleResults.length} potentially stale action results`);

        // Update stale results to failed status
        const updatePromises = staleResults.map((result) =>
          this.prisma.actionResult.update({
            where: { pk: result.pk },
            data: {
              status: 'failed',
              errors: JSON.stringify(['System recovery: marked as failed due to potential crash']),
            },
          }),
        );

        await Promise.all(updatePromises);

        this.logger.log(`Marked ${staleResults.length} stale action results as failed`);
      } else {
        this.logger.log('No stale action results found');
      }
    } catch (error) {
      this.logger.error(`Error during crash recovery: ${error.message}`);
    }
  }

  /**
   * Abort all active controllers (used during shutdown)
   */
  private async abortAllActiveControllers(reason: string) {
    const activeCount = this.activeAbortControllers.size;

    if (activeCount === 0) {
      return;
    }

    this.logger.log(`Aborting ${activeCount} active controllers: ${reason}`);

    const abortPromises: Promise<void>[] = [];

    for (const [resultId, entry] of this.activeAbortControllers.entries()) {
      abortPromises.push(
        (async () => {
          try {
            if (!entry.controller.signal.aborted) {
              entry.controller.abort(reason);
            }

            // Update database status if possible
            if (entry.uid) {
              await this.prisma.actionResult.updateMany({
                where: {
                  resultId,
                  uid: entry.uid,
                  status: 'executing',
                },
                data: {
                  status: 'failed',
                  errors: JSON.stringify([reason]),
                },
              });
            }
          } catch (error) {
            this.logger.error(`Error aborting controller for ${resultId}: ${error.message}`);
          }
        })(),
      );
    }

    await Promise.allSettled(abortPromises);
  }

  /**
   * Get statistics about active abort controllers
   */
  getAbortControllerStats() {
    const now = Date.now();
    const stats = {
      total: this.activeAbortControllers.size,
      byAge: {
        lessThan5Min: 0,
        between5And15Min: 0,
        between15And30Min: 0,
        moreThan30Min: 0,
      },
    };

    for (const entry of this.activeAbortControllers.values()) {
      const age = now - entry.createdAt;
      const ageMinutes = age / (60 * 1000);

      if (ageMinutes < 5) {
        stats.byAge.lessThan5Min++;
      } else if (ageMinutes < 15) {
        stats.byAge.between5And15Min++;
      } else if (ageMinutes < 30) {
        stats.byAge.between15And30Min++;
      } else {
        stats.byAge.moreThan30Min++;
      }
    }

    return stats;
  }

  /**
   * Manually trigger cleanup of expired abort controllers
   */
  async manualCleanupExpiredControllers() {
    const initialCount = this.activeAbortControllers.size;
    this.cleanupExpiredControllers();
    const finalCount = this.activeAbortControllers.size;
    const cleanedUp = initialCount - finalCount;

    this.logger.log(`Manual cleanup completed: ${cleanedUp} controllers cleaned up`);

    return {
      initialCount,
      finalCount,
      cleanedUp,
      timestamp: new Date().toISOString(),
    };
  }

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

    const item = await this.providerService.findLLMProviderItemByModelID(user, result.modelName);
    const modelInfo = item ? providerItem2ModelInfo(item) : null;

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

  /**
   * Register an abort controller for a running action
   */
  registerAbortController(resultId: string, controller: AbortController, uid?: string) {
    this.activeAbortControllers.set(resultId, {
      controller,
      resultId,
      createdAt: Date.now(),
      uid,
    });
    this.logger.log(`Registered abort controller for action: ${resultId}`);
  }

  /**
   * Unregister an abort controller when action completes
   */
  unregisterAbortController(resultId: string) {
    const entry = this.activeAbortControllers.get(resultId);
    if (entry) {
      this.activeAbortControllers.delete(resultId);
      this.logger.log(`Unregistered abort controller for action: ${resultId}`);
    }
  }

  /**
   * Abort a running action
   */
  async abortAction(user: User, { resultId }: { resultId: string }) {
    this.logger.log(`Attempting to abort action: ${resultId} for user: ${user.uid}`);

    // Verify that the action belongs to the user
    const result = await this.prisma.actionResult.findFirst({
      where: {
        resultId,
        uid: user.uid,
      },
    });

    if (!result) {
      throw new ActionResultNotFoundError();
    }

    // Get the abort controller for this action
    const entry = this.activeAbortControllers.get(resultId);

    if (entry) {
      // Abort the action
      entry.controller.abort('User requested abort');
      this.logger.log(`Aborted action: ${resultId}`);

      // Update the action status to failed
      await this.prisma.actionResult.update({
        where: {
          pk: result.pk,
        },
        data: {
          status: 'failed',
          errors: JSON.stringify(['User aborted the action']),
        },
      });
    } else {
      this.logger.warn(`No active abort controller found for action: ${resultId}`);
    }
  }
}
