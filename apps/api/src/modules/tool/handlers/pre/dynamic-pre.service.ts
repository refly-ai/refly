/**
 * Dynamic Pre-Handler Service
 *
 * NestJS service for pre-processing dynamic tool execution requests.
 * Handles credential injection before API calls for HTTP-based dynamic tools.
 *
 * This is the service-based version of createBasePreHandler().
 */

import { Injectable, Logger } from '@nestjs/common';
import type { HandlerContext, HandlerRequest } from '@refly/openapi-schema';
import { injectCredentials } from '../../utils';
import { BasePreHandlerService, type PreHandlerConfig } from './base-pre.service';

/**
 * Dynamic Pre-Handler Service
 *
 * Processes requests before dynamic tool execution:
 * - Credential injection into request context
 */
@Injectable()
export class DynamicPreHandlerService extends BasePreHandlerService {
  protected readonly logger = new Logger(DynamicPreHandlerService.name);

  /**
   * Process request before tool execution
   *
   * @param request - Original handler request
   * @param context - Handler context with credentials and schema
   * @param config - Pre-handler configuration
   * @returns Processed request with credentials injected
   */
  async processRequest(
    request: HandlerRequest,
    context: HandlerContext,
    config: PreHandlerConfig,
  ): Promise<HandlerRequest> {
    try {
      // Inject credentials if configured
      if (config.credentials) {
        injectCredentials(context, config.credentials);
        this.logger.debug(`Credentials injected for ${request.provider}.${request.method}`);
      }

      // Return request as-is (resource resolution handled in ToolFactory.func)
      return request;
    } catch (error) {
      this.logger.error(
        `Pre-processing failed for ${request.provider}.${request.method}: ${error.message}`,
      );
      throw error;
    }
  }
}
