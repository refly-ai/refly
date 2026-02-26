/**
 * Base Pre-Handler Service
 *
 * Abstract base class for all pre-handler implementations.
 * Defines the common interface for pre-processing tool execution requests.
 */

import { Logger } from '@nestjs/common';
import type { HandlerContext, HandlerRequest } from '@refly/openapi-schema';

/**
 * Configuration for pre-processing
 */
export interface PreHandlerConfig {
  /** Authentication credentials to inject */
  credentials?: Record<string, unknown>;
}

/**
 * Abstract base class for pre-handlers
 *
 * All pre-handler implementations should extend this class
 * and implement the processRequest method.
 */
export abstract class BasePreHandlerService {
  protected abstract readonly logger: Logger;

  /**
   * Process request before tool execution
   *
   * @param request - Original handler request
   * @param context - Handler context with credentials and schema
   * @param config - Pre-handler configuration
   * @returns Processed request
   */
  abstract processRequest(
    request: HandlerRequest,
    context: HandlerContext,
    config: PreHandlerConfig,
  ): Promise<HandlerRequest>;
}
