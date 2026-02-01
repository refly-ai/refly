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
import { User, WorkflowPlan, WorkflowPlanRecord, ModelScene } from '@refly/openapi-schema';
import { WorkflowPlanService } from './workflow-plan.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { ToolService } from '../tool/tool.service';
import { ProviderService } from '../provider/provider.service';
import { PrismaService } from '../common/prisma.service';
import { generateCanvasDataFromWorkflowPlan, initEmptyCanvasState } from '@refly/canvas-common';
import { providerItem2ModelInfo } from '../provider/provider.dto';
import {
  genCopilotSessionID,
  genActionResultID,
  genCanvasID,
  genNodeID,
  genStartID,
} from '@refly/utils';
import { CanvasNode } from '@refly/openapi-schema';
import {
  GenerateWorkflowPlanRequest,
  PatchWorkflowPlanRequest,
  PatchWorkflowPlanByCanvasRequest,
  CLI_ERROR_CODES,
} from './workflow-cli.dto';

// ============================================================================
// Apply Plan DTOs
// ============================================================================

interface ApplyPlanRequest {
  /** Optional canvas ID (if updating existing canvas) */
  canvasId?: string;
  /** Optional project ID */
  projectId?: string;
  /** Canvas title (optional, defaults to plan title) */
  title?: string;
}

interface ApplyPlanResponse {
  /** The created/updated workflow ID (same as canvasId) */
  workflowId: string;
  /** Canvas ID */
  canvasId: string;
  /** Number of nodes created */
  nodesCount: number;
  /** Number of edges created */
  edgesCount: number;
}

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
 * Create a start node for workflow entry point
 */
function createStartNode(): CanvasNode {
  return {
    id: genNodeID(),
    type: 'start',
    position: { x: 0, y: 0 },
    data: {
      title: 'Start',
      entityId: genStartID(),
    },
    selected: false,
    dragging: false,
  };
}

/**
 * Ensure nodes array contains at least one start node
 * If no start node exists, prepend one at the beginning
 */
function ensureStartNode(nodes: CanvasNode[]): CanvasNode[] {
  const hasStartNode = nodes.some((node) => node.type === 'start');
  if (hasStartNode) {
    return nodes;
  }
  return [createStartNode(), ...nodes];
}

/**
 * Build CLI error response and throw HTTP exception
 */
function throwCliError(
  code: string,
  message: string,
  hint?: string,
  status: number = HttpStatus.BAD_REQUEST,
  suggestedFix?: {
    field?: string;
    format?: string;
    example?: string;
  },
): never {
  throw new HttpException(
    {
      ok: false,
      type: 'error',
      version: '1.0.0',
      error: { code, message, hint, ...(suggestedFix && { suggestedFix }) },
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

  constructor(
    private readonly workflowPlanService: WorkflowPlanService,
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly toolService: ToolService,
    private readonly providerService: ProviderService,
    private readonly prisma: PrismaService,
  ) {}

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
   * Patch an existing workflow plan by canvas ID
   * POST /v1/cli/workflow-plan/patch-by-canvas
   *
   * This endpoint resolves canvasId → copilotSessionId → planId internally.
   * Only works for AI-generated workflows (those with a copilot session).
   */
  @UseGuards(JwtAuthGuard)
  @Post('patch-by-canvas')
  async patchByCanvas(
    @LoginedUser() user: User,
    @Body() body: PatchWorkflowPlanByCanvasRequest,
  ): Promise<{ success: boolean; data: WorkflowPlan }> {
    this.logger.log(`Patching workflow plan by canvas ${body.canvasId} for user ${user.uid}`);

    try {
      // Validate operations
      if (!body.operations || body.operations.length === 0) {
        throwCliError(
          CLI_ERROR_CODES.VALIDATION_ERROR,
          'At least one operation is required',
          'Provide operations array',
        );
      }

      // 1. Query CopilotSession by canvasId (order by createdAt desc)
      const copilotSession = await this.prisma.copilotSession.findFirst({
        where: {
          canvasId: body.canvasId,
          uid: user.uid,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!copilotSession) {
        throwCliError(
          CLI_ERROR_CODES.NOT_FOUND,
          `No copilot session found for canvas ${body.canvasId}`,
          'This workflow was not generated via AI. Use `refly workflow generate` first.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Query WorkflowPlan by copilotSessionId (order by version desc)
      const workflowPlanRecord = await this.prisma.workflowPlan.findFirst({
        where: {
          copilotSessionId: copilotSession.sessionId,
          uid: user.uid,
        },
        orderBy: { version: 'desc' },
      });

      if (!workflowPlanRecord) {
        throwCliError(
          CLI_ERROR_CODES.NOT_FOUND,
          `No workflow plan found for canvas ${body.canvasId}`,
          'This workflow may not have a plan yet.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 3. Call existing patchWorkflowPlan with resolved planId
      const plan = await this.workflowPlanService.patchWorkflowPlan(user, {
        planId: workflowPlanRecord.planId,
        operations: body.operations,
        resultId: genActionResultID(),
        resultVersion: 0,
      });

      return buildCliSuccessResponse(plan);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to patch workflow plan by canvas: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Failed to patch workflow plan: ${(error as Error).message}`,
        'Check your canvas ID and operations',
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

  /**
   * Apply a workflow plan to create/update a canvas workflow
   * POST /v1/cli/workflow-plan/:planId/apply
   *
   * This endpoint converts a WorkflowPlan into actual canvas nodes/edges,
   * either creating a new canvas or updating an existing one.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':planId/apply')
  async apply(
    @LoginedUser() user: User,
    @Param('planId') planId: string,
    @Body() body: ApplyPlanRequest,
  ): Promise<{ success: boolean; data: ApplyPlanResponse }> {
    this.logger.log(`Applying workflow plan ${planId} for user ${user.uid}`);

    try {
      // 1. Get the workflow plan
      const planRecord = await this.workflowPlanService.getWorkflowPlanDetail(user, { planId });
      if (!planRecord) {
        throwCliError(
          CLI_ERROR_CODES.NOT_FOUND,
          `Workflow plan ${planId} not found`,
          'Check the plan ID and try again',
          HttpStatus.NOT_FOUND,
        );
      }

      const workflowPlan: WorkflowPlan = {
        title: planRecord.title,
        tasks: planRecord.tasks,
        variables: planRecord.variables,
      };

      // 2. Create or get canvas
      // Use skipDefaultNodes to avoid creating an extra version with default nodes
      let canvasId = body.canvasId;
      if (!canvasId) {
        this.logger.log('[Apply] Creating new canvas with skipDefaultNodes');
        const canvas = await this.canvasService.createCanvas(
          user,
          {
            canvasId: genCanvasID(),
            title: body.title || workflowPlan.title || 'Workflow from Plan',
            projectId: body.projectId,
          },
          { skipDefaultNodes: true },
        );
        canvasId = canvas.canvasId;
        this.logger.log(`[Apply] Created canvas: ${canvasId}`);
      } else {
        this.logger.log(`[Apply] Using existing canvas: ${canvasId}`);
      }

      // 3. Get tools and default model for node generation
      const toolsData = await this.toolService.listAllToolsForCopilot(user);
      const defaultModel = await this.providerService.findDefaultProviderItem(
        user,
        'agent' as ModelScene,
      );
      this.logger.log(`[Apply] Using ${toolsData?.length ?? 0} available tools`);

      // 4. Convert WorkflowPlan to canvas nodes/edges
      this.logger.log('[Apply] Generating canvas nodes and edges from plan');
      const {
        nodes: generatedNodes,
        edges,
        variables,
      } = generateCanvasDataFromWorkflowPlan(workflowPlan, toolsData ?? [], {
        autoLayout: true,
        defaultModel: defaultModel ? providerItem2ModelInfo(defaultModel as any) : undefined,
      });

      // 4.1 Ensure start node exists (workflow entry point is required)
      const nodes = ensureStartNode(generatedNodes as CanvasNode[]);
      this.logger.log(`[Apply] Generated ${nodes.length} nodes and ${edges.length} edges`);

      // 5. Update canvas state (full override)
      // Use empty state base to avoid including default nodes from initEmptyCanvasState
      const newState = {
        ...initEmptyCanvasState(),
        nodes,
        edges,
      };

      const stateStorageKey = await this.canvasSyncService.saveState(canvasId, newState);
      this.logger.log(`[Apply] Canvas state saved with storage key: ${stateStorageKey}`);

      // 6. Update canvas metadata
      await this.prisma.canvas.update({
        where: { canvasId },
        data: {
          version: newState.version,
          workflow: JSON.stringify({ variables }),
        },
      });

      // 7. Create canvas version record
      await this.prisma.canvasVersion.create({
        data: {
          canvasId,
          version: newState.version,
          hash: '',
          stateStorageKey,
        },
      });

      this.logger.log(`[Apply] Canvas ${canvasId} updated successfully`);

      return buildCliSuccessResponse({
        workflowId: canvasId,
        canvasId,
        nodesCount: nodes.length,
        edgesCount: edges.length,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to apply workflow plan: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to apply workflow plan: ${(error as Error).message}`,
        'Check the plan ID and canvas configuration',
      );
    }
  }
}
