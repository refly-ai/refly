/**
 * Handler type definitions
 * Migrated from @refly/openapi-schema to keep dynamic-tooling self-contained
 */

import type { HandlerContext, HandlerRequest, HandlerResponse } from '@refly/openapi-schema';

/**
 * Pre-handler function type
 * Processes the request before it's executed
 */
export type PreHandler = (
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerRequest>;

/**
 * Post-handler function type
 * Processes the response after execution
 */
export type PostHandler = (
  response: HandlerResponse,
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerResponse>;
