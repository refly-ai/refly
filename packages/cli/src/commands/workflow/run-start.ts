/**
 * refly workflow run start - Start a workflow execution
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface RunResult {
  runId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
  createdAt: string;
}

export const workflowRunStartCommand = new Command('start')
  .description('Start a workflow execution')
  .argument('<workflowId>', 'Workflow ID to run (c-xxx)')
  .option('--input <json>', 'Input variables as JSON', '{}')
  .option('--from-node <nodeId>', 'Start workflow execution from a specific node (Run From Here)')
  .action(async (workflowId: string, options) => {
    // Validate workflowId format
    if (!workflowId.startsWith('c-')) {
      fail(ErrorCodes.INVALID_INPUT, `Invalid workflow ID: ${workflowId}`, {
        hint: 'Workflow ID should start with "c-"',
        suggestedFix: {
          field: '<workflowId>',
          format: 'c-<id>',
          example: 'c-123456',
        },
      });
      return;
    }

    try {
      // Parse input JSON
      let input: unknown;
      try {
        input = JSON.parse(options.input);
      } catch {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --input', {
          hint:
            'Input format: \'{"varName": "value", "fileVar": "df-fileId"}\'\n' +
            'For file variables, use the fileId (starts with "df-")',
          suggestedFix: {
            field: '--input',
            format: 'json-object',
            example: '{"varName": "value", "fileVar": "df-fileId"}',
          },
        });
        return;
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

      ok('workflow.run.start', {
        message: options.fromNode
          ? `Workflow run started from node ${options.fromNode}`
          : 'Workflow run started',
        runId: result.runId,
        workflowId: result.workflowId,
        status: result.status,
        startNode: options.fromNode || undefined,
        createdAt: result.createdAt,
        nextSteps: [
          `Check status: \`refly workflow run get ${result.runId}\``,
          `Get details: \`refly workflow run detail ${result.runId}\``,
        ],
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
        error instanceof Error ? error.message : 'Failed to start workflow',
      );
    }
  });
