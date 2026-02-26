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
        if (!copilotSessionId) {
          return {
            status: 'error',
            data: { error: 'copilotSessionId is required when planId is not provided' },
            summary: 'Missing copilotSessionId',
          };
        }

        const latestPlan = await reflyService.getLatestWorkflowPlan(user, { copilotSessionId });
        if (!latestPlan) {
          return {
            status: 'error',
            data: { error: 'No existing workflow plan found for this session' },
            summary: 'Workflow plan not found',
          };
        }
        planId = latestPlan.planId;
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
        const copilotSessionId = config.configurable?.copilotSessionId;
        if (!copilotSessionId) {
          return {
            status: 'error',
            data: { error: 'copilotSessionId is required to retrieve the workflow plan' },
            summary: 'Missing session context',
          };
        }
        plan = await reflyService.getLatestWorkflowPlan(user, {
          copilotSessionId,
        });
      }

      if (!plan) {
        return {
          status: 'success',
          data: { exists: false },
          summary: 'No workflow plan exists in the current session yet.',
        };
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
        },
        summary: `Successfully retrieved workflow plan summary for plan ID: ${plan.planId} and version: ${plan.version}`,
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

      // Summarize nodes: strip position/style/metadata noise
      const truncated = allNodes.length > MAX_SNAPSHOT_NODES;
      const nodesToReturn = allNodes.slice(0, MAX_SNAPSHOT_NODES).map((node) => ({
        id: node.id,
        type: node.type,
        title: node.data?.title,
        entityId: node.data?.entityId,
        contentPreview: node.data?.contentPreview
          ? truncateContent(node.data.contentPreview, MAX_PREVIEW_LENGTH)
          : undefined,
      }));

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
