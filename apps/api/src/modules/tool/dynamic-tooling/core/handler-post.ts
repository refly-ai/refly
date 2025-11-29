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
import type { SyncToolCreditUsageJobData } from '../../../credit/credit.dto';
import type { CreditService } from '../../../credit/credit.service';
import { ResourceHandler, calculateCredits } from '../../utils';

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
        processedResponse = await resourceHandler.persistOutputResources(
          processedResponse,
          request,
          context.responseSchema,
        );
      }

      // Step 3: Extract resource fields to top level for frontend accessibility
      processedResponse = extractFileIdToTopLevel(processedResponse);

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
 * Extract all resource fields (fileId, files) from nested response data to top level
 * This ensures frontend can easily access file references regardless of nesting depth
 *
 * @param response - Handler response to process
 * @returns Response with resource fields extracted to top level
 */
function extractFileIdToTopLevel(response: HandlerResponse): HandlerResponse {
  if (!response.success || !response.data || typeof response.data !== 'object') {
    return response;
  }

  const extractedResources: {
    fileId?: string;
    files?: Array<{ fileId: string; mimeType?: string; name?: string }>;
  } = {};

  /**
   * Recursively traverse object to find fileId and files fields
   */
  const findResources = (obj: unknown, depth = 0): void => {
    // Prevent infinite recursion
    if (depth > 10 || !obj || typeof obj !== 'object') {
      return;
    }

    const objRecord = obj as Record<string, unknown>;

    // Check for fileId field
    if ('fileId' in objRecord && typeof objRecord.fileId === 'string') {
      if (!extractedResources.fileId) {
        extractedResources.fileId = objRecord.fileId;
      }
    }

    // Check for files array field
    if ('files' in objRecord && Array.isArray(objRecord.files)) {
      if (!extractedResources.files) {
        extractedResources.files = objRecord.files
          .filter((file) => file && typeof file === 'object' && 'fileId' in file)
          .map((file) => ({
            fileId: String(file.fileId),
            mimeType: 'mimeType' in file ? String(file.mimeType) : undefined,
            name: 'name' in file ? String(file.name) : undefined,
          }));
      }
    }

    // Recursively traverse nested objects and arrays
    for (const value of Object.values(objRecord)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          findResources(item, depth + 1);
        }
      } else if (value && typeof value === 'object') {
        findResources(value, depth + 1);
      }
    }
  };

  // Find all resources in the response data
  findResources(response.data);

  // If resources found, add them to top level of response.data
  if (extractedResources.fileId || extractedResources.files?.length) {
    return {
      ...response,
      data: {
        ...(response.data as Record<string, unknown>),
        ...extractedResources,
      },
    };
  }

  return response;
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
