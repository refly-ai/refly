/**
 * Dynamic Post-Handler Service
 *
 * NestJS service for post-processing dynamic tool execution responses.
 * Handles billing calculation and resource uploads for HTTP-based dynamic tools.
 *
 * This is the service-based version of createBasePostHandler().
 */

import { Injectable, Logger } from '@nestjs/common';
import type { HandlerContext, HandlerRequest, HandlerResponse } from '@refly/openapi-schema';
import { BillingService } from '../../billing/billing.service';
import { MissingCanvasContextError } from '../../errors/resource-errors';
import { extractFileIdToTopLevel } from '../../utils';
import { BasePostHandlerService, type PostHandlerConfig } from './base-post.service';

/**
 * Dynamic Post-Handler Service
 *
 * Processes responses after dynamic tool execution:
 * 1. Billing calculation and credit deduction
 * 2. Resource upload for output files/images
 */
@Injectable()
export class DynamicPostHandlerService extends BasePostHandlerService {
  protected readonly logger = new Logger(DynamicPostHandlerService.name);

  constructor(private readonly billingService: BillingService) {
    super();
  }

  /**
   * Process response after tool execution
   *
   * @param request - Original handler request
   * @param response - Tool execution response
   * @param context - Handler context with credentials and schema
   * @param config - Post-handler configuration
   * @returns Processed response with billing metadata
   */
  async processResponse(
    request: HandlerRequest,
    response: HandlerResponse,
    context: HandlerContext,
    config: PostHandlerConfig,
  ): Promise<HandlerResponse> {
    // Skip processing if response failed
    if (!response.success) {
      return response;
    }

    try {
      let processedResponse = response;

      // Step 1: Process billing (only if billing enabled and user present)
      if (config.billing?.enabled && request.user?.uid) {
        processedResponse = await this.processBilling(request, processedResponse, context, config);
      }

      // Step 2: Process resource uploads
      if (config.enableResourceUpload && config.resourceHandler && context.responseSchema) {
        processedResponse = await this.processResourceUploads(
          request,
          processedResponse,
          context,
          config,
        );
      }

      // Preserve legacy behavior for frontend consumers that rely on top-level file fields
      return extractFileIdToTopLevel(processedResponse);
    } catch (error) {
      this.logger.error(
        `Post-processing failed for ${request.provider}.${request.method}: ${error.message}`,
      );
      // Return original response on error to not block execution
      return response;
    }
  }

  /**
   * Process billing for tool execution
   *
   * Calculates credits and adds billing metadata to response
   */
  private async processBilling(
    request: HandlerRequest,
    response: HandlerResponse,
    _context: HandlerContext,
    config: PostHandlerConfig,
  ): Promise<HandlerResponse> {
    try {
      const billingResult = await this.billingService.processBilling({
        uid: request.user!.uid,
        toolName: request.method,
        toolsetKey:
          (request.metadata?.toolsetKey as string) ||
          (request.provider as string) ||
          'unknown_toolset',
        billingConfig: config.billing,
        params: request.params,
        // Dynamic billing fields (new)
        input: request.params,
        output: response.data as Record<string, unknown>,
        requestSchema: request.metadata?.requestSchema as string,
        responseSchema: request.metadata?.responseSchema as string,
      });

      // Add billing metadata to response if credits were charged
      if (billingResult.discountedPrice > 0) {
        return {
          ...response,
          metadata: {
            ...response.metadata,
            discountedPrice: billingResult.discountedPrice,
            originalPrice: billingResult.originalPrice,
          },
        };
      }

      return response;
    } catch (error) {
      this.logger.error(
        `Billing failed for ${request.provider}.${request.method}: ${error.message}`,
      );
      // Return original response if billing fails
      return response;
    }
  }

  /**
   * Process resource uploads (images, files, etc.)
   *
   * Uploads resources from response and replaces with CDN URLs
   */
  private async processResourceUploads(
    request: HandlerRequest,
    response: HandlerResponse,
    context: HandlerContext,
    config: PostHandlerConfig,
  ): Promise<HandlerResponse> {
    try {
      const uploadedResponse = await config.resourceHandler!.persistOutputResources(
        response,
        request,
        context.responseSchema!,
      );

      this.logger.debug(`Resource upload completed for ${request.provider}.${request.method}`);

      return uploadedResponse;
    } catch (error) {
      if (error instanceof MissingCanvasContextError) {
        throw error;
      }
      this.logger.warn(
        `Resource upload failed for ${request.provider}.${request.method}: ${error.message}`,
      );
      // Return original response if upload fails (non-critical)
      return response;
    }
  }
}
