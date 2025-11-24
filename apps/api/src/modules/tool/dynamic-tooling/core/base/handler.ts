/**
 * Base handler abstract class
 * Provides common functionality for all handlers
 */

import { Logger } from '@nestjs/common';
import type { IAdapter } from '../interfaces';
import type {
  HandlerConfig,
  HandlerContext,
  HandlerRequest,
  HandlerResponse,
} from '@refly/openapi-schema';
import type { PreHandler, PostHandler } from '../../handlers/types';
import { HandlerError } from '../../handlers/types';
import { IHandler } from '../interfaces/handler';

/**
 * Base handler implementation
 * Handles the complete request/response lifecycle with pre/post handler support
 */
export abstract class BaseHandler implements IHandler {
  protected readonly logger: Logger;
  protected preHandler: PreHandler;
  protected postHandler: PostHandler;
  protected readonly context: HandlerContext;

  constructor(
    protected readonly adapter: IAdapter,
    protected readonly config: HandlerConfig,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.context = {
      credentials: config.credentials,
      responseSchema: config.responseSchema,
      startTime: Date.now(),
    };
  }

  /**
   * Register a pre-handler (replaces any existing pre-handler)
   */
  use(handler: PreHandler): this {
    this.preHandler = handler;
    return this;
  }

  /**
   * Register a post-handler (replaces any existing post-handler)
   */
  usePost(handler: PostHandler): this {
    this.postHandler = handler;
    return this;
  }

  /**
   * Get the handler context
   */
  getContext(): HandlerContext {
    return this.context;
  }

  /**
   * Main handler execution method
   * Orchestrates pre-handler, API call, and post-handler
   */
  async handle(request: HandlerRequest): Promise<HandlerResponse> {
    try {
      // Step 1: Execute pre-handler
      let processedRequest = request;
      if (this.preHandler) {
        try {
          processedRequest = await this.preHandler(processedRequest, this.context);
        } catch (error) {
          this.logger.error(
            `Pre-handler failed: ${(error as Error).message}`,
            (error as Error).stack,
          );
          return this.createErrorResponse(
            'PRE_HANDLER_ERROR',
            `Pre-handler failed: ${(error as Error).message}`,
          );
        }
      }

      // Step 2: Execute the actual API call
      let response: HandlerResponse;
      try {
        response = await this.executeRequest(processedRequest);
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

      // Step 3: Execute post-handler
      let processedResponse = response;
      if (this.postHandler) {
        try {
          processedResponse = await this.postHandler(
            processedResponse,
            processedRequest,
            this.context,
          );
        } catch (error) {
          this.logger.error(
            `Post-handler failed: ${(error as Error).message}`,
            (error as Error).stack,
          );
          // Don't fail the request if post-handler fails, just log it
          // The API call was successful, so we should return the response
        }
      }

      // Add execution metrics

      processedResponse.metadata = {
        ...processedResponse.metadata,
      };

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
   * Execute the actual API request
   * Must be implemented by subclasses
   */
  protected abstract executeRequest(request: HandlerRequest): Promise<HandlerResponse>;

  /**
   * Create an error response
   */
  protected createErrorResponse(code: string, message: string): HandlerResponse {
    return {
      success: false,
      error: message,
      errorCode: code,
    };
  }

  /**
   * Create a success response
   */
  protected createSuccessResponse(data: Record<string, unknown>): HandlerResponse {
    return {
      success: true,
      data,
    };
  }
}
