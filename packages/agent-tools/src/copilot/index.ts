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
import { User } from '@refly/openapi-schema';
import { RunnableConfig } from '@langchain/core/runnables';

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
      const result = await reflyService.generateWorkflowPlan(
        user,
        normalizeWorkflowPlan(parsed.data!),
        config.configurable?.copilotSessionId,
        config.configurable?.resultId,
        config.configurable?.version,
      );

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
- createVariable: { op, variable: { variableId, variableType, name, description, value, required?, resourceTypes? } }
- updateVariable: { op, variableId, data: { name?, description?, value?, required?, ... } }
- deleteVariable: { op, variableId }

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

        const latestPlan = await reflyService.getLatestWorkflowPlan(user, copilotSessionId);
        if (!latestPlan) {
          return {
            status: 'error',
            data: { error: 'No existing workflow plan found for this session' },
            summary: 'Workflow plan not found',
          };
        }
        planId = latestPlan.planId;
      }

      const result = await reflyService.patchWorkflowPlan(
        user,
        planId!,
        input.operations,
        config.configurable?.resultId,
        config.configurable?.version,
      );

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
