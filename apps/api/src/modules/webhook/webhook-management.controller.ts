import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';
import {
  EnableWebhookDto,
  DisableWebhookDto,
  ResetWebhookDto,
  UpdateWebhookDto,
  GetCallHistoryDto,
} from './dto/webhook.dto';

/**
 * Controller for webhook management endpoints (authenticated)
 */
@ApiTags('Webhook')
@Controller('v1/webhook')
@UseGuards(JwtAuthGuard)
export class WebhookManagementController {
  private readonly logger = new Logger(WebhookManagementController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Enable webhook for a canvas
   * POST /v1/webhook/enable
   */
  @Post('enable')
  @ApiOperation({ summary: 'Enable webhook for a canvas' })
  async enableWebhook(@Body() dto: EnableWebhookDto, @LoginedUser() user: User) {
    this.logger.log(`[WEBHOOK_ENABLE] uid=${user.uid} canvasId=${dto.canvasId}`);

    const result = await this.webhookService.enableWebhook(dto.canvasId, user.uid, dto.timeout);

    return buildSuccessResponse(result);
  }

  /**
   * Disable webhook
   * POST /v1/webhook/disable
   */
  @Post('disable')
  @ApiOperation({ summary: 'Disable webhook' })
  async disableWebhook(@Body() dto: DisableWebhookDto, @LoginedUser() user: User) {
    this.logger.log(`[WEBHOOK_DISABLE] uid=${user.uid} webhookId=${dto.webhookId}`);

    await this.webhookService.disableWebhook(dto.webhookId, user.uid);

    return buildSuccessResponse();
  }

  /**
   * Reset webhook (generate new ID)
   * POST /v1/webhook/reset
   */
  @Post('reset')
  @ApiOperation({ summary: 'Reset webhook (generate new ID)' })
  async resetWebhook(@Body() dto: ResetWebhookDto, @LoginedUser() user: User) {
    this.logger.log(`[WEBHOOK_RESET] uid=${user.uid} webhookId=${dto.webhookId}`);

    const result = await this.webhookService.resetWebhook(dto.webhookId, user.uid);

    return buildSuccessResponse(result);
  }

  /**
   * Update webhook configuration
   * POST /v1/webhook/update
   */
  @Post('update')
  @ApiOperation({ summary: 'Update webhook configuration' })
  async updateWebhook(
    @Body() dto: UpdateWebhookDto & { webhookId: string },
    @LoginedUser() user: User,
  ) {
    this.logger.log(`[WEBHOOK_UPDATE] uid=${user.uid} webhookId=${dto.webhookId}`);

    await this.webhookService.updateWebhook(dto.webhookId, user.uid, {
      isEnabled: dto.isEnabled,
      timeout: dto.timeout,
    });

    return buildSuccessResponse({ success: true });
  }

  /**
   * Get webhook configuration for a canvas
   * GET /v1/webhook/config?canvasId=xxx
   */
  @Get('config')
  @ApiOperation({ summary: 'Get webhook configuration for a canvas' })
  async getWebhookConfig(@Query('canvasId') canvasId: string, @LoginedUser() user: User) {
    this.logger.log(`[WEBHOOK_GET_CONFIG] uid=${user.uid} canvasId=${canvasId}`);

    const config = await this.webhookService.getWebhookConfig(canvasId, user.uid);

    if (!config) {
      return buildSuccessResponse(null);
    }

    return buildSuccessResponse({
      webhookId: config.apiId,
      isEnabled: config.isEnabled,
      timeout: config.timeout,
    });
  }

  /**
   * Get call history for a webhook
   * GET /v1/webhook/history?webhookId=xxx&page=1&pageSize=20
   */
  @Get('history')
  @ApiOperation({ summary: 'Get call history for a webhook' })
  async getCallHistory(@Query() query: GetCallHistoryDto, @LoginedUser() user: User) {
    // Validate required webhookId parameter
    if (!query.webhookId || typeof query.webhookId !== 'string') {
      throw new BadRequestException('webhookId is required and must be a string');
    }

    this.logger.log(`[WEBHOOK_GET_HISTORY] uid=${user.uid} webhookId=${query.webhookId}`);

    const page = normalizePositiveInt(query.page, 1);
    const pageSize = normalizePositiveInt(query.pageSize, 20);

    const result = await this.webhookService.getCallHistory(query.webhookId, user.uid, {
      page,
      pageSize,
    });

    return buildSuccessResponse(result);
  }
}

const normalizePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};
