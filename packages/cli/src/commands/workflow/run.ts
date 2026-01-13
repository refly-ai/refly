/**
 * refly workflow run - Run command group
 * Supports:
 *   refly workflow run <workflowId> - Start a workflow
 *   refly workflow run detail <runId> - Get detailed run info
 *   refly workflow run node <runId> <nodeId> - Get node result
 *   refly workflow run toolcalls <runId> - Get tool calls
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { workflowRunDetailCommand } from './run-detail.js';
import { workflowRunNodeCommand } from './run-node.js';
import { workflowRunToolcallsCommand } from './run-toolcalls.js';

interface RunResult {
  runId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
  createdAt: string;
}

// Create the run command group
export const workflowRunCommand = new Command('run')
  .description('Run workflows and get execution results')
  .argument('[workflowId]', 'Workflow ID to run')
  .option('--input <json>', 'Input variables as JSON', '{}')
  .action(async (workflowId, options) => {
    // If no workflowId provided, show help
    if (!workflowId) {
      workflowRunCommand.help();
      return;
    }

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

      const result = await apiRequest<RunResult>(`/v1/cli/workflow/${workflowId}/run`, {
        method: 'POST',
        body: { input },
      });

      ok('workflow.run', {
        message: 'Workflow run started',
        runId: result.runId,
        workflowId: result.workflowId,
        status: result.status,
        createdAt: result.createdAt,
        nextStep: `Check status with \`refly workflow run get ${result.runId}\``,
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

// Add subcommands to run command group
workflowRunCommand.addCommand(workflowRunDetailCommand);
workflowRunCommand.addCommand(workflowRunNodeCommand);
workflowRunCommand.addCommand(workflowRunToolcallsCommand);
