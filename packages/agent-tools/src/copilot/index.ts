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
import { User, WorkflowPlanRecord } from '@refly/openapi-schema';
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
        operations: input.operations,
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
