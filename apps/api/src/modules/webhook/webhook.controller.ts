import { Controller, Post, Param, Body, UseGuards, Req, Logger } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { DebounceGuard } from './guards/debounce.guard';
import { buildSuccessResponse } from '../../utils/response';
import { WebhookRequest } from './types/request.types';

/**
 * Controller for webhook trigger endpoints (public API)
 * No authentication required - webhookId acts as the secret
 */
@Controller('v1/openapi/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Trigger workflow execution via webhook
   * POST /v1/openapi/webhook/:webhookId/run
   */
  @Post(':webhookId/run')
  @UseGuards(RateLimitGuard, DebounceGuard)
  async runWorkflow(
    @Param('webhookId') webhookId: string,
    @Body() body: Record<string, any>,
    @Req() request: WebhookRequest,
  ) {
    this.logger.log(`[WEBHOOK_TRIGGER] webhookId=${webhookId}`);

    // Get webhook config to extract uid for rate limiting
    const config = await this.webhookService.getWebhookConfigById(webhookId);
    if (config) {
      // Attach uid to request for rate limiting
      request.uid = config.uid;
    }

    const payload =
      body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, any>) : {};
    const variables =
      payload.variables &&
      typeof payload.variables === 'object' &&
      !Array.isArray(payload.variables)
        ? (payload.variables as Record<string, any>)
        : payload;
    const result = await this.webhookService.runWorkflow(webhookId, variables);
    return buildSuccessResponse(result);
  }
}
