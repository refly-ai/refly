import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { DebounceGuard } from './guards/debounce.guard';
import { buildSuccessResponse } from '../../utils/response';
import { WebhookRequest } from './types/request.types';
import { WebhookCallTrackingInterceptor } from './interceptors/webhook-call-tracking.interceptor';

/**
 * Type guard to check if a value is a non-null object (not an array)
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Controller for webhook trigger endpoints (public API)
 * No authentication required - webhookId acts as the secret
 */
@Controller('v1/openapi/webhook')
@UseInterceptors(WebhookCallTrackingInterceptor)
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Trigger workflow execution via webhook
   * POST /v1/openapi/webhook/:webhookId/run
   *
   * If passing variables, they must be wrapped in a "variables" field.
   */
  @Post(':webhookId/run')
  @UseGuards(RateLimitGuard, DebounceGuard)
  async runWorkflow(
    @Param('webhookId') webhookId: string,
    @Body() body: unknown,
    @Req() request: WebhookRequest,
  ) {
    this.logger.log(`[WEBHOOK_TRIGGER] webhookId=${webhookId}`);

    // Get webhook config to extract uid for rate limiting
    const config = await this.webhookService.getWebhookConfigById(webhookId);
    if (config) {
      // Attach uid to request for rate limiting
      request.uid = config.uid;
    }

    // Validate that body is a record (or empty)
    if (body !== null && body !== undefined && !isRecord(body)) {
      throw new BadRequestException('Request body must be a valid JSON object');
    }

    const payload = isRecord(body) ? body : {};

    // Extract variables - must be under "variables" field if present
    let variables: Record<string, unknown> = {};

    if ('variables' in payload) {
      // If variables field exists, it must be an object
      if (!isRecord(payload.variables)) {
        throw new BadRequestException(
          'The "variables" field must be a valid object. Example: { "variables": { "input": "value" } }',
        );
      }
      variables = payload.variables;
    } else if (Object.keys(payload).length > 0) {
      // If body has other fields but no "variables" field, reject it
      throw new BadRequestException(
        'Variables must be wrapped in a "variables" field. Example: { "variables": { "input": "value" } }. ' +
          'If the workflow requires no variables, send an empty body or { "variables": {} }.',
      );
    }
    // else: empty body is allowed (workflow with no variables)

    const result = await this.webhookService.runWorkflow(webhookId, variables);
    return buildSuccessResponse(result);
  }
}
