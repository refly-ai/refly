/**
 * Handler interface definitions
 */

import type { HandlerContext, HandlerRequest, HandlerResponse } from '@refly/openapi-schema';
import type { PreHandler, PostHandler } from '../../handlers/types';

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
