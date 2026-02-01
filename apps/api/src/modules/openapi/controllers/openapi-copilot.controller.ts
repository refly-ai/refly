import { BadRequestException, Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CopilotAutogenService } from '../../copilot-autogen/copilot-autogen.service';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';
import { OpenapiCopilotGenerateRequest } from '../dto/openapi-copilot.dto';
import type { WorkflowTask } from '@refly/openapi-schema';

@ApiTags('OpenAPI - Copilot')
@Controller('v1/openapi/copilot')
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

    const result = await this.copilotAutogenService.generateWorkflow(user, {
      query,
      canvasId: body?.canvasId,
      locale: body?.locale,
    });

    return buildSuccessResponse({
      canvasId: result.canvasId,
      workflowPlan: this.sanitizeWorkflowPlan(result.workflowPlan),
    });
  }
}
