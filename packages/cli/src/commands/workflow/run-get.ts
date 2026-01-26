/**
 * refly workflow run get - Get run status
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface RunDetail {
  runId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    nodeId?: string;
  };
  nodeResults?: Array<{
    nodeId: string;
    status: string;
    result?: unknown;
    error?: string;
    durationMs?: number;
  }>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export const workflowRunGetCommand = new Command('get')
  .description('Get workflow run status')
  .argument('<runId>', 'Run ID')
  .action(async (runId) => {
    try {
      const result = await apiRequest<RunDetail>(`/v1/cli/workflow/run/${runId}`);

      ok('workflow.run.get', result);
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
        error instanceof Error ? error.message : 'Failed to get run status',
      );
    }
  });
