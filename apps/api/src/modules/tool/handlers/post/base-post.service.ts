/**
 * Base Post-Handler Service
 *
 * Abstract base class for all post-handler implementations.
 * Defines the common interface for post-processing tool execution responses.
 */

import { Logger } from '@nestjs/common';
import type {
  HandlerRequest,
  HandlerResponse,
  HandlerContext,
  BillingConfig,
} from '@refly/openapi-schema';
import type { ResourceHandler } from '../../utils';

/**
 * Configuration for post-processing
 */
export interface PostHandlerConfig {
  /** Billing configuration */
  billing?: BillingConfig;
  /** Enable resource upload for output files/images */
  enableResourceUpload?: boolean;
  /** Resource handler instance */
  resourceHandler?: ResourceHandler;
}

/**
 * Abstract base class for post-handlers
 *
 * All post-handler implementations should extend this class
 * and implement the processResponse method.
 */
export abstract class BasePostHandlerService {
  protected abstract readonly logger: Logger;

  /**
   * Process response after tool execution
   *
   * @param request - Original handler request
   * @param response - Tool execution response
   * @param context - Handler context with credentials and schema
   * @param config - Post-handler configuration
   * @returns Processed response with billing metadata
   */
  abstract processResponse(
    request: HandlerRequest,
    response: HandlerResponse,
    context: HandlerContext,
    config: PostHandlerConfig,
  ): Promise<HandlerResponse>;
}
