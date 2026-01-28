import { Controller, Post, Get, Param, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OpenapiService } from '../openapi.service';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { DebounceGuard } from '../guards/debounce.guard';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';
import { workflowExecutionPO2DTO } from '../types/request.types';

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

  /**
   * Get workflow execution detail via API (requires API Key authentication)
   * GET /v1/openapi/workflow/:executionId/detail
   *
   * Returns workflow execution detail with node executions
   */
  @Get(':executionId/detail')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Get workflow execution detail via API' })
  async getWorkflowDetail(@Param('executionId') executionId: string, @LoginedUser() user: User) {
    this.logger.log(`[API_GET_DETAIL] uid=${user.uid} executionId=${executionId}`);

    const workflowDetail = await this.openapiService.getWorkflowDetail(
      { uid: user.uid },
      executionId,
    );

    return buildSuccessResponse(workflowExecutionPO2DTO(workflowDetail));
  }

  @Get(':executionId/output')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Get workflow execution output via API' })
  async getWorkflowOutput(@Param('executionId') executionId: string, @LoginedUser() user: User) {
    this.logger.log(`[API_GET_OUTPUT] uid=${user.uid} executionId=${executionId}`);

    const output = await this.openapiService.getWorkflowOutput({ uid: user.uid }, executionId);

    return buildSuccessResponse(output);
  }
}
