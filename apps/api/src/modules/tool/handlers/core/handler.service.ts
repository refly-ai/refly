/**
 * Handler Service
 *
 * NestJS service for executing tool requests through adapters.
 * Orchestrates the complete request/response lifecycle:
 * 1. Pre-processing (credentials, validation)
 * 2. API execution via adapter
 * 3. Post-processing (billing, resource upload)
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  AdapterRequest,
  BillingConfig,
  HandlerConfig,
  HandlerContext,
  HandlerRequest,
  HandlerResponse,
} from '@refly/openapi-schema';
import { HandlerError } from '../../constant/constant';
import type { IAdapter } from '../../dynamic-tooling/adapters/adapter';
import type { ResourceHandler } from '../../utils';
import { DynamicPostHandlerService } from '../post/dynamic-post.service';
import { DynamicPreHandlerService } from '../pre/dynamic-pre.service';

/**
 * HTTP Handler configuration options
 * Used by HandlerService.execute() to configure tool execution
 */
export interface HttpHandlerOptions extends HandlerConfig {
  /** Billing configuration */
  billing?: BillingConfig;
  /** Whether to format response */
  formatResponse?: boolean;
  /** Whether to enable resource upload via ResourceHandler */
  enableResourceUpload?: boolean;
  /** ResourceHandler instance for output resource processing */
  resourceHandler: ResourceHandler;
}

/**
 * Handler Service
 *
 * Stateless service that orchestrates tool execution lifecycle.
 * Combines pre-processing, adapter execution, and post-processing.
 */
@Injectable()
export class HandlerService {
  private readonly logger = new Logger(HandlerService.name);

  constructor(
    private readonly handlerPreService: DynamicPreHandlerService,
    private readonly handlerPostService: DynamicPostHandlerService,
  ) {}

  /**
   * Execute a tool request through the complete handler lifecycle
   *
   * @param request - Handler request containing method, params, and user context
   * @param adapter - Adapter instance to execute the API call
   * @param options - Handler configuration options
   * @returns Promise resolving to handler response
   */
  async execute(
    request: HandlerRequest,
    adapter: IAdapter,
    options: HttpHandlerOptions,
  ): Promise<HandlerResponse> {
    // Create handler context
    const context: HandlerContext = {
      credentials: options.credentials,
      responseSchema: options.responseSchema,
      startTime: Date.now(),
    };

    try {
      // Step 1: Pre-process request (credential injection)
      let processedRequest = request;
      try {
        processedRequest = await this.handlerPreService.processRequest(request, context, {
          credentials: options.credentials,
        });
      } catch (error) {
        this.logger.error(
          `Pre-processing failed: ${(error as Error).message}`,
          (error as Error).stack,
        );
        return this.createErrorResponse(
          'PRE_HANDLER_ERROR',
          `Pre-processing failed: ${(error as Error).message}`,
        );
      }

      // Step 2: Execute the API call via adapter
      let response: HandlerResponse;
      try {
        response = await this.executeRequest(processedRequest, adapter, options, context);
      } catch (error) {
        this.logger.error(
          `Request execution failed: ${(error as Error).message}`,
          (error as Error).stack,
        );
        return this.createErrorResponse(
          (error as HandlerError).code || 'EXECUTION_ERROR',
          (error as Error).message,
        );
      }

      // Step 3: Post-process response (billing, resource upload)
      let processedResponse = response;
      if (processedResponse.success) {
        try {
          processedResponse = await this.handlerPostService.processResponse(
            processedRequest,
            processedResponse,
            context,
            {
              billing: options.billing,
              enableResourceUpload: options.enableResourceUpload,
              resourceHandler: options.resourceHandler,
            },
          );
        } catch (error) {
          this.logger.error(
            `Post-processing failed: ${(error as Error).message}`,
            (error as Error).stack,
          );
          // Don't fail the request if post-processing fails
          // The API call was successful, so return the response
        }
      }

      return processedResponse;
    } catch (error) {
      this.logger.error(
        `Unexpected error in handler: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return this.createErrorResponse('HANDLER_ERROR', (error as Error).message);
    }
  }

  /**
   * Execute the actual API request via adapter
   */
  private async executeRequest(
    request: HandlerRequest,
    adapter: IAdapter,
    options: HttpHandlerOptions,
    context: HandlerContext,
  ): Promise<HandlerResponse> {
    try {
      // Build adapter request
      const adapterRequest: AdapterRequest = {
        endpoint: options.endpoint,
        method: options.method || 'POST',
        params: request.params,
        credentials: context.credentials,
        timeout: options.timeout,
        useFormData: options.useFormData,
      };

      // Execute via adapter
      const adapterResponse = await adapter.execute(adapterRequest);

      // Check if response indicates an error
      if (adapterResponse.status && adapterResponse.status >= 400) {
        return this.createErrorResponse(
          `HTTP_${adapterResponse.status}`,
          `Request failed with status ${adapterResponse.status}`,
        );
      }

      // Build success response
      return this.createSuccessResponse(adapterResponse.data);
    } catch (error) {
      this.logger.error(
        `Request execution failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Create an error response
   */
  private createErrorResponse(code: string, message: string): HandlerResponse {
    return {
      success: false,
      error: message,
      errorCode: code,
    };
  }

  /**
   * Create a success response
   * Handles different data types: Buffer, object, or primitive values
   */
  private createSuccessResponse(data: unknown): HandlerResponse {
    // Preserve Buffer data directly for binary responses
    if (Buffer.isBuffer(data)) {
      return {
        success: true,
        data: data as unknown as Record<string, unknown>,
      };
    }

    // Handle object data by spreading
    if (typeof data === 'object' && data !== null) {
      return {
        success: true,
        data: data as Record<string, unknown>,
      };
    }

    // Wrap primitive values in result field
    return {
      success: true,
      data: { result: data },
    };
  }
}
