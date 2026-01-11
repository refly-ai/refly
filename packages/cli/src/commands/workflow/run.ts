/**
 * refly workflow run - Run a workflow
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

export const workflowRunCommand = new Command('run')
  .description('Run a workflow')
  .argument('<workflowId>', 'Workflow ID')
  .option('--input <json>', 'Input variables as JSON', '{}')
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
