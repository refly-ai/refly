import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OpenapiService } from '../openapi.service';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { DebounceGuard } from '../guards/debounce.guard';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';
import { workflowExecutionStatusPO2DTO } from '../types/request.types';
import { ApiCallTrackingInterceptor } from '../interceptors/api-call-tracking.interceptor';

/**
 * Type guard to check if a value is a non-null object (not an array)
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Controller for Workflow API endpoints
 * Requires API Key authentication and returns execution ID for tracking
 */
@ApiTags('OpenAPI - Workflow')
@Controller('v1/openapi/workflow')
@UseInterceptors(ApiCallTrackingInterceptor)
export class WorkflowApiController {
  private readonly logger = new Logger(WorkflowApiController.name);

  constructor(private readonly openapiService: OpenapiService) {}

  /**
   * Run workflow via API (requires API Key authentication)
   * POST /v1/openapi/workflow/:canvasId/run
   *
   * If passing variables, they must be wrapped in a "variables" field.
   * Returns execution ID for tracking workflow status.
   */
  @Post(':canvasId/run')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard, DebounceGuard)
  @ApiOperation({ summary: 'Run workflow via API (returns execution ID)' })
  async runWorkflow(
    @Param('canvasId') canvasId: string,
    @Body() body: unknown,
    @LoginedUser() user: User,
  ) {
    this.logger.log(`[API_TRIGGER] uid=${user.uid} canvasId=${canvasId}`);

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
