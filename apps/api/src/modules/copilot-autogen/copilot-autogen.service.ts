import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from '../skill/skill.service';
import { ActionService } from '../action/action.service';
import { CanvasService } from '../canvas/canvas.service';
import { ToolService } from '../tool/tool.service';
import { ProviderService } from '../provider/provider.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { User, InvokeSkillRequest, ModelScene } from '@refly/openapi-schema';
import { generateCanvasDataFromWorkflowPlan, WorkflowPlan } from '@refly/canvas-common';
import { safeParseJSON } from '@refly/utils';
import { GenerateWorkflowRequest, GenerateWorkflowResponse } from './copilot-autogen.dto';
import { ActionDetail } from '../action/action.dto';
import { initEmptyCanvasState } from '@refly/canvas-common';
import { providerItem2ModelInfo } from '../provider/provider.dto';

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
  ) {}

  async generateWorkflow(request: GenerateWorkflowRequest): Promise<GenerateWorkflowResponse> {
    this.logger.log(`[Autogen] Starting workflow generation for user ${request.uid}`);
    this.logger.log(`[Autogen] Query: ${request.query}`);

    // 1. Get user object (reuse Prisma)
    const user = await this.prisma.user.findUnique({ where: { uid: request.uid } });
    if (!user) {
      this.logger.error(`[Autogen] User not found: ${request.uid}`);
      throw new Error('User not found');
    }

    // 2. Determine or create Canvas (reuse CanvasService)
    let canvasId = request.canvasId;
    if (!canvasId) {
      this.logger.log('[Autogen] Creating new canvas');
      const canvas = await this.canvasService.createCanvas(user, {
        title: `Workflow: ${request.query.slice(0, 50)}`,
        projectId: request.projectId,
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
      projectId: request.projectId,
      locale: request.locale,
      modelItemId: request.modelItemId,
    };

    const { resultId } = await this.skillService.sendInvokeSkillTask(user, invokeRequest);
    this.logger.log(`[Autogen] Copilot invoked, resultId: ${resultId}`);

    // 4. Poll and wait for completion (reuse ActionService)
    this.logger.log('[Autogen] Waiting for Copilot completion...');
    const actionResult = await this.waitForActionCompletion(user, resultId);
    this.logger.log(`[Autogen] Copilot completed with status: ${actionResult.status}`);

    // 5. Extract Workflow Plan
    const workflowPlan = this.extractWorkflowPlan(actionResult);
    if (!workflowPlan) {
      this.logger.error('[Autogen] Failed to extract workflow plan');
      throw new Error('Failed to extract workflow plan from Copilot response');
    }
    this.logger.log(
      `[Autogen] Extracted workflow plan with ${workflowPlan.tasks?.length ?? 0} tasks`,
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
    const finalNodes = [
      ...startNodes,
      ...generatedNodes.filter((node) => !startNodeIds.has(node.id)),
    ];
    this.logger.log(
      `[Autogen] Generated ${finalNodes.length} nodes (including ${startNodes.length} start nodes) and ${edges.length} edges`,
    );

    // 8. Update Canvas state (reuse CanvasSyncService)
    await this.updateCanvasState(canvasId, finalNodes, edges, variables, user);
    this.logger.log(`[Autogen] Canvas ${canvasId} updated successfully`);

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
   * Extract Workflow Plan from ActionResult
   * Reference frontend logic (session-detail.tsx)
   */
  private extractWorkflowPlan(actionResult: ActionDetail): WorkflowPlan | null {
    const steps = actionResult.steps ?? [];
    if (steps.length === 0) {
      this.logger.warn('[Autogen] No steps found in action result');
      return null;
    }

    const toolCalls = steps[0]?.toolCalls ?? [];
    this.logger.debug(`[Autogen] Found ${toolCalls.length} tool calls in step 0`);

    const workflowToolCall = toolCalls.find((call) => call.toolName === 'generate_workflow');
    if (!workflowToolCall) {
      this.logger.warn('[Autogen] No generate_workflow tool call found');
      return null;
    }

    if (!workflowToolCall.output) {
      this.logger.warn('[Autogen] generate_workflow tool call has no output');
      return null;
    }

    const output =
      typeof workflowToolCall.output === 'string'
        ? safeParseJSON(workflowToolCall.output)
        : workflowToolCall.output;

    const plan = (output as { data: WorkflowPlan })?.data ?? null;

    if (plan) {
      this.logger.log('[Autogen] Successfully extracted workflow plan');
    } else {
      this.logger.warn('[Autogen] Workflow plan data field is missing');
    }

    return plan;
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
