/**
 * refly workflow edit - Edit a workflow using natural language
 *
 * Uses AI to parse natural language and apply appropriate workflow modifications.
 * Supports both generate_workflow and patch_workflow tool outputs from Copilot.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface EditWorkflowCliResponse {
  canvasId: string;
  planId: string;
  version: number;
  toolUsed: 'generate_workflow' | 'patch_workflow';
  sessionId?: string;
  plan: {
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
  };
}

export const workflowEditCommand = new Command('edit')
  .description('Edit a workflow using natural language')
  .argument('<id>', 'Canvas ID (c-xxx)')
  .option('--query <text>', 'Edit instruction in natural language')
  .option('--session-id <id>', 'Session ID (cs-xxx) for context continuity')
  .option('--timeout <ms>', 'Timeout for AI processing', '60000')
  .action(async (id: string, options) => {
    try {
      // Validate --query is required
      if (!options.query) {
        fail(ErrorCodes.INVALID_INPUT, '--query is required', {
          hint: 'Provide a natural language description of the edit you want to make',
          suggestedFix: {
            field: '--query',
            format: 'string',
            example: 'refly workflow edit c-xxx --query "添加一个用 nano banana 生成图片的任务"',
          },
        });
      }

      // Validate ID format
      if (!id.startsWith('c-')) {
        fail(ErrorCodes.INVALID_INPUT, 'Only Canvas ID (c-xxx) is supported', {
          hint: 'Use the Canvas ID format starting with "c-"',
          suggestedFix: {
            field: 'id',
            format: 'canvas-id',
            example: 'c-abc123',
          },
        });
      }

      const timeout = Number.parseInt(options.timeout);

      // Call the edit API
      const response = await apiRequest<{ success: boolean; data: EditWorkflowCliResponse }>(
        '/v1/cli/workflow/edit',
        {
          method: 'POST',
          body: {
            canvasId: id,
            query: options.query,
            sessionId: options.sessionId,
            timeout,
          },
          timeout: timeout + 5000, // Add buffer for network
        },
      );

      // Extract the response data
      const result = response.data ?? response;

      ok('workflow.edit', {
        canvasId: result.canvasId,
        planId: result.planId,
        version: result.version,
        toolUsed: result.toolUsed,
        sessionId: result.sessionId,
        plan: {
          title: result.plan.title,
          taskCount: result.plan.tasks?.length ?? 0,
          variableCount: result.plan.variables?.length ?? 0,
          tasks: result.plan.tasks?.map((t) => ({
            id: t.id,
            title: t.title,
          })),
          variables: result.plan.variables?.map((v) => ({
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
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to edit workflow',
      );
    }
  });
