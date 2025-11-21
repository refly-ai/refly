/**
 * Base pre-handler
 * Handles credential injection for tool execution
 *
 * NOTE: Resource resolution has been moved to ToolFactory.func
 * where user context is available at runtime
 */

import type { HandlerContext, HandlerRequest } from '@refly/openapi-schema';
import { injectCredentials } from '../../../utils';

/**
 * Configuration for base pre-handler
 */
export interface BasePreHandlerConfig {
  /**
   * Authentication credentials to inject
   */
  credentials?: Record<string, unknown>;
}

/**
 * Create base pre-handler
 * Handles credential injection only
 * Resource resolution is now handled in ToolFactory.func before handler execution
 */
export function createBasePreHandler(
  config: BasePreHandlerConfig = {},
): (request: HandlerRequest, context: HandlerContext) => Promise<HandlerRequest> {
  return async (request: HandlerRequest, context: HandlerContext): Promise<HandlerRequest> => {
    // Inject credentials if configured
    if (config.credentials) {
      injectCredentials(context, config.credentials);
      // Note: context mutation doesn't affect the request
      // This is mainly for backward compatibility
    }

    // Return request as-is (no resource processing here)
    return request;
  };
}
