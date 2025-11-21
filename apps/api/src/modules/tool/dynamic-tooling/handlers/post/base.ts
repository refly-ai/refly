/**
 * Base post-handler
 * Handles billing calculation and resource upload via ResourceHandler
 */

import { Logger } from '@nestjs/common';
import type {
  BillingConfig,
  HandlerContext,
  HandlerRequest,
  HandlerResponse,
} from '@refly/openapi-schema';
import { calculateCredits, ResourceHandler } from '../../../utils';
import type { CreditService } from '../../../../credit/credit.service';
import type { SyncToolCreditUsageJobData } from '../../../../credit/credit.dto';

/**
 * Configuration for base post-handler
 */
export interface BasePostHandlerConfig {
  /**
   * Billing configuration
   */
  billing?: BillingConfig;
  /**
   * Credit service for recording usage
   */
  creditService?: CreditService;
  /**
   * ResourceHandler instance for output resource processing
   */
  resourceHandler?: ResourceHandler;
}

/**
 * Create base post-handler
 * Handles billing calculation and resource upload in a unified pipeline:
 * 1. Validate response success status
 * 2. Process billing (if configured)
 *
 * @param config - Configuration for billing and resource upload
 * @returns Post-handler function
 */
export function createBasePostHandler(
  config: BasePostHandlerConfig = {},
): (
  response: HandlerResponse,
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerResponse> {
  const logger = new Logger('BasePostHandler');
  // Use provided ResourceHandler instance
  const resourceHandler = config.resourceHandler;

  return async (
    response: HandlerResponse,
    request: HandlerRequest,
    context: HandlerContext,
  ): Promise<HandlerResponse> => {
    // Early return if request failed
    if (!response.success) {
      return response;
    }

    try {
      let processedResponse = response;

      // Step 1: Process billing
      if (config.billing?.enabled) {
        processedResponse = await processBilling(
          processedResponse,
          request,
          config.billing,
          config.creditService,
          logger,
        );
      }

      // Step 2: Upload resources using ResourceHandler
      if (resourceHandler && context.responseSchema) {
        processedResponse = await resourceHandler.postprocessOutputResources(
          processedResponse,
          request,
          context.responseSchema,
        );
      }

      return processedResponse;
    } catch (error) {
      logger.error(
        `Post-processing failed for ${request.method}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Return original response if post-processing fails
      return response;
    }
  };
}

/**
 * Process billing calculation
 * Calculates credit cost based on billing configuration and adds it to response metadata
 *
 * @param response - Handler response to process
 * @param request - Handler request containing params for billing calculation
 * @param billingConfig - Billing configuration (type, rate, etc.)
 * @param logger - Logger instance
 * @returns Response with billing metadata added
 */
async function processBilling(
  response: HandlerResponse,
  request: HandlerRequest,
  billingConfig: BillingConfig,
  creditService: CreditService | undefined,
  logger: Logger,
): Promise<HandlerResponse> {
  try {
    const credits = calculateCredits(billingConfig, request.params);

    if (credits > 0) {
      logger.log(
        `Calculated ${credits} credits for ${request.provider}.${request.method} (type: ${billingConfig.type})`,
      );

      // Record credit usage if service and uid are available
      if (creditService && request.user?.uid) {
        const jobData: SyncToolCreditUsageJobData = {
          uid: request.user.uid,
          creditCost: credits,
          timestamp: new Date(),
          toolsetName:
            (request.metadata?.toolsetKey as string) ||
            (request.provider as string) ||
            'unknown_toolset',
          toolName: request.method,
        };
        try {
          await creditService.syncToolCreditUsage(jobData);
        } catch (err) {
          logger.error(
            `Failed to sync credit usage for ${request.provider}.${request.method}: ${
              (err as Error).message
            }`,
          );
        }
      }

      return {
        ...response,
        metadata: {
          ...response.metadata,
          creditCost: credits,
          billingType: billingConfig.type,
        },
      };
    }
    return response;
  } catch (error) {
    logger.error(
      `Failed to calculate credits for ${request.provider}.${request.method}: ${(error as Error).message}`,
      (error as Error).stack,
    );
    // Don't fail the request if billing calculation fails
    return response;
  }
}
