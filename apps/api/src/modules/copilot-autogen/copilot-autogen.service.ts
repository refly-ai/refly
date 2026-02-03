import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from '../skill/skill.service';
import { ActionService } from '../action/action.service';
import { CanvasService } from '../canvas/canvas.service';
import { ToolService } from '../tool/tool.service';
import { ProviderService } from '../provider/provider.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { WorkflowPlanService } from '../workflow/workflow-plan.service';
import {
  User,
  InvokeSkillRequest,
  ModelScene,
  WorkflowPlan,
  CanvasNode,
} from '@refly/openapi-schema';
import { generateCanvasDataFromWorkflowPlan } from '@refly/canvas-common';
import { safeParseJSON, genNodeID, genStartID } from '@refly/utils';
import {
  GenerateWorkflowRequest,
  GenerateWorkflowResponse,
  GenerateWorkflowCliRequest,
  GenerateWorkflowCliResponse,
  EditWorkflowCliRequest,
  EditWorkflowCliResponse,
} from './copilot-autogen.dto';
import {
  GenerateWorkflowAsyncResponse,
  GenerateStatusResponse,
  GenerateWorkflowCliResponse as WorkflowCliResponse,
} from '../workflow/workflow-cli.dto';
import { ActionDetail } from '../action/action.dto';
import { initEmptyCanvasState } from '@refly/canvas-common';
import { providerItem2ModelInfo } from '../provider/provider.dto';

/** Reference to a workflow plan (returned by generate_workflow tool) */
interface WorkflowPlanRef {
  planId: string;
  version: number;
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

@Injectable()
export class CopilotAutogenService {
  private readonly logger = new Logger(CopilotAutogenService.name);

  constructor(
    private prisma: PrismaService,
    private skillService: SkillService,
    private actionService: ActionService,
    private canvasService: CanvasService,
    private toolService: ToolService,
    private providerService: ProviderService,
    private canvasSyncService: CanvasSyncService,
    private workflowPlanService: WorkflowPlanService,
  ) {}

  /**
   * Generate workflow - Original method for web/frontend usage
   * This method maintains compatibility with the original API contract
   */
  async generateWorkflow(
    user: User,
    request: GenerateWorkflowRequest,
  ): Promise<GenerateWorkflowResponse> {
    this.logger.log(`[Autogen] Starting workflow generation for user ${user.uid}`);
    this.logger.log(`[Autogen] Query: ${request.query}`);

    // 2. Determine or create Canvas (reuse CanvasService)
    let canvasId = request.canvasId;
    if (!canvasId) {
      this.logger.log('[Autogen] Creating new canvas');
      const canvas = await this.canvasService.createCanvas(user, {
        title: `Workflow: ${request.query.slice(0, 50)}`,
        variables: request.variables,
      });
      canvasId = canvas.canvasId;
      this.logger.log(`[Autogen] Created canvas: ${canvasId}`);
    } else {
      this.logger.log(`[Autogen] Using existing canvas: ${canvasId}`);
    }

    // 2.1 Get existing start nodes from canvas as workflow entry points
    const rawCanvas = await this.canvasService.getCanvasRawData(user, canvasId, {
      checkOwnership: false,
    });
    // Preserve only start nodes as workflow entry points
    const startNodes = (rawCanvas.nodes ?? []).filter((node) => node.type === 'start');
    this.logger.log(`[Autogen] Found ${startNodes.length} start nodes in canvas`);

    // 3. Invoke Copilot Agent (reuse SkillService)
    this.logger.log('[Autogen] Invoking Copilot Agent');
    const invokeRequest: InvokeSkillRequest = {
      input: { query: request.query },
      mode: 'copilot_agent',
      target: { entityId: canvasId, entityType: 'canvas' },
      locale: request.locale,
      modelItemId: request.modelItemId,
    };

    const { resultId } = await this.skillService.sendInvokeSkillTask(user, invokeRequest);
    this.logger.log(`[Autogen] Copilot invoked, resultId: ${resultId}`);

    // 4. Poll and wait for completion (reuse ActionService)
    this.logger.log('[Autogen] Waiting for Copilot completion...');
    const actionResult = await this.waitForActionCompletion(user, resultId);
    this.logger.log(`[Autogen] Copilot completed with status: ${actionResult.status}`);

    // 5. Extract Workflow Plan Reference (planId + version)
    const { planRef, reason } = this.extractWorkflowPlanRef(actionResult);
    if (!planRef) {
      this.logger.error(`[Autogen] Failed to extract workflow plan reference: ${reason}`);
      const error = new Error(
        `Failed to extract workflow plan from Copilot response. ${reason ?? 'Unknown reason'}`,
      );
      this.attachModelResponse(error, actionResult);
      throw error;
    }
    this.logger.log(
      `[Autogen] Extracted workflow plan reference: planId=${planRef.planId}, version=${planRef.version}`,
    );

    // 5.1 Fetch full workflow plan from database
    const workflowPlanRecord = await this.workflowPlanService.getWorkflowPlanDetail(user, {
      planId: planRef.planId,
      version: planRef.version,
    });
    if (!workflowPlanRecord) {
      this.logger.error(`[Autogen] Failed to fetch workflow plan: ${planRef.planId}`);
      throw new Error(`Failed to fetch workflow plan with ID: ${planRef.planId}`);
    }
    const workflowPlan: WorkflowPlan = {
      title: workflowPlanRecord.title,
      tasks: workflowPlanRecord.tasks,
      variables: workflowPlanRecord.variables,
    };
    this.logger.log(
      `[Autogen] Fetched workflow plan with ${workflowPlan.tasks?.length ?? 0} tasks`,
    );

    // 6. Get tools list and default model (reuse ToolService and ProviderService)
    const toolsData = await this.toolService.listAllToolsForCopilot(user);
    const defaultModel = await this.providerService.findDefaultProviderItem(
      user,
      'agent' as ModelScene,
    );
    this.logger.log(`[Autogen] Using ${toolsData?.length ?? 0} available tools`);

    // 7. Convert to Canvas data (reuse canvas-common utility)
    this.logger.log('[Autogen] Generating canvas nodes and edges');
    const {
      nodes: generatedNodes,
      edges,
      variables,
    } = generateCanvasDataFromWorkflowPlan(workflowPlan, toolsData ?? [], {
      autoLayout: true,
      defaultModel: defaultModel ? providerItem2ModelInfo(defaultModel as any) : undefined,
      startNodes,
    });

    // Merge preserved start nodes with generated workflow nodes
    const startNodeIds = new Set(startNodes.map((node) => node.id));
    const mergedNodes = [
      ...startNodes,
      ...generatedNodes.filter((node) => !startNodeIds.has(node.id)),
    ];
    const finalNodes = ensureStartNode(mergedNodes as CanvasNode[]);
    this.logger.log(
      `[Autogen] Generated ${finalNodes.length} nodes (including ${startNodes.length} start nodes) and ${edges.length} edges`,
    );

    // 8. Update Canvas state (reuse CanvasSyncService)
    await this.updateCanvasState(canvasId, finalNodes, edges, variables, user);
    this.logger.log(`[Autogen] Canvas ${canvasId} updated successfully`);

    // 9. Update canvas title with workflow plan title (if new canvas was created)
    if (!request.canvasId && workflowPlan.title) {
      await this.canvasService.updateCanvas(user, {
        canvasId,
        title: workflowPlan.title,
      });
      this.logger.log(`[Autogen] Canvas title updated to: ${workflowPlan.title}`);
    }

    return {
      canvasId,
      workflowPlan,
      sessionId: actionResult.copilotSessionId!,
      resultId,
      nodesCount: finalNodes.length,
      edgesCount: edges.length,
    };
  }

  /**
   * Generate workflow for CLI - Enhanced method with planId and full plan details
   * This method is specifically designed for CLI usage with additional features:
   * - Returns planId for future operations (patch, version tracking)
   * - Returns full workflow plan details for display
   * - Supports timeout configuration
   * - Supports skipDefaultNodes option
   */
  async generateWorkflowForCli(
    user: User,
    request: GenerateWorkflowCliRequest,
  ): Promise<GenerateWorkflowCliResponse> {
    this.logger.log(`[Autogen CLI] Starting workflow generation for user ${user.uid}`);
    this.logger.log(`[Autogen CLI] Query: ${request.query}`);

    // 2. Determine or create Canvas (reuse CanvasService)
    let canvasId = request.canvasId;
    if (!canvasId) {
      const skipDefaultNodes = request.skipDefaultNodes ?? false;
      this.logger.log(`[Autogen CLI] Creating new canvas (skipDefaultNodes: ${skipDefaultNodes})`);
      const canvas = await this.canvasService.createCanvas(
        user,
        {
          title: `Workflow: ${request.query.slice(0, 50)}`,
          variables: request.variables,
        },
        { skipDefaultNodes },
      );
      canvasId = canvas.canvasId;
      this.logger.log(`[Autogen CLI] Created canvas: ${canvasId}`);
    } else {
      this.logger.log(`[Autogen CLI] Using existing canvas: ${canvasId}`);
    }

    // 2.1 Get existing start nodes from canvas as workflow entry points
    const rawCanvas = await this.canvasService.getCanvasRawData(user, canvasId, {
      checkOwnership: false,
    });
    // Preserve only start nodes as workflow entry points
    const startNodes = (rawCanvas.nodes ?? []).filter((node) => node.type === 'start');
    this.logger.log(`[Autogen CLI] Found ${startNodes.length} start nodes in canvas`);

    // 3. Invoke Copilot Agent (reuse SkillService)
    this.logger.log('[Autogen CLI] Invoking Copilot Agent');
    const invokeRequest: InvokeSkillRequest = {
      input: { query: request.query },
      mode: 'copilot_agent',
      target: { entityId: canvasId, entityType: 'canvas' },
      locale: request.locale,
      modelItemId: request.modelItemId,
    };

    const { resultId } = await this.skillService.sendInvokeSkillTask(user, invokeRequest);
    this.logger.log(`[Autogen CLI] Copilot invoked, resultId: ${resultId}`);

    // 4. Poll and wait for completion (reuse ActionService)
    const timeout = request.timeout ?? 300000; // Default 5 minutes
    this.logger.log(`[Autogen CLI] Waiting for Copilot completion (timeout: ${timeout}ms)...`);
    const actionResult = await this.waitForActionCompletion(user, resultId, timeout);
    this.logger.log(`[Autogen CLI] Copilot completed with status: ${actionResult.status}`);

    // 5. Extract Workflow Plan Reference (planId + version)
    const { planRef, reason } = this.extractWorkflowPlanRef(actionResult);
    if (!planRef) {
      this.logger.error(`[Autogen CLI] Failed to extract workflow plan reference: ${reason}`);
      throw new Error(
        `Failed to extract workflow plan from Copilot response. ${reason ?? 'Unknown reason'}`,
      );
    }
    this.logger.log(
      `[Autogen CLI] Extracted workflow plan reference: planId=${planRef.planId}, version=${planRef.version}`,
    );

    // 5.1 Fetch full workflow plan from database
    const workflowPlanRecord = await this.workflowPlanService.getWorkflowPlanDetail(user, {
      planId: planRef.planId,
      version: planRef.version,
    });
    if (!workflowPlanRecord) {
      this.logger.error(`[Autogen CLI] Failed to fetch workflow plan: ${planRef.planId}`);
      throw new Error(`Failed to fetch workflow plan with ID: ${planRef.planId}`);
    }
    const workflowPlan: WorkflowPlan = {
      title: workflowPlanRecord.title,
      tasks: workflowPlanRecord.tasks,
      variables: workflowPlanRecord.variables,
    };
    this.logger.log(
      `[Autogen CLI] Fetched workflow plan with ${workflowPlan.tasks?.length ?? 0} tasks`,
    );

    // 6. Get tools list and default model (reuse ToolService and ProviderService)
    const toolsData = await this.toolService.listAllToolsForCopilot(user);
    const defaultModel = await this.providerService.findDefaultProviderItem(
      user,
      'agent' as ModelScene,
    );
    this.logger.log(`[Autogen CLI] Using ${toolsData?.length ?? 0} available tools`);

    // 7. Convert to Canvas data (reuse canvas-common utility)
    this.logger.log('[Autogen CLI] Generating canvas nodes and edges');
    const {
      nodes: generatedNodes,
      edges,
      variables,
    } = generateCanvasDataFromWorkflowPlan(workflowPlan, toolsData ?? [], {
      autoLayout: true,
      defaultModel: defaultModel ? providerItem2ModelInfo(defaultModel as any) : undefined,
      startNodes,
    });

    // Merge preserved start nodes with generated workflow nodes
    const startNodeIds = new Set(startNodes.map((node) => node.id));
    const mergedNodes = [
      ...startNodes,
      ...generatedNodes.filter((node) => !startNodeIds.has(node.id)),
    ];

    // Ensure at least one start node exists (workflow entry point is required)
    // This handles the case when the canvas was empty or had no start nodes
    const finalNodes = ensureStartNode(mergedNodes as CanvasNode[]);
    this.logger.log(
      `[Autogen CLI] Generated ${finalNodes.length} nodes (including start nodes) and ${edges.length} edges`,
    );

    // 8. Update Canvas state (reuse CanvasSyncService)
    await this.updateCanvasState(canvasId, finalNodes, edges, variables, user);
    this.logger.log(`[Autogen CLI] Canvas ${canvasId} updated successfully`);

    // 9. Update canvas title with workflow plan title (if new canvas was created)
    if (!request.canvasId && workflowPlan.title) {
      await this.canvasService.updateCanvas(user, {
        canvasId,
        title: workflowPlan.title,
      });
      this.logger.log(`[Autogen CLI] Canvas title updated to: ${workflowPlan.title}`);
    }

    return {
      canvasId,
      workflowPlan,
      planId: planRef.planId,
      sessionId: actionResult.copilotSessionId!,
      resultId,
      nodesCount: finalNodes.length,
      edgesCount: edges.length,
    };
  }

  /**
   * Edit workflow for CLI - Uses natural language to edit an existing workflow
   * Supports both generate_workflow and patch_workflow tool outputs from Copilot.
   */
  async editWorkflowForCli(
    user: User,
    request: EditWorkflowCliRequest,
  ): Promise<EditWorkflowCliResponse> {
    const {
      canvasId,
      query,
      locale,
      modelItemId,
      timeout = 60000,
      sessionId: providedSessionId,
    } = request;

    this.logger.log(`[Autogen Edit] Starting workflow edit for canvas ${canvasId}`);
    this.logger.log(`[Autogen Edit] Query: ${query}`);

    // 1. Validate canvas exists and belongs to user
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) {
      this.logger.error(`[Autogen Edit] Canvas ${canvasId} not found or access denied`);
      throw new Error(`Canvas ${canvasId} not found or access denied`);
    }

    // 2. Determine copilot session ID for context continuity
    // Priority: provided sessionId > existing session for canvas > create new
    let copilotSessionId: string | undefined = providedSessionId;

    if (!copilotSessionId) {
      // First try: find session by exact canvasId match
      let session = await this.prisma.copilotSession.findFirst({
        where: { canvasId, uid: user.uid },
        orderBy: { createdAt: 'desc' },
      });

      // Fallback: if no session found for this canvas, check actionResult table
      // which stores the actual copilotSessionId used for this canvas
      if (!session) {
        this.logger.log('[Autogen Edit] No session found by canvasId, checking actionResult...');
        const actionResult = await this.prisma.actionResult.findFirst({
          where: {
            uid: user.uid,
            targetId: canvasId,
            copilotSessionId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (actionResult?.copilotSessionId) {
          session = await this.prisma.copilotSession.findFirst({
            where: { sessionId: actionResult.copilotSessionId },
          });
        }
      }

      copilotSessionId = session?.sessionId;
      this.logger.log(
        `[Autogen Edit] Found existing session: ${copilotSessionId ?? 'none (will create new)'}`,
      );
    } else {
      this.logger.log(`[Autogen Edit] Using provided session: ${copilotSessionId}`);
    }

    // 3. Invoke Copilot Agent
    const invokeRequest: InvokeSkillRequest = {
      input: { query },
      mode: 'copilot_agent',
      target: { entityId: canvasId, entityType: 'canvas' },
      locale,
      modelItemId,
      copilotSessionId,
    };

    const { resultId } = await this.skillService.sendInvokeSkillTask(user, invokeRequest);
    this.logger.log(`[Autogen Edit] Copilot invoked, resultId: ${resultId}`);

    // 4. Wait for Copilot completion
    this.logger.log(`[Autogen Edit] Waiting for Copilot completion (timeout: ${timeout}ms)...`);
    const actionResult = await this.waitForActionCompletion(user, resultId, timeout);
    this.logger.log(`[Autogen Edit] Copilot completed with status: ${actionResult.status}`);

    // 5. Extract result (supports both generate_workflow and patch_workflow)
    const { planRef, toolUsed, reason } = this.extractWorkflowEditResult(actionResult);
    if (!planRef) {
      this.logger.error(`[Autogen Edit] Failed to extract workflow edit result: ${reason}`);
      throw new Error(reason || 'Failed to edit workflow');
    }
    this.logger.log(
      `[Autogen Edit] Extracted result: planId=${planRef.planId}, version=${planRef.version}, toolUsed=${toolUsed}`,
    );

    // 6. Fetch full plan from database
    const plan = await this.workflowPlanService.getWorkflowPlanDetail(user, {
      planId: planRef.planId,
      version: planRef.version,
    });
    if (!plan) {
      this.logger.error(`[Autogen Edit] Failed to fetch workflow plan: ${planRef.planId}`);
      throw new Error(`Failed to fetch workflow plan with ID: ${planRef.planId}`);
    }
    this.logger.log(`[Autogen Edit] Fetched workflow plan with ${plan.tasks?.length ?? 0} tasks`);

    // 7. Auto-approve: Apply workflow plan to canvas
    // Get canvas raw data and preserve start nodes
    const rawCanvas = await this.canvasService.getCanvasRawData(user, canvasId, {
      checkOwnership: true,
    });
    const startNodes = (rawCanvas.nodes ?? []).filter((node) => node.type === 'start');
    this.logger.log(`[Autogen Edit] Found ${startNodes.length} start nodes in canvas`);

    // Get tools list and default model
    const toolsData = await this.toolService.listAllToolsForCopilot(user);
    const defaultModel = await this.providerService.findDefaultProviderItem(
      user,
      'agent' as ModelScene,
    );
    this.logger.log(`[Autogen Edit] Using ${toolsData?.length ?? 0} available tools`);

    // Convert workflow plan to canvas data
    const workflowPlan: WorkflowPlan = {
      title: plan.title,
      tasks: plan.tasks,
      variables: plan.variables,
    };
    const {
      nodes: generatedNodes,
      edges,
      variables,
    } = generateCanvasDataFromWorkflowPlan(workflowPlan, toolsData ?? [], {
      autoLayout: true,
      defaultModel: defaultModel ? providerItem2ModelInfo(defaultModel as any) : undefined,
      startNodes,
    });

    // Merge preserved start nodes with generated workflow nodes
    const startNodeIds = new Set(startNodes.map((node) => node.id));
    const mergedNodes = [
      ...startNodes,
      ...generatedNodes.filter((node) => !startNodeIds.has(node.id)),
    ];
    const finalNodes = ensureStartNode(mergedNodes as CanvasNode[]);
    this.logger.log(
      `[Autogen Edit] Generated ${finalNodes.length} nodes and ${edges.length} edges`,
    );

    // Update canvas state
    await this.updateCanvasState(canvasId, finalNodes, edges, variables, user);
    this.logger.log(`[Autogen Edit] Canvas ${canvasId} updated successfully (auto-approved)`);

    return {
      canvasId,
      planId: planRef.planId,
      version: planRef.version,
      toolUsed: toolUsed!,
      plan,
      sessionId: copilotSessionId,
    };
  }

  /**
   * Start async workflow generation - returns immediately with session info
   * The actual generation runs in background. Use getGenerateStatus to poll for progress.
   */
  async startGenerateWorkflowAsync(
    user: User,
    request: GenerateWorkflowCliRequest & { sessionId: string },
  ): Promise<GenerateWorkflowAsyncResponse> {
    this.logger.log(`[Autogen Async] Starting async workflow generation for user ${user.uid}`);

    // 1. Create or get canvas
    let canvasId = request.canvasId;
    if (!canvasId) {
      const skipDefaultNodes = request.skipDefaultNodes ?? false;
      this.logger.log(
        `[Autogen Async] Creating new canvas (skipDefaultNodes: ${skipDefaultNodes})`,
      );
      const canvas = await this.canvasService.createCanvas(
        user,
        {
          title: `Workflow: ${request.query.slice(0, 50)}`,
          variables: request.variables,
        },
        { skipDefaultNodes },
      );
      canvasId = canvas.canvasId;
    }

    // 2. Invoke Copilot Agent (async - don't wait)
    const invokeRequest: InvokeSkillRequest = {
      input: { query: request.query },
      mode: 'copilot_agent',
      target: { entityId: canvasId, entityType: 'canvas' },
      locale: request.locale,
      modelItemId: request.modelItemId,
      copilotSessionId: request.sessionId,
    };

    const { resultId } = await this.skillService.sendInvokeSkillTask(user, invokeRequest);
    this.logger.log(
      `[Autogen Async] Started generation, resultId: ${resultId}, sessionId: ${request.sessionId}`,
    );

    return {
      sessionId: request.sessionId,
      canvasId,
      resultId,
      status: 'executing',
    };
  }

  /**
   * Get generation status for polling - supports streaming-like progress updates
   */
  async getGenerateStatus(
    user: User,
    sessionId: string,
    canvasId?: string,
  ): Promise<GenerateStatusResponse> {
    this.logger.debug(`[Autogen Status] Checking status for session: ${sessionId}`);

    // 1. Find action result by copilotSessionId
    const actionResult = await this.findActionResultBySession(user, sessionId);

    if (!actionResult) {
      return { status: 'pending', progress: 'Initializing...' };
    }

    // 2. Check status
    if (actionResult.status === 'executing' || actionResult.status === 'waiting') {
      const progress = this.extractProgressFromAction(actionResult);
      return {
        status: 'executing',
        progress: progress.message,
        stepIndex: progress.stepIndex,
        totalSteps: progress.totalSteps,
      };
    }

    if (actionResult.status === 'failed') {
      // errors is a string array (parsed from JSON), not an object array
      const errorMessage = actionResult.errors?.[0] || 'Generation failed';
      return {
        status: 'failed',
        error: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
      };
    }

    // 3. Completed - build full result
    if (actionResult.status === 'finish') {
      try {
        const result = await this.buildCompletedResult(user, actionResult, canvasId);
        return {
          status: 'completed',
          progress: 'Workflow generated successfully',
          result,
        };
      } catch (error) {
        this.logger.error(`[Autogen Status] Failed to build result: ${(error as Error).message}`);
        return {
          status: 'failed',
          error: `Failed to process result: ${(error as Error).message}`,
        };
      }
    }

    return { status: 'pending', progress: 'Processing...' };
  }

  /**
   * Find action result by copilot session ID
   */
  private async findActionResultBySession(
    user: User,
    sessionId: string,
  ): Promise<ActionDetail | null> {
    try {
      // Query action results by copilotSessionId
      const actionResultPO = await this.prisma.actionResult.findFirst({
        where: {
          uid: user.uid,
          copilotSessionId: sessionId,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!actionResultPO) {
        return null;
      }

      return this.actionService.getActionResult(user, { resultId: actionResultPO.resultId });
    } catch (error) {
      this.logger.error(
        `[Autogen Status] Error finding action result: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Extract progress information from action result for UI display
   */
  private extractProgressFromAction(actionResult: ActionDetail): {
    message: string;
    stepIndex: number;
    totalSteps: number;
  } {
    const steps = actionResult.steps ?? [];
    const currentStep = steps[steps.length - 1];

    // Check tool calls for more specific progress
    const toolCalls = currentStep?.toolCalls ?? [];
    const lastToolCall = toolCalls[toolCalls.length - 1];

    if (lastToolCall) {
      const toolName = lastToolCall.toolName;
      if (toolName === 'generate_workflow') {
        return {
          message: 'Generating workflow plan...',
          stepIndex: 2,
          totalSteps: 3,
        };
      }
      if (toolName === 'patch_workflow') {
        return {
          message: 'Updating workflow...',
          stepIndex: 2,
          totalSteps: 3,
        };
      }
    }

    // Default progress based on step content
    if (currentStep?.content) {
      const content = currentStep.content.toLowerCase();
      if (content.includes('analyz')) {
        return { message: 'Analyzing requirements...', stepIndex: 1, totalSteps: 3 };
      }
      if (content.includes('creat') || content.includes('generat')) {
        return { message: 'Creating workflow tasks...', stepIndex: 2, totalSteps: 3 };
      }
    }

    return {
      message: 'Processing...',
      stepIndex: steps.length,
      totalSteps: 3,
    };
  }

  /**
   * Build completed result from finished action
   * Returns WorkflowCliResponse (from workflow-cli.dto.ts) which includes workflowId
   */
  private async buildCompletedResult(
    user: User,
    actionResult: ActionDetail,
    canvasId?: string,
  ): Promise<WorkflowCliResponse> {
    // Extract plan reference
    const { planRef, reason } = this.extractWorkflowPlanRef(actionResult);
    if (!planRef) {
      throw new Error(reason || 'Failed to extract workflow plan reference');
    }

    // Fetch full plan from database
    const workflowPlanRecord = await this.workflowPlanService.getWorkflowPlanDetail(user, {
      planId: planRef.planId,
      version: planRef.version,
    });
    if (!workflowPlanRecord) {
      throw new Error(`Failed to fetch workflow plan: ${planRef.planId}`);
    }

    const workflowPlan: WorkflowPlan = {
      title: workflowPlanRecord.title,
      tasks: workflowPlanRecord.tasks,
      variables: workflowPlanRecord.variables,
    };

    // Get canvas ID from action result target if not provided
    const finalCanvasId = canvasId || actionResult.targetId || '';

    // Get tools and default model
    const toolsData = await this.toolService.listAllToolsForCopilot(user);
    const defaultModel = await this.providerService.findDefaultProviderItem(
      user,
      'agent' as ModelScene,
    );

    // Get start nodes from canvas
    const rawCanvas = await this.canvasService.getCanvasRawData(user, finalCanvasId, {
      checkOwnership: false,
    });
    const startNodes = (rawCanvas.nodes ?? []).filter((node) => node.type === 'start');

    // Generate canvas data
    const {
      nodes: generatedNodes,
      edges,
      variables,
    } = generateCanvasDataFromWorkflowPlan(workflowPlan, toolsData ?? [], {
      autoLayout: true,
      defaultModel: defaultModel ? providerItem2ModelInfo(defaultModel as any) : undefined,
      startNodes,
    });

    // Merge nodes
    const startNodeIds = new Set(startNodes.map((node) => node.id));
    const mergedNodes = [
      ...startNodes,
      ...generatedNodes.filter((node) => !startNodeIds.has(node.id)),
    ];
    const finalNodes = ensureStartNode(mergedNodes as CanvasNode[]);

    // Update canvas state
    await this.updateCanvasState(finalCanvasId, finalNodes, edges, variables, user);

    // Update canvas title with workflow plan title (if new canvas was created)
    if (!canvasId && workflowPlan.title) {
      await this.canvasService.updateCanvas(user, {
        canvasId: finalCanvasId,
        title: workflowPlan.title,
      });
      this.logger.log(`[Autogen Async] Canvas title updated to: ${workflowPlan.title}`);
    }

    return {
      workflowId: finalCanvasId, // workflowId is same as canvasId
      canvasId: finalCanvasId,
      workflowPlan,
      planId: planRef.planId,
      sessionId: actionResult.copilotSessionId!,
      resultId: actionResult.resultId,
      nodesCount: finalNodes.length,
      edgesCount: edges.length,
    };
  }

  /**
   * Poll and wait for Action completion
   * Reuse ActionService.getActionResult
   */
  private async waitForActionCompletion(
    user: User,
    resultId: string,
    maxWaitMs = 300000, // 5 minutes
  ): Promise<ActionDetail> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds
    let attempts = 0;

    while (Date.now() - startTime < maxWaitMs) {
      attempts++;
      this.logger.debug(`[Autogen] Polling attempt ${attempts} for result ${resultId}`);

      const result = await this.actionService.getActionResult(user, { resultId });

      if (result.status === 'finish') {
        this.logger.log(`[Autogen] Action completed after ${attempts} attempts`);
        return result;
      }

      if (result.status === 'failed') {
        const errorPayload = Array.isArray(result.errors) ? result.errors[0] : result.errors;
        let errorText = 'Copilot execution failed';
        if (errorPayload !== null && errorPayload !== undefined) {
          if (typeof errorPayload === 'string') {
            errorText = errorPayload;
          } else {
            try {
              errorText = JSON.stringify(errorPayload);
            } catch (_stringifyError) {
              errorText = String(errorPayload);
            }
          }
        }
        const reason = errorText.startsWith('Copilot execution failed')
          ? errorText
          : `Copilot execution failed: ${errorText}`;
        const detailedReason = this.appendModelResponse(reason, result) ?? reason;
        this.logger.error(`[Autogen] Action failed: ${reason}`);
        const error = new Error(detailedReason);
        this.attachModelResponse(error, result);
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    this.logger.error('[Autogen] Timeout waiting for Copilot completion');
    throw new Error('Timeout waiting for Copilot to complete');
  }

  private getModelResponseSnippet(actionResult: ActionDetail, maxLength = 500): string | null {
    const steps = actionResult.steps ?? [];
    const stepContent = steps.find(
      (step) => typeof step?.content === 'string' && step.content.trim(),
    )?.content;
    const messageContent = actionResult.messages?.find(
      (message) => typeof message?.content === 'string' && message.content.trim(),
    )?.content;
    const rawContent = stepContent ?? messageContent;
    if (!rawContent) {
      return null;
    }
    const normalized = rawContent.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return null;
    }
    if (normalized.length > maxLength) {
      return `${normalized.slice(0, maxLength)}...`;
    }
    return normalized;
  }

  private getModelResponseRaw(actionResult: ActionDetail, maxLength = 2000): string | null {
    const steps = actionResult.steps ?? [];
    let stepContent: string | undefined;
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const content = steps[index]?.content;
      if (typeof content === 'string' && content.trim()) {
        stepContent = content;
        break;
      }
    }

    const messages = actionResult.messages ?? [];
    let messageContent: string | undefined;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const content = messages[index]?.content;
      if (typeof content === 'string' && content.trim()) {
        messageContent = content;
        break;
      }
    }

    const rawContent = stepContent ?? messageContent;
    if (!rawContent) {
      return null;
    }
    if (!rawContent.trim()) {
      return null;
    }
    if (rawContent.length > maxLength) {
      return `${rawContent.slice(0, maxLength)}...`;
    }
    return rawContent;
  }

  private attachModelResponse(error: Error, actionResult: ActionDetail): void {
    const rawResponse = this.getModelResponseRaw(actionResult);
    if (rawResponse) {
      (error as Error & { modelResponse?: string }).modelResponse = rawResponse;
    }
  }

  private appendModelResponse(
    reason: string | undefined,
    actionResult: ActionDetail,
  ): string | undefined {
    const snippet = this.getModelResponseSnippet(actionResult);
    if (!snippet) {
      return reason;
    }
    if (!reason) {
      return `Model response: ${snippet}`;
    }
    return `${reason} Model response: ${snippet}`;
  }

  /**
   * Extract Workflow Plan from ActionResult (for original generateWorkflow method)
   * Reference frontend logic (session-detail.tsx)
   */
  private extractWorkflowPlan(actionResult: ActionDetail): {
    plan: WorkflowPlan | null;
    reason?: string;
  } {
    const steps = actionResult.steps ?? [];
    if (steps.length === 0) {
      this.logger.warn('[Autogen] No steps found in action result');
      return {
        plan: null,
        reason: this.appendModelResponse(
          'No steps found in Copilot response. The action result may be incomplete.',
          actionResult,
        ),
      };
    }

    const toolCalls = steps[0]?.toolCalls ?? [];
    this.logger.debug(`[Autogen] Found ${toolCalls.length} tool calls in step 0`);

    // Check if Copilot is asking questions instead of generating workflow
    const firstStepContent = steps[0]?.content;
    if (toolCalls.length === 0 && firstStepContent) {
      this.logger.warn('[Autogen] Copilot did not call any tools, possibly asking questions');
      return {
        plan: null,
        reason: this.appendModelResponse(
          'Copilot did not generate a workflow. It may be asking for clarification or more information. Please refine your input query to be more specific and complete.',
          actionResult,
        ),
      };
    }

    const workflowToolCall = toolCalls.find((call) => call.toolName === 'generate_workflow');
    if (!workflowToolCall) {
      const availableTools = toolCalls.map((call) => call.toolName).join(', ');
      this.logger.warn(
        `[Autogen] No generate_workflow tool call found. Available tools: ${availableTools}`,
      );
      return {
        plan: null,
        reason: this.appendModelResponse(
          `Copilot called other tools (${availableTools}) but not 'generate_workflow'. Please adjust your query to explicitly request workflow generation.`,
          actionResult,
        ),
      };
    }

    if (!workflowToolCall.output) {
      this.logger.warn('[Autogen] generate_workflow tool call has no output');
      return {
        plan: null,
        reason: this.appendModelResponse(
          'generate_workflow tool was called but returned no output. This may indicate an internal error.',
          actionResult,
        ),
      };
    }

    const output =
      typeof workflowToolCall.output === 'string'
        ? safeParseJSON(workflowToolCall.output)
        : workflowToolCall.output;

    const plan = (output as { data: WorkflowPlan })?.data ?? null;

    if (plan) {
      this.logger.log('[Autogen] Successfully extracted workflow plan');
      return { plan };
    } else {
      this.logger.warn('[Autogen] Workflow plan data field is missing');
      return {
        plan: null,
        reason: this.appendModelResponse(
          'Workflow plan data field is missing from generate_workflow tool output.',
          actionResult,
        ),
      };
    }
  }

  /**
   * Extract Workflow Plan Reference (planId + version) from ActionResult (for CLI method)
   * Note: generate_workflow tool returns { planId, version }, NOT the full plan.
   * The full plan must be fetched via WorkflowPlanService.getWorkflowPlanDetail()
   */
  private extractWorkflowPlanRef(actionResult: ActionDetail): {
    planRef: WorkflowPlanRef | null;
    reason?: string;
  } {
    const steps = actionResult.steps ?? [];
    if (steps.length === 0) {
      this.logger.warn('[Autogen CLI] No steps found in action result');
      return {
        planRef: null,
        reason: this.appendModelResponse(
          'No steps found in Copilot response. The action result may be incomplete.',
          actionResult,
        ),
      };
    }

    const toolCalls = steps[0]?.toolCalls ?? [];
    this.logger.debug(`[Autogen CLI] Found ${toolCalls.length} tool calls in step 0`);

    // Check if Copilot is asking questions instead of generating workflow
    const firstStepContent = steps[0]?.content;
    if (toolCalls.length === 0 && firstStepContent) {
      this.logger.warn('[Autogen CLI] Copilot did not call any tools, possibly asking questions');
      return {
        planRef: null,
        reason: this.appendModelResponse(
          'Copilot did not generate a workflow. It may be asking for clarification or more information. Please refine your input query to be more specific and complete.',
          actionResult,
        ),
      };
    }

    const workflowToolCall = toolCalls.find((call) => call.toolName === 'generate_workflow');
    if (!workflowToolCall) {
      const availableTools = toolCalls.map((call) => call.toolName).join(', ');
      this.logger.warn(
        `[Autogen CLI] No generate_workflow tool call found. Available tools: ${availableTools}`,
      );
      return {
        planRef: null,
        reason: this.appendModelResponse(
          `Copilot called other tools (${availableTools}) but not 'generate_workflow'. Please adjust your query to explicitly request workflow generation.`,
          actionResult,
        ),
      };
    }

    if (!workflowToolCall.output) {
      this.logger.warn('[Autogen CLI] generate_workflow tool call has no output');
      return {
        planRef: null,
        reason: this.appendModelResponse(
          'generate_workflow tool was called but returned no output. This may indicate an internal error.',
          actionResult,
        ),
      };
    }

    const output =
      typeof workflowToolCall.output === 'string'
        ? safeParseJSON(workflowToolCall.output)
        : workflowToolCall.output;

    // Extract planId and version from tool output
    // Tool returns: { status: 'success', data: { planId, version } }
    const data = (output as { data?: { planId?: string; version?: number } })?.data;
    if (!data?.planId) {
      this.logger.warn(
        '[Autogen CLI] Workflow plan reference (planId) is missing from tool output',
      );
      return {
        planRef: null,
        reason: this.appendModelResponse(
          'Workflow plan reference (planId) is missing from generate_workflow tool output.',
          actionResult,
        ),
      };
    }

    const planRef: WorkflowPlanRef = {
      planId: data.planId,
      version: data.version ?? 0,
    };

    this.logger.log(
      `[Autogen CLI] Successfully extracted workflow plan reference: ${planRef.planId}`,
    );
    return { planRef };
  }

  /**
   * Extract Workflow Edit Result from ActionResult
   * Supports both generate_workflow and patch_workflow tool outputs.
   * Used by editWorkflowForCli method.
   */
  private extractWorkflowEditResult(actionResult: ActionDetail): {
    planRef: WorkflowPlanRef | null;
    toolUsed: 'generate_workflow' | 'patch_workflow' | null;
    reason?: string;
  } {
    const steps = actionResult.steps ?? [];
    if (steps.length === 0) {
      this.logger.warn('[Autogen Edit] No steps found in action result');
      return { planRef: null, toolUsed: null, reason: 'No steps in response' };
    }

    const toolCalls = steps[0]?.toolCalls ?? [];

    // Check if Copilot is asking questions instead of calling workflow tools
    const firstStepContent = steps[0]?.content;
    if (toolCalls.length === 0 && firstStepContent) {
      this.logger.warn('[Autogen Edit] Copilot did not call any tools, possibly asking questions');
      return {
        planRef: null,
        toolUsed: null,
        reason:
          'Copilot did not call workflow tools. It may be asking for clarification. Please refine your edit instruction.',
      };
    }

    // Check for patch_workflow first (more likely in edit scenario)
    let toolCall = toolCalls.find((c) => c.toolName === 'patch_workflow');
    let toolUsed: 'patch_workflow' | 'generate_workflow' | null = toolCall
      ? 'patch_workflow'
      : null;

    // Fallback to generate_workflow
    if (!toolCall) {
      toolCall = toolCalls.find((c) => c.toolName === 'generate_workflow');
      toolUsed = toolCall ? 'generate_workflow' : null;
    }

    if (!toolCall) {
      const availableTools = toolCalls.map((c) => c.toolName).join(', ');
      this.logger.warn(
        `[Autogen Edit] No workflow tool call found. Available tools: ${availableTools}`,
      );
      return {
        planRef: null,
        toolUsed: null,
        reason: `Copilot did not call workflow tools. Called: ${availableTools || 'none'}`,
      };
    }

    if (!toolCall.output) {
      this.logger.warn(`[Autogen Edit] ${toolUsed} tool call has no output`);
      return { planRef: null, toolUsed: null, reason: 'Tool call has no output' };
    }

    const output =
      typeof toolCall.output === 'string' ? safeParseJSON(toolCall.output) : toolCall.output;

    // Extract planId and version from tool output
    // Both tools return: { status: 'success', data: { planId, version } }
    const data = (output as { data?: { planId?: string; version?: number } })?.data;
    if (!data?.planId) {
      this.logger.warn('[Autogen Edit] Missing planId in tool output');
      return { planRef: null, toolUsed: null, reason: 'Missing planId in tool output' };
    }

    const planRef: WorkflowPlanRef = {
      planId: data.planId,
      version: data.version ?? 0,
    };

    this.logger.log(
      `[Autogen Edit] Successfully extracted result: planId=${planRef.planId}, toolUsed=${toolUsed}`,
    );
    return { planRef, toolUsed };
  }

  /**
   * Update Canvas state
   * Reuse CanvasSyncService
   */
  private async updateCanvasState(
    canvasId: string,
    nodes: any[],
    edges: any[],
    variables: any[],
    _user: User,
  ): Promise<void> {
    this.logger.log(`[Autogen] Updating canvas state for ${canvasId}`);

    try {
      // Create new canvas state with nodes and edges
      const newState = {
        ...initEmptyCanvasState(),
        nodes,
        edges,
      };

      this.logger.debug(
        `[Autogen] Created state with ${nodes.length} nodes and ${edges.length} edges`,
      );

      // Save state using CanvasSyncService
      const stateStorageKey = await this.canvasSyncService.saveState(canvasId, newState);
      this.logger.log(`[Autogen] Canvas state saved with storage key: ${stateStorageKey}`);

      // Update Canvas metadata and version
      await this.prisma.canvas.update({
        where: { canvasId },
        data: {
          version: newState.version,
          workflow: JSON.stringify({ variables }),
        },
      });

      // Create canvas version record
      await this.prisma.canvasVersion.create({
        data: {
          canvasId,
          version: newState.version,
          hash: '',
          stateStorageKey,
        },
      });

      this.logger.log('[Autogen] Canvas metadata and version updated');
    } catch (error) {
      this.logger.error(`[Autogen] Failed to update canvas state: ${error.message}`);
      throw error;
    }
  }
}
