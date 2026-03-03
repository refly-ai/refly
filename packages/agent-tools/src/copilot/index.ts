import { z } from 'zod/v3';
import { AgentBaseTool, ToolCallResult } from '../base';
import {
  workflowPlanSchema,
  normalizeWorkflowPlan,
  parseWorkflowPlan,
  workflowPlanPatchSchema,
  parseWorkflowPlanPatch,
} from '@refly/canvas-common';
import { ReflyService } from '../builtin/interface';
import {
  User,
  WorkflowPlanRecord,
  WorkflowPatchOperation,
  CanvasNode,
} from '@refly/openapi-schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { truncateContent } from '@refly/utils/token';

interface CopilotToolParams {
  user: User;
  reflyService: ReflyService;
}

// ============================================================================
// Canvas Drift Detection
// ============================================================================

interface CanvasDrift {
  hasDrift: boolean;
  planTaskCount: number;
  canvasWorkflowNodeCount: number;
  missingFromCanvas: Array<{ taskId: string; title: string }>;
  addedOnCanvas: Array<{ nodeId: string; title: string; taskId?: string }>;
  summary: string;
}

function computeCanvasDrift(plan: WorkflowPlanRecord, canvasNodes: CanvasNode[]): CanvasDrift {
  const planTaskIds = new Set((plan.tasks ?? []).map((t) => t.id));

  const canvasTaskIds = new Map<string, CanvasNode>();
  const canvasWorkflowNodes: CanvasNode[] = [];

  for (const node of canvasNodes) {
    if (node.type === 'skillResponse') {
      canvasWorkflowNodes.push(node);
      const taskId = (node.data?.metadata as Record<string, unknown>)?.taskId as string | undefined;
      if (taskId) {
        canvasTaskIds.set(taskId, node);
      }
    }
  }

  const missingFromCanvas = (plan.tasks ?? [])
    .filter((t) => !canvasTaskIds.has(t.id))
    .map((t) => ({ taskId: t.id, title: t.title }));

  const addedOnCanvas = canvasWorkflowNodes
    .filter((n) => {
      const taskId = (n.data?.metadata as Record<string, unknown>)?.taskId as string | undefined;
      return !taskId || !planTaskIds.has(taskId);
    })
    .map((n) => ({
      nodeId: n.id,
      title: n.data?.title ?? '',
      taskId: (n.data?.metadata as Record<string, unknown>)?.taskId as string | undefined,
    }));

  const hasDrift = missingFromCanvas.length > 0 || addedOnCanvas.length > 0;

  let summary = 'Plan and canvas are in sync.';
  if (hasDrift) {
    const parts: string[] = [];
    if (missingFromCanvas.length > 0) {
      parts.push(`${missingFromCanvas.length} plan task(s) removed from canvas`);
    }
    if (addedOnCanvas.length > 0) {
      parts.push(`${addedOnCanvas.length} node(s) added to canvas outside plan`);
    }
    summary = `Drift detected: ${parts.join('; ')}.`;
  }

  return {
    hasDrift,
    planTaskCount: plan.tasks?.length ?? 0,
    canvasWorkflowNodeCount: canvasWorkflowNodes.length,
    missingFromCanvas,
    addedOnCanvas,
    summary,
  };
}

export class GenerateWorkflow extends AgentBaseTool<CopilotToolParams> {
  name = 'generate_workflow';
  toolsetKey = 'copilot';

  schema = workflowPlanSchema;

  description = 'Generate a complete workflow plan from scratch';

  protected params: CopilotToolParams;

  constructor(params: CopilotToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: unknown,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    const parsed = parseWorkflowPlan(input);
    if (!parsed.success) {
      return {
        status: 'error',
        data: { error: parsed.error },
        summary: 'Invalid workflow plan input',
      };
    }
    try {
      const { reflyService, user } = this.params;
      const { copilotSessionId, resultId, version: resultVersion } = config.configurable ?? {};

      if (!copilotSessionId || !resultId || typeof resultVersion !== 'number') {
        return {
          status: 'error',
          data: {
            error: `Missing required session context: copilotSessionId=${copilotSessionId}, resultId=${resultId}, resultVersion=${resultVersion}`,
          },
          summary: 'Missing session context for generating workflow plan',
        };
      }

      const result = await reflyService.generateWorkflowPlan(user, {
        data: normalizeWorkflowPlan(parsed.data!),
        copilotSessionId,
        resultId,
        resultVersion,
      });

      return {
        status: 'success',
        data: {
          planId: result.planId,
          version: result.version,
        },
        summary: `Successfully generated workflow plan with ID: ${result.planId} and version: ${result.version}`,
      };
    } catch (e) {
      return {
        status: 'error',
        data: { error: (e as Error)?.message },
        summary: 'Failed to generate workflow plan',
      };
    }
  }
}

export class PatchWorkflow extends AgentBaseTool<CopilotToolParams> {
  name = 'patch_workflow';
  toolsetKey = 'copilot';

  schema = workflowPlanPatchSchema;

  description = `Modify an existing workflow plan using semantic patch operations.

Operations (op field):
- updateTitle: { op, title }
- createTask: { op, task: { id, title, prompt, toolsets, dependentTasks? } }
- updateTask: { op, taskId, data: { title?, prompt?, toolsets?, dependentTasks? } }
- deleteTask: { op, taskId }
- createVariable: { op, variable: { variableId, variableType, name, description, value, required?, resourceTypes?, options?, isSingle? } }
- updateVariable: { op, variableId, data: { name?, description?, value?, required?, variableType?, options?, isSingle?, ... } }
- deleteVariable: { op, variableId }

Variable types:
- string: text input
- resource: file upload (use resourceTypes to specify accepted types)
- option: selection from predefined choices (use options array and isSingle boolean)

Notes:
- planId is optional; if omitted, patches the latest plan in the current session
- Operations are applied in order
- For updates, only include fields that need to change`;

  protected params: CopilotToolParams;

  constructor(params: CopilotToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: unknown,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;

      // Validate the patch input
      const parsed = parseWorkflowPlanPatch(input);
      if (!parsed.success) {
        return {
          status: 'error',
          data: { error: parsed.error },
          summary: 'Invalid workflow plan patch input',
        };
      }

      let planId = input.planId;
      if (!planId) {
        const copilotSessionId = config.configurable?.copilotSessionId;
        let latestPlan: WorkflowPlanRecord | null = null;

        // Try current session first
        if (copilotSessionId) {
          latestPlan = await reflyService.getLatestWorkflowPlan(user, { copilotSessionId });
        }

        // Fallback: find plan from any previous session on the same canvas
        if (!latestPlan) {
          const canvasId = config.configurable?.canvasId;
          if (canvasId) {
            latestPlan = await reflyService.getLatestWorkflowPlanByCanvas(user, {
              canvasId,
            });
          }
        }

        if (!latestPlan) {
          return {
            status: 'error',
            data: { error: 'No existing workflow plan found for this canvas' },
            summary: 'Workflow plan not found',
          };
        }
        planId = latestPlan.planId;
      }

      // Drift pre-check: ensure targeted tasks still exist on canvas
      const canvasId = config.configurable?.canvasId;
      if (canvasId) {
        try {
          const canvasData = await reflyService.getCanvasData(user, { canvasId });
          const canvasTaskIds = new Set<string>();
          for (const node of canvasData.nodes ?? []) {
            if (node.type === 'skillResponse') {
              const tid = (node.data?.metadata as Record<string, unknown>)?.taskId as
                | string
                | undefined;
              if (tid) canvasTaskIds.add(tid);
            }
          }

          const taskOps = input.operations.filter(
            (op) => (op.op === 'updateTask' || op.op === 'deleteTask') && op.taskId,
          );
          const staleTaskOps = taskOps.filter((op) => !canvasTaskIds.has(op.taskId!));

          if (staleTaskOps.length > 0) {
            return {
              status: 'error',
              data: {
                error: `Cannot patch: ${staleTaskOps.length} targeted task(s) no longer exist on canvas. Missing task IDs: ${staleTaskOps.map((op) => op.taskId).join(', ')}. The canvas may have been manually modified. Call get_workflow_summary to see drift details, or use generate_workflow to recreate.`,
              },
              summary: 'Patch failed due to canvas drift',
            };
          }
        } catch {
          // Non-critical: proceed with patch even if drift check fails
        }
      }

      const { resultId, version: resultVersion } = config.configurable ?? {};

      if (!resultId || typeof resultVersion !== 'number') {
        return {
          status: 'error',
          data: {
            error: `Missing required session context: resultId=${resultId}, resultVersion=${resultVersion}`,
          },
          summary: 'Missing session context for patching workflow plan',
        };
      }

      const result = await reflyService.patchWorkflowPlan(user, {
        planId: planId!,
        operations: input.operations as WorkflowPatchOperation[],
        resultId,
        resultVersion,
      });

      return {
        status: 'success',
        data: {
          planId: result.planId,
          version: result.version,
        },
        summary: `Successfully patched workflow plan with ID: ${result.planId} and created new version: ${result.version}. Applied ${input.operations.length} operation(s).`,
      };
    } catch (e) {
      return {
        status: 'error',
        data: { error: (e as Error)?.message ?? String(e) },
        summary: 'Failed to patch workflow plan',
      };
    }
  }
}

// Schema for get_workflow_summary tool (no input needed, uses session context)
const getWorkflowSummarySchema = z.object({
  planId: z
    .string()
    .optional()
    .describe('Optional plan ID. If not provided, retrieves the latest plan in current session.'),
});

export class GetWorkflowSummary extends AgentBaseTool<CopilotToolParams> {
  name = 'get_workflow_summary';
  toolsetKey = 'copilot';

  schema = getWorkflowSummarySchema;

  description = `Retrieve the current workflow plan structure.

Use this tool when you need to:
- Recall current tasks and variables before making modifications
- Verify task/variable IDs for accurate patch operations
- Understand the workflow structure after multiple conversation turns`;

  protected params: CopilotToolParams;

  constructor(params: CopilotToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: unknown,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const { planId } = input;
      let plan: WorkflowPlanRecord | null = null;

      if (planId) {
        plan = await reflyService.getWorkflowPlanById(user, { planId });
        if (!plan) {
          return {
            status: 'error',
            data: { error: `Workflow plan with ID ${planId} not found` },
            summary: 'Workflow plan not found',
          };
        }
      } else {
        // Try current session first
        const copilotSessionId = config.configurable?.copilotSessionId;
        if (copilotSessionId) {
          plan = await reflyService.getLatestWorkflowPlan(user, { copilotSessionId });
        }

        // Fallback: find plan from any previous session on the same canvas
        if (!plan) {
          const canvasId = config.configurable?.canvasId;
          if (canvasId) {
            plan = await reflyService.getLatestWorkflowPlanByCanvas(user, { canvasId });
          }
        }
      }

      if (!plan) {
        return {
          status: 'success',
          data: { exists: false },
          summary: 'No workflow plan exists in the current session yet.',
        };
      }

      // Drift detection: compare plan tasks with actual canvas nodes
      const canvasId = config.configurable?.canvasId;
      let canvasDrift: CanvasDrift | undefined;
      if (canvasId) {
        try {
          const canvasData = await this.params.reflyService.getCanvasData(user, { canvasId });
          canvasDrift = computeCanvasDrift(plan, canvasData.nodes ?? []);
        } catch {
          // Non-critical: proceed without drift info
        }
      }

      return {
        status: 'success',
        data: {
          planId: plan.planId,
          version: plan.version,
          title: plan.title,
          taskCount: plan.tasks?.length ?? 0,
          variableCount: plan.variables?.length ?? 0,
          tasks: plan.tasks?.map((t) => ({
            id: t.id,
            title: t.title,
            dependentTasks: t.dependentTasks,
            toolsets: t.toolsets,
            prompt: truncateContent(t.prompt, 100),
          })),
          variables: plan.variables?.map((v) => ({
            variableId: v.variableId,
            name: v.name,
            variableType: v.variableType,
            required: v.required,
          })),
          ...(canvasDrift && {
            canvasDrift: {
              hasDrift: canvasDrift.hasDrift,
              summary: canvasDrift.summary,
              ...(canvasDrift.hasDrift && {
                missingFromCanvas: canvasDrift.missingFromCanvas,
                addedOnCanvas: canvasDrift.addedOnCanvas,
              }),
            },
          }),
        },
        summary: canvasDrift?.hasDrift
          ? `Retrieved workflow plan (${plan.planId} v${plan.version}). WARNING: ${canvasDrift.summary}`
          : `Successfully retrieved workflow plan summary for plan ID: ${plan.planId} and version: ${plan.version}`,
      };
    } catch (e) {
      return {
        status: 'error',
        data: { error: (e as Error)?.message ?? String(e) },
        summary: 'Failed to retrieve workflow plan summary',
      };
    }
  }
}

// Schema for get_canvas_snapshot tool (no input needed, uses canvas context)
const getCanvasSnapshotSchema = z.object({});

const MAX_SNAPSHOT_NODES = 50;
const MAX_SNAPSHOT_EDGES = 100;
const MAX_PREVIEW_LENGTH = 80;

export class GetCanvasSnapshot extends AgentBaseTool<CopilotToolParams> {
  name = 'get_canvas_snapshot';
  toolsetKey = 'copilot';

  schema = getCanvasSnapshotSchema;

  description = `Retrieve the current canvas state including all nodes and edges.

Use this tool when you need to:
- See what nodes and edges are currently on the canvas
- Understand the canvas layout before generating or modifying workflows
- Answer user questions about the current canvas content`;

  protected params: CopilotToolParams;

  constructor(params: CopilotToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    _input: z.infer<typeof this.schema>,
    _: unknown,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const canvasId = config.configurable?.canvasId;

      if (!canvasId) {
        return {
          status: 'error',
          data: { error: 'canvasId is required to retrieve canvas snapshot' },
          summary: 'Missing canvas context',
        };
      }

      const canvasData = await reflyService.getCanvasData(user, { canvasId });
      const allNodes: CanvasNode[] = canvasData.nodes ?? [];
      const allEdges = canvasData.edges ?? [];

      // Build node type counts
      const nodeTypeCounts: Record<string, number> = {};
      for (const node of allNodes) {
        const t = node.type ?? 'unknown';
        nodeTypeCounts[t] = (nodeTypeCounts[t] ?? 0) + 1;
      }

      // Summarize nodes: strip position/style noise, keep key metadata for skillResponse
      const truncated = allNodes.length > MAX_SNAPSHOT_NODES;
      const nodesToReturn = allNodes.slice(0, MAX_SNAPSHOT_NODES).map((node) => {
        const metadata = (node.data as any)?.metadata;
        const base: Record<string, any> = {
          id: node.id,
          type: node.type,
          title: node.data?.title,
          entityId: node.data?.entityId,
          contentPreview: node.data?.contentPreview
            ? truncateContent(node.data.contentPreview, MAX_PREVIEW_LENGTH)
            : undefined,
        };

        // For skillResponse nodes, include query and toolsets so Agent can understand the workflow
        if (node.type === 'skillResponse' && metadata) {
          if (metadata.query) {
            base.query = truncateContent(metadata.query, 200);
          }
          if (metadata.selectedToolsets?.length) {
            base.toolsets = metadata.selectedToolsets
              .map((t: any) => t.id ?? t.toolset?.key)
              .filter(Boolean);
          }
          if (metadata.taskId) {
            base.taskId = metadata.taskId;
          }
        }

        return base;
      });

      // Summarize edges
      const edgesTruncated = allEdges.length > MAX_SNAPSHOT_EDGES;
      const edgesToReturn = allEdges.slice(0, MAX_SNAPSHOT_EDGES).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      }));

      return {
        status: 'success',
        data: {
          title: canvasData.title,
          nodeCount: allNodes.length,
          edgeCount: allEdges.length,
          nodeTypeCounts,
          nodes: nodesToReturn,
          edges: edgesToReturn,
          variables: canvasData.variables,
          truncated,
          edgesTruncated,
        },
        summary: `Canvas "${canvasData.title}" has ${allNodes.length} node(s) and ${allEdges.length} edge(s).`,
      };
    } catch (e) {
      return {
        status: 'error',
        data: { error: (e as Error)?.message ?? String(e) },
        summary: 'Failed to retrieve canvas snapshot',
      };
    }
  }
}
