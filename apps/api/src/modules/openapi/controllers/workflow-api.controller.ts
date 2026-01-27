import { Controller, Post, Param, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OpenapiService } from '../openapi.service';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { DebounceGuard } from '../guards/debounce.guard';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';

/**
 * Controller for Workflow API endpoints
 * Requires API Key authentication and returns execution ID for tracking
 */
@ApiTags('OpenAPI - Workflow')
@Controller('v1/openapi/workflow')
export class WorkflowApiController {
  private readonly logger = new Logger(WorkflowApiController.name);

  constructor(private readonly openapiService: OpenapiService) {}

  /**
   * Run workflow via API (requires API Key authentication)
   * POST /v1/openapi/workflow/:canvasId/run
   *
   * Returns execution ID for tracking workflow status
   */
  @Post(':canvasId/run')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard, DebounceGuard)
  @ApiOperation({ summary: 'Run workflow via API (returns execution ID)' })
  async runWorkflow(
    @Param('canvasId') canvasId: string,
    @Body() body: Record<string, any>,
    @LoginedUser() user: User,
  ) {
    this.logger.log(`[API_TRIGGER] uid=${user.uid} canvasId=${canvasId}`);

    const result = await this.openapiService.runWorkflow(canvasId, user.uid, body);

    return buildSuccessResponse(result);
  }
}
