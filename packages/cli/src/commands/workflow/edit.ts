/**
 * refly workflow edit - Edit a workflow plan using semantic operations
 *
 * Operates on semantic WorkflowPlan (tasks, variables).
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface WorkflowPatchOperation {
  op:
    | 'updateTitle'
    | 'createTask'
    | 'updateTask'
    | 'deleteTask'
    | 'createVariable'
    | 'updateVariable'
    | 'deleteVariable';
  title?: string;
  taskId?: string;
  task?: {
    id: string;
    title: string;
    prompt: string;
    dependentTasks?: string[];
    toolsets: string[];
  };
  variableId?: string;
  variable?: {
    variableId: string;
    variableType?: 'string' | 'resource';
    name: string;
    description: string;
    required?: boolean;
    value?: Array<{ type?: string; text?: string }>;
  };
  data?: {
    title?: string;
    prompt?: string;
    dependentTasks?: string[];
    toolsets?: string[];
    variableType?: 'string' | 'resource';
    name?: string;
    description?: string;
    required?: boolean;
    value?: Array<{ type?: string; text?: string }>;
  };
}

interface PatchWorkflowPlanRequest {
  planId: string;
  operations: WorkflowPatchOperation[];
}

interface WorkflowPlan {
  title: string;
  tasks: Array<{
    id: string;
    title: string;
    prompt: string;
    dependentTasks?: string[];
    toolsets: string[];
  }>;
  variables: Array<{
    variableId: string;
    variableType?: string;
    name: string;
    description: string;
    required?: boolean;
    value?: unknown[];
  }>;
}

interface PatchWorkflowPlanResponse {
  success: boolean;
  data: WorkflowPlan;
}

export const workflowEditCommand = new Command('edit')
  .description('Edit a workflow plan using semantic operations')
  .argument('<planId>', 'Workflow Plan ID')
  .option('--ops <json>', 'Operations array as JSON')
  .option('--ops-file <path>', 'Read operations from file')
  .option('--update-title <title>', 'Shortcut: update workflow title')
  .option('--delete-task <taskId>', 'Shortcut: delete a task')
  .option('--delete-variable <variableId>', 'Shortcut: delete a variable')
  .action(async (planId, options) => {
    try {
      // Build operations array from options
      const operations: WorkflowPatchOperation[] = [];

      // Operations format hint for error messages
      const opsFormatHint =
        'Operations format: \'[{"op": "updateTitle", "title": "New Title"}]\'\n' +
        'Available ops: updateTitle, createTask, updateTask, deleteTask, createVariable, updateVariable, deleteVariable\n' +
        'Examples:\n' +
        '  - Update title: {"op": "updateTitle", "title": "New Title"}\n' +
        '  - Delete task: {"op": "deleteTask", "taskId": "task-id"}\n' +
        '  - Update task: {"op": "updateTask", "taskId": "task-id", "data": {"prompt": "new prompt"}}';

      // Handle --ops-file
      if (options.opsFile) {
        try {
          const filePath = options.opsFile;
          if (!fs.existsSync(filePath)) {
            fail(ErrorCodes.NOT_FOUND, `Operations file not found: ${filePath}`);
          }
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const fileOps = JSON.parse(fileContent);
          if (Array.isArray(fileOps)) {
            operations.push(...fileOps);
          } else {
            fail(ErrorCodes.INVALID_INPUT, 'Operations file must contain a JSON array', {
              hint: opsFormatHint,
              suggestedFix: {
                field: '--ops-file',
                format: 'json-array',
                example: '[{"op": "updateTitle", "title": "New Title"}]',
              },
            });
          }
        } catch (error) {
          if (error instanceof CLIError) throw error;
          fail(
            ErrorCodes.INVALID_INPUT,
            `Failed to parse operations file: ${(error as Error).message}`,
            {
              hint: opsFormatHint,
              suggestedFix: {
                field: '--ops-file',
                format: 'json-array',
                example: '[{"op": "updateTitle", "title": "New Title"}]',
              },
            },
          );
        }
      }

      // Handle --ops
      if (options.ops) {
        try {
          const jsonOps = JSON.parse(options.ops);
          if (Array.isArray(jsonOps)) {
            operations.push(...jsonOps);
          } else {
            fail(ErrorCodes.INVALID_INPUT, '--ops must be a JSON array', {
              hint: opsFormatHint,
              suggestedFix: {
                field: '--ops',
                format: 'json-array',
                example: '[{"op": "updateTitle", "title": "New Title"}]',
              },
            });
          }
        } catch (error) {
          fail(ErrorCodes.INVALID_INPUT, `Invalid JSON in --ops: ${(error as Error).message}`, {
            hint: opsFormatHint,
            suggestedFix: {
              field: '--ops',
              format: 'json-array',
              example: '[{"op": "updateTitle", "title": "New Title"}]',
            },
          });
        }
      }

      // Handle shortcut options
      if (options.updateTitle) {
        operations.push({
          op: 'updateTitle',
          title: options.updateTitle,
        });
      }

      if (options.deleteTask) {
        operations.push({
          op: 'deleteTask',
          taskId: options.deleteTask,
        });
      }

      if (options.deleteVariable) {
        operations.push({
          op: 'deleteVariable',
          variableId: options.deleteVariable,
        });
      }

      // Validate at least one operation
      if (operations.length === 0) {
        fail(ErrorCodes.INVALID_INPUT, 'No operations provided', {
          hint: 'Use --ops, --ops-file, or shortcut options (--update-title, --delete-task, --delete-variable)',
          suggestedFix: {
            field: '--ops',
            format: 'json-array',
            example: '[{"op": "updateTitle", "title": "New Title"}]',
          },
        });
      }

      // Call API
      const body: PatchWorkflowPlanRequest = {
        planId,
        operations,
      };

      const response = await apiRequest<PatchWorkflowPlanResponse>('/v1/cli/workflow-plan/patch', {
        method: 'POST',
        body,
      });

      // Extract plan from response (API returns { success: true, data: plan })
      const plan = response.data ?? response;

      ok('workflow.edit', {
        planId,
        operationsApplied: operations.length,
        plan: {
          title: plan.title,
          taskCount: plan.tasks?.length ?? 0,
          variableCount: plan.variables?.length ?? 0,
          tasks: plan.tasks?.map((t) => ({
            id: t.id,
            title: t.title,
          })),
          variables: plan.variables?.map((v) => ({
            variableId: v.variableId,
            name: v.name,
          })),
        },
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to edit workflow plan',
      );
    }
  });
