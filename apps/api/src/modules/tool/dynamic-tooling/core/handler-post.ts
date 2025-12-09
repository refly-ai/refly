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
import type { BillingService } from '../../billing/billing.service';
import { ResourceHandler } from '../../utils';

/**
 * Configuration for base post-handler
 */
export interface BasePostHandlerConfig {
  /**
   * Billing configuration
   */
  billing?: BillingConfig;
  /**
   * Billing service for recording usage
   */
  billingService?: BillingService;
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
      if (config.billing?.enabled && config.billingService && request.user?.uid) {
        const billingResult = await config.billingService.processBilling({
          uid: request.user.uid,
          toolName: request.method,
          toolsetKey:
            (request.metadata?.toolsetKey as string) ||
            (request.provider as string) ||
            'unknown_toolset',
          billingConfig: config.billing,
          params: request.params,
        });

        if (billingResult.discountedPrice > 0) {
          processedResponse = {
            ...processedResponse,
            metadata: {
              ...processedResponse.metadata,
              discountedPrice: billingResult.discountedPrice,
              originalPrice: billingResult.originalPrice,
            },
          };
        }
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
            url: file.url,
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
