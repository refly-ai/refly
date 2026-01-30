import { Controller, Post, Get, Param, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OpenapiService } from '../openapi.service';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { DebounceGuard } from '../guards/debounce.guard';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';
import { workflowExecutionStatusPO2DTO } from '../types/request.types';

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

    const payload =
      body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, any>) : {};
    const variables =
      payload.variables &&
      typeof payload.variables === 'object' &&
      !Array.isArray(payload.variables)
        ? (payload.variables as Record<string, any>)
        : payload;
    const result = await this.openapiService.runWorkflow(canvasId, user.uid, variables);

    return buildSuccessResponse(result);
  }

  /**
   * Get workflow execution status via API (requires API Key authentication)
   * GET /v1/openapi/workflow/:executionId/status
   */
  @Get(':executionId/status')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Get workflow execution status via API' })
  async getWorkflowStatus(@Param('executionId') executionId: string, @LoginedUser() user: User) {
    this.logger.log(`[API_GET_STATUS] uid=${user.uid} executionId=${executionId}`);

    const workflowStatus = await this.openapiService.getWorkflowStatus(
      { uid: user.uid },
      executionId,
    );

    return buildSuccessResponse(workflowExecutionStatusPO2DTO(workflowStatus));
  }

  @Get(':executionId/output')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Get workflow execution output via API' })
  async getWorkflowOutput(@Param('executionId') executionId: string, @LoginedUser() user: User) {
    this.logger.log(`[API_GET_OUTPUT] uid=${user.uid} executionId=${executionId}`);

    const output = await this.openapiService.getWorkflowOutput({ uid: user.uid }, executionId);

    return buildSuccessResponse(output);
  }

  @Post(':executionId/abort')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Abort workflow execution via API' })
  async abortWorkflow(@Param('executionId') executionId: string, @LoginedUser() user: User) {
    this.logger.log(`[API_ABORT] uid=${user.uid} executionId=${executionId}`);

    await this.openapiService.abortWorkflow(user, executionId);

    return buildSuccessResponse(null);
  }
}
