import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User, WorkflowPlan, WorkflowPlanRecord } from '@refly/openapi-schema';
import { WorkflowPlanService } from './workflow-plan.service';
import { genCopilotSessionID, genActionResultID } from '@refly/utils';
import {
  GenerateWorkflowPlanRequest,
  PatchWorkflowPlanRequest,
  CLI_ERROR_CODES,
} from './workflow-cli.dto';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build CLI success response
 */
function buildCliSuccessResponse<T>(data: T): { success: boolean; data: T } {
  return { success: true, data };
}

/**
 * Build CLI error response and throw HTTP exception
 */
function throwCliError(
  code: string,
  message: string,
  hint?: string,
  status: number = HttpStatus.BAD_REQUEST,
): never {
  throw new HttpException(
    {
      ok: false,
      type: 'error',
      version: '1.0.0',
      error: { code, message, hint },
    },
    status,
  );
}

// ============================================================================
// WorkflowPlanCliController
// ============================================================================

/**
 * CLI-specific workflow plan controller
 * These endpoints are designed for the Refly CLI to manage workflow plans.
 * Workflow plans are semantic representations that can be converted to canvas nodes/edges.
 */
@Controller('v1/cli/workflow-plan')
export class WorkflowPlanCliController {
  private readonly logger = new Logger(WorkflowPlanCliController.name);

  constructor(private readonly workflowPlanService: WorkflowPlanService) {}

  /**
   * Generate a new workflow plan
   * POST /v1/cli/workflow-plan/generate
   */
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generate(
    @LoginedUser() user: User,
    @Body() body: GenerateWorkflowPlanRequest,
  ): Promise<{ success: boolean; data: WorkflowPlanRecord }> {
    this.logger.log(`Generating workflow plan for user ${user.uid}`);

    try {
      const plan = await this.workflowPlanService.generateWorkflowPlan(user, {
        data: body.plan,
        copilotSessionId: body.sessionId || genCopilotSessionID(),
        resultId: genActionResultID(),
        resultVersion: 0,
      });

      return buildCliSuccessResponse(plan);
    } catch (error) {
      this.logger.error(`Failed to generate workflow plan: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Failed to generate workflow plan: ${(error as Error).message}`,
        'Check your plan data and try again',
      );
    }
  }

  /**
   * Patch an existing workflow plan with semantic operations
   * POST /v1/cli/workflow-plan/patch
   */
  @UseGuards(JwtAuthGuard)
  @Post('patch')
  async patch(
    @LoginedUser() user: User,
    @Body() body: PatchWorkflowPlanRequest,
  ): Promise<{ success: boolean; data: WorkflowPlan }> {
    this.logger.log(`Patching workflow plan ${body.planId} for user ${user.uid}`);

    try {
      const plan = await this.workflowPlanService.patchWorkflowPlan(user, {
        planId: body.planId,
        operations: body.operations,
        resultId: genActionResultID(),
        resultVersion: 0,
      });

      return buildCliSuccessResponse(plan);
    } catch (error) {
      this.logger.error(`Failed to patch workflow plan: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Failed to patch workflow plan: ${(error as Error).message}`,
        'Check your plan ID and operations',
      );
    }
  }

  /**
   * Get workflow plan by ID
   * GET /v1/cli/workflow-plan/:planId
   */
  @UseGuards(JwtAuthGuard)
  @Get(':planId')
  async get(
    @LoginedUser() user: User,
    @Param('planId') planId: string,
    @Query('version') version?: number,
  ): Promise<{ success: boolean; data: WorkflowPlanRecord }> {
    this.logger.log(`Getting workflow plan ${planId} for user ${user.uid}`);

    try {
      const plan = await this.workflowPlanService.getWorkflowPlanDetail(user, {
        planId,
        version,
      });

      if (!plan) {
        throwCliError(
          CLI_ERROR_CODES.NOT_FOUND,
          `Workflow plan ${planId} not found`,
          'Check the plan ID and try again',
          HttpStatus.NOT_FOUND,
        );
      }

      return buildCliSuccessResponse(plan);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to get workflow plan: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `Workflow plan ${planId} not found`,
        'Check the plan ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Get latest workflow plan for a session
   * GET /v1/cli/workflow-plan/session/:sessionId/latest
   */
  @UseGuards(JwtAuthGuard)
  @Get('session/:sessionId/latest')
  async getLatest(
    @LoginedUser() user: User,
    @Param('sessionId') copilotSessionId: string,
  ): Promise<{ success: boolean; data: WorkflowPlan | null }> {
    this.logger.log(
      `Getting latest workflow plan for session ${copilotSessionId}, user ${user.uid}`,
    );

    try {
      const plan = await this.workflowPlanService.getLatestWorkflowPlan(user, {
        copilotSessionId,
      });

      return buildCliSuccessResponse(plan);
    } catch (error) {
      this.logger.error(`Failed to get latest workflow plan: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Failed to get latest workflow plan: ${(error as Error).message}`,
        'Check the session ID and try again',
      );
    }
  }
}
