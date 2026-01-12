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
import { GenerateWorkflowRequest, GenerateWorkflowResponse } from './copilot-autogen.dto';
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

  async generateWorkflow(
    user: User,
    request: GenerateWorkflowRequest,
  ): Promise<GenerateWorkflowResponse> {
    this.logger.log(`[Autogen] Starting workflow generation for user ${user.uid}`);
    this.logger.log(`[Autogen] Query: ${request.query}`);

    // 2. Determine or create Canvas (reuse CanvasService)
    let canvasId = request.canvasId;
    if (!canvasId) {
      const skipDefaultNodes = request.skipDefaultNodes ?? false;
      this.logger.log(`[Autogen] Creating new canvas (skipDefaultNodes: ${skipDefaultNodes})`);
      const canvas = await this.canvasService.createCanvas(
        user,
        {
          title: `Workflow: ${request.query.slice(0, 50)}`,
          projectId: request.projectId,
          variables: request.variables,
        },
        { skipDefaultNodes },
      );
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
      projectId: request.projectId,
      locale: request.locale,
      modelItemId: request.modelItemId,
    };

    const { resultId } = await this.skillService.sendInvokeSkillTask(user, invokeRequest);
    this.logger.log(`[Autogen] Copilot invoked, resultId: ${resultId}`);

    // 4. Poll and wait for completion (reuse ActionService)
    const timeout = request.timeout ?? 300000; // Default 5 minutes
    this.logger.log(`[Autogen] Waiting for Copilot completion (timeout: ${timeout}ms)...`);
    const actionResult = await this.waitForActionCompletion(user, resultId, timeout);
    this.logger.log(`[Autogen] Copilot completed with status: ${actionResult.status}`);

    // 5. Extract Workflow Plan Reference (planId + version)
    const { planRef, reason } = this.extractWorkflowPlanRef(actionResult);
    if (!planRef) {
      this.logger.error(`[Autogen] Failed to extract workflow plan reference: ${reason}`);
      throw new Error(
        `Failed to extract workflow plan from Copilot response. ${reason ?? 'Unknown reason'}`,
      );
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
    const toolsData = await this.toolService.listTools(user, { enabled: true });
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

    // Ensure at least one start node exists (workflow entry point is required)
    // This handles the case when the canvas was empty or had no start nodes
    const finalNodes = ensureStartNode(mergedNodes as CanvasNode[]);
    this.logger.log(
      `[Autogen] Generated ${finalNodes.length} nodes (including start nodes) and ${edges.length} edges`,
    );

    // 8. Update Canvas state (reuse CanvasSyncService)
    await this.updateCanvasState(canvasId, finalNodes, edges, variables, user);
    this.logger.log(`[Autogen] Canvas ${canvasId} updated successfully`);

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
        this.logger.error(`[Autogen] Action failed: ${JSON.stringify(result.errors)}`);
        throw new Error(`Copilot execution failed: ${JSON.stringify(result.errors)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    this.logger.error('[Autogen] Timeout waiting for Copilot completion');
    throw new Error('Timeout waiting for Copilot to complete');
  }

  /**
   * Extract Workflow Plan Reference (planId + version) from ActionResult
   * Note: generate_workflow tool returns { planId, version }, NOT the full plan.
   * The full plan must be fetched via WorkflowPlanService.getWorkflowPlanDetail()
   */
  private extractWorkflowPlanRef(actionResult: ActionDetail): {
    planRef: WorkflowPlanRef | null;
    reason?: string;
  } {
    const steps = actionResult.steps ?? [];
    if (steps.length === 0) {
      this.logger.warn('[Autogen] No steps found in action result');
      return {
        planRef: null,
        reason: 'No steps found in Copilot response. The action result may be incomplete.',
      };
    }

    const toolCalls = steps[0]?.toolCalls ?? [];
    this.logger.debug(`[Autogen] Found ${toolCalls.length} tool calls in step 0`);

    // Check if Copilot is asking questions instead of generating workflow
    const firstStepContent = steps[0]?.content;
    if (toolCalls.length === 0 && firstStepContent) {
      this.logger.warn('[Autogen] Copilot did not call any tools, possibly asking questions');
      return {
        planRef: null,
        reason:
          'Copilot did not generate a workflow. It may be asking for clarification or more information. Please refine your input query to be more specific and complete.',
      };
    }

    const workflowToolCall = toolCalls.find((call) => call.toolName === 'generate_workflow');
    if (!workflowToolCall) {
      const availableTools = toolCalls.map((call) => call.toolName).join(', ');
      this.logger.warn(
        `[Autogen] No generate_workflow tool call found. Available tools: ${availableTools}`,
      );
      return {
        planRef: null,
        reason: `Copilot called other tools (${availableTools}) but not 'generate_workflow'. Please adjust your query to explicitly request workflow generation.`,
      };
    }

    if (!workflowToolCall.output) {
      this.logger.warn('[Autogen] generate_workflow tool call has no output');
      return {
        planRef: null,
        reason:
          'generate_workflow tool was called but returned no output. This may indicate an internal error.',
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
      this.logger.warn('[Autogen] Workflow plan reference (planId) is missing from tool output');
      return {
        planRef: null,
        reason: 'Workflow plan reference (planId) is missing from generate_workflow tool output.',
      };
    }

    const planRef: WorkflowPlanRef = {
      planId: data.planId,
      version: data.version ?? 0,
    };

    this.logger.log(`[Autogen] Successfully extracted workflow plan reference: ${planRef.planId}`);
    return { planRef };
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
