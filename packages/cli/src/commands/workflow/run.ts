/**
 * refly workflow run - Start a workflow execution
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface RunResult {
  runId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted' | 'init';
  startedAt: string;
  unauthorizedTools?: Array<{
    toolset: {
      type: string;
      id: string;
      name: string;
      builtin?: boolean;
      toolset?: {
        key?: string;
      };
      mcpServer?: {
        name?: string;
      };
    };
    referencedNodes: Array<{
      id: string;
      entityId: string;
      title: string;
      type: string;
    }>;
  }>;
}

export const workflowRunCommand = new Command('run')
  .description('Start a workflow execution')
  .argument('<workflowId>', 'Workflow ID to run')
  .option('--input <json>', 'Input variables as JSON', '{}')
  .option('--from-node <nodeId>', 'Start workflow execution from a specific node (Run From Here)')
  .action(async (workflowId, options) => {
    try {
      // Parse input JSON
      let input: unknown;
      try {
        input = JSON.parse(options.input);
      } catch {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --input', {
          hint: 'Ensure the input is valid JSON',
        });
      }

      // Build request body with optional startNodes
      const body: { input?: unknown; startNodes?: string[] } = { input };
      if (options.fromNode) {
        body.startNodes = [options.fromNode];
      }

      const result = await apiRequest<RunResult>(`/v1/cli/workflow/${workflowId}/run`, {
        method: 'POST',
        body,
      });

      // Check if there are unauthorized tools
      if (result.unauthorizedTools && result.unauthorizedTools.length > 0) {
        const toolNames = result.unauthorizedTools.map((tool) => tool.toolset.name).join(', ');
        fail(ErrorCodes.EXECUTION_FAILED, `Workflow contains unauthorized tools: ${toolNames}`, {
          hint: 'Please install and authorize these tools before running the workflow',
          details: {
            unauthorizedTools: result.unauthorizedTools.map((tool) => ({
              name: tool.toolset.name,
              type: tool.toolset.type,
              referencedNodes: tool.referencedNodes.length,
            })),
          },
        });
      }

      ok('workflow.run', {
        message: options.fromNode
          ? `Workflow run started from node ${options.fromNode}`
          : 'Workflow run started',
        runId: result.runId,
        workflowId: result.workflowId,
        status: result.status,
        startNode: options.fromNode || undefined,
        startedAt: result.startedAt,
        nextStep: `Check status with \`refly workflow status ${workflowId}\``,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to run workflow',
      );
    }
  });
