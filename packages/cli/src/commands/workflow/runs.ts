/**
 * refly workflow runs - List workflow execution history
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface WorkflowRun {
  runId: string;
  status: 'init' | 'executing' | 'finish' | 'failed';
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}

interface WorkflowRunsResponse {
  workflowId: string;
  runs: WorkflowRun[];
  total: number;
  hasActiveRun: boolean;
  activeRunId?: string;
}

export const workflowRunsCommand = new Command('runs')
  .description('List workflow execution history')
  .argument('<workflowId>', 'Workflow ID')
  .option('--limit <limit>', 'Maximum number of runs to return (default: 20)', '20')
  .option('--offset <offset>', 'Pagination offset (default: 0)', '0')
  .option('--status <status>', 'Filter by status (init, executing, finish, failed)')
  .action(async (workflowId, options) => {
    try {
      const params = new URLSearchParams();
      if (options.limit) {
        params.set('limit', options.limit);
      }
      if (options.offset) {
        params.set('offset', options.offset);
      }
      if (options.status) {
        params.set('status', options.status);
      }

      const queryString = params.toString();
      const url = `/v1/cli/workflow/${workflowId}/runs${queryString ? `?${queryString}` : ''}`;
      const result = await apiRequest<WorkflowRunsResponse>(url);

      ok('workflow.runs', {
        workflowId: result.workflowId,
        total: result.total,
        hasActiveRun: result.hasActiveRun,
        activeRunId: result.activeRunId,
        runs: result.runs.map((run) => ({
          runId: run.runId,
          status: run.status,
          progress: `${run.executedNodes}/${run.totalNodes}`,
          failedNodes: run.failedNodes,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          durationMs: run.durationMs,
        })),
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
        error instanceof Error ? error.message : 'Failed to get workflow runs',
      );
    }
  });
