import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CopilotAutogenService } from '../../copilot-autogen/copilot-autogen.service';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';
import { OpenapiCopilotGenerateRequest } from '../dto/openapi-copilot.dto';
import type { WorkflowTask } from '@refly/openapi-schema';
import { ApiCallTrackingInterceptor } from '../interceptors/api-call-tracking.interceptor';

@ApiTags('OpenAPI - Copilot')
@Controller('v1/openapi/copilot')
@UseInterceptors(ApiCallTrackingInterceptor)
export class OpenapiCopilotController {
  private readonly logger = new Logger(OpenapiCopilotController.name);

  constructor(private readonly copilotAutogenService: CopilotAutogenService) {}

  private sanitizeWorkflowPlan(plan: {
    title: string;
    tasks: WorkflowTask[];
    variables?: Array<Record<string, any>>;
  }): {
    title: string;
    tasks: WorkflowTask[];
    variables?: Array<{
      name: string;
      variableType?: string;
      required?: boolean;
      options?: string[];
    }>;
  } {
    const variables = Array.isArray(plan.variables)
      ? plan.variables.map((variable) => ({
          name: variable.name,
          variableType: variable.variableType,
          required: variable.required,
          options: variable.options,
        }))
      : plan.variables;
    return {
      ...plan,
      variables,
    };
  }

  @Post('workflow/generate')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Generate workflow via Copilot (returns workflow plan)' })
  async generateWorkflow(@LoginedUser() user: User, @Body() body: OpenapiCopilotGenerateRequest) {
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    if (!query) {
      throw new BadRequestException('Missing query');
    }

    this.logger.log(`[OPENAPI_COPILOT] uid=${user.uid}`);

    try {
      const result = await this.copilotAutogenService.generateWorkflow(user, {
        query,
        canvasId: body?.canvasId,
        locale: body?.locale,
      });

      return buildSuccessResponse({
        canvasId: result.canvasId,
        workflowPlan: this.sanitizeWorkflowPlan(result.workflowPlan),
      });
    } catch (error) {
      // 生成失败时返回 400，响应体可能包含 modelResponse（AI 原始回复）
      const modelResponse =
        error &&
        typeof error === 'object' &&
        'modelResponse' in error &&
        typeof (error as { modelResponse?: unknown }).modelResponse === 'string'
          ? (error as { modelResponse: string }).modelResponse
          : undefined;
      const rawMessage = error instanceof Error && error.message ? error.message : '生成工作流失败';
      const sanitizedMessage = modelResponse
        ? rawMessage.replace(/\s*Model response:[\s\S]*$/i, '').trim()
        : rawMessage;
      const message =
        sanitizedMessage.length > 800 ? `${sanitizedMessage.slice(0, 800)}...` : sanitizedMessage;
      this.logger.warn(`[OPENAPI_COPILOT] 生成工作流失败: ${message}`);
      const responseBody: Record<string, unknown> = {
        statusCode: 400,
        message,
        error: 'Bad Request',
      };
      if (modelResponse) {
        responseBody.modelResponse = modelResponse;
      }
      throw new BadRequestException(responseBody);
    }
  }
}
