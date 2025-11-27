/**
 * Handler interfaces and base implementation
 * Combines interface definitions with base handler class and HTTP handler implementation
 */

import { Logger } from '@nestjs/common';
import {
  AdapterRequest,
  BillingConfig,
  HandlerConfig,
  HandlerContext,
  HandlerRequest,
  HandlerResponse,
} from '@refly/openapi-schema';
import { PreHandler, PostHandler } from '@refly/openapi-schema/src/handler-types';
import { HandlerError } from '../../constant/constant';
import { IAdapter } from './adapter';
import { createBasePostHandler } from './handler-post';
import { createBasePreHandler } from './handler-pre';
import { ResourceHandler } from '../../utils';
import { CreditService } from '../../../credit/credit.service';

/**
 * Base handler interface
 * Handles the complete lifecycle of a tool execution request
 */
export interface IHandler {
  /**
   * Execute the handler with the given request
   * @param request - Handler request containing method, params, and context
   * @returns Promise resolving to handler response
   */
  handle(request: HandlerRequest): Promise<HandlerResponse>;

  /**
   * Register a pre-handler to process request before execution
   * @param handler - Pre-handler function
   * @returns this for chaining
   */
  use(handler: PreHandler): this;

  /**
   * Register a post-handler to process response after execution
   * @param handler - Post-handler function
   * @returns this for chaining
   */
  usePost(handler: PostHandler): this;

  /**
   * Get the current handler context
   * @returns Handler context
   */
  getContext(): HandlerContext;
}

/**
 * Handler factory interface
 * Creates handler instances from configuration
 */
export interface IHandlerFactory {
  /**
   * Create a handler instance from configuration
   * @param config - Handler configuration
   * @returns Handler instance
   */
  createHandler(config: unknown): IHandler;

  /**
   * Check if this factory supports the given configuration
   * @param config - Configuration to check
   * @returns true if supported
   */
  supports(config: unknown): boolean;
}

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
   * Handles different data types: Buffer, object, or primitive values
   */
  protected createSuccessResponse(data: unknown): HandlerResponse {
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

/**
 * HTTP Handler configuration options
 */
export interface HttpHandlerOptions extends HandlerConfig {
  /** Billing configuration */
  billing?: BillingConfig;
  /** Credit service */
  creditService?: CreditService;
  /** Whether to format response */
  formatResponse?: boolean;
  /** Whether to enable resource upload via ResourceHandler */
  enableResourceUpload?: boolean;
  /** ResourceHandler instance for output resource processing */
  resourceHandler: ResourceHandler;
}

/**
 * HTTP Handler class
 * Handles complete request lifecycle with automatic resource management
 */
export class HttpHandler extends BaseHandler {
  constructor(
    adapter: IAdapter,
    private readonly options: HttpHandlerOptions,
  ) {
    super(adapter, options);

    // Setup pre-handlers
    this.setupPreHandlers();

    // Setup post-handlers
    this.setupPostHandlers();
  }

  /**
   * Setup pre-handlers in order
   */
  private setupPreHandlers(): void {
    // Use base pre-handler for credential injection only
    // Resource resolution is now handled in ToolFactory.func before handler execution
    this.use(
      createBasePreHandler({
        credentials: this.options.credentials,
      }),
    );
  }

  /**
   * Setup post-handlers in order
   */
  private setupPostHandlers(): void {
    // Use base post-handler with ResourceHandler for output resource processing
    this.usePost(
      createBasePostHandler({
        billing: this.options.billing,
        creditService: this.options.creditService,
        resourceHandler: this.options.resourceHandler,
      }),
    );
  }

  /**
   * Execute the actual API request via adapter
   */
  protected async executeRequest(request: HandlerRequest): Promise<HandlerResponse> {
    try {
      // Build adapter request
      const adapterRequest: AdapterRequest = {
        endpoint: this.options.endpoint,
        method: this.options.method || 'POST',
        params: request.params,
        credentials: this.context.credentials,
        timeout: this.options.timeout,
        useFormData: this.options.useFormData,
      };

      // Execute via adapter
      const adapterResponse = await this.adapter.execute(adapterRequest);

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
}
