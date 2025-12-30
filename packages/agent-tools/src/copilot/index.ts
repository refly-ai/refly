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

  description = `Patch an existing workflow plan using semantic operations.

Use this tool to modify a workflow plan by providing an array of operations. Each operation specifies exactly what to change.

## Available Operations

### Title Operations
- **updateTitle**: Update the workflow title
  \`{ "op": "updateTitle", "title": "New Title" }\`

### Task Operations
- **createTask**: Create a new task
  \`{ "op": "createTask", "task": { "id": "task-3", "title": "...", "prompt": "...", "toolsets": [...] } }\`
- **updateTask**: Update specific fields of an existing task
  \`{ "op": "updateTask", "taskId": "task-1", "data": { "title": "New Title", "prompt": "New prompt" } }\`
- **deleteTask**: Delete a task by ID
  \`{ "op": "deleteTask", "taskId": "task-1" }\`

### Variable Operations
- **createVariable**: Create a new variable
  \`{ "op": "createVariable", "variable": { "variableId": "var-1", "name": "...", "description": "...", "value": [] } }\`
- **updateVariable**: Update specific fields of an existing variable
  \`{ "op": "updateVariable", "variableId": "var-1", "data": { "name": "New Name", "required": true } }\`
- **deleteVariable**: Delete a variable by ID
  \`{ "op": "deleteVariable", "variableId": "var-1" }\`

## Examples

**Example 1 - Update title and modify a task:**
{
  "planId": "workflow-plan-xxx",
  "operations": [
    { "op": "updateTitle", "title": "Improved Search Workflow" },
    { "op": "updateTask", "taskId": "task-1", "data": { "prompt": "Search for the latest news about AI" } }
  ]
}

**Example 2 - Add a new task with dependency:**
{
  "planId": "workflow-plan-xxx",
  "operations": [
    {
      "op": "createTask",
      "task": {
        "id": "task-3",
        "title": "Summarize Results",
        "prompt": "Summarize the search results from previous tasks",
        "dependentTasks": ["task-1", "task-2"],
        "toolsets": []
      }
    }
  ]
}

**Example 3 - Delete a task and add a variable:**
{
  "planId": "workflow-plan-xxx",
  "operations": [
    { "op": "deleteTask", "taskId": "task-2" },
    {
      "op": "createVariable",
      "variable": {
        "variableId": "var-query",
        "variableType": "string",
        "name": "searchQuery",
        "description": "The search query to use",
        "required": true,
        "value": []
      }
    }
  ]
}

## Key Points
- Operations are applied in order
- Use exact task/variable IDs from the existing plan
- For updateTask/updateVariable, only include fields that need to change
- Dependencies between tasks are automatically cleaned up when deleting a task`;

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

      const result = await reflyService.patchWorkflowPlan(
        user,
        input.planId,
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
