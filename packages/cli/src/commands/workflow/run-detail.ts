/**
 * refly workflow run detail - Get detailed workflow run information
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface ToolCallSummary {
  callId: string;
  toolName: string;
  toolsetId: string;
  status: 'executing' | 'completed' | 'failed';
  durationMs?: number;
  error?: string;
}

interface NodeExecutionDetail {
  nodeId: string;
  nodeExecutionId: string;
  nodeType: string;
  title: string;
  status: 'waiting' | 'executing' | 'finish' | 'failed';
  progress: number;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  query?: string;
  originalQuery?: string;
  resultId?: string;
  resultVersion?: number;
  outputPreview?: string;
  outputTokens?: number;
  toolCallsCount: number;
  toolCallsSummary?: ToolCallSummary[];
  errorMessage?: string;
  errorType?: string;
}

interface WorkflowError {
  nodeId: string;
  nodeTitle: string;
  errorType: string;
  errorMessage: string;
  timestamp: string;
}

interface WorkflowRunDetailResponse {
  runId: string;
  workflowId: string;
  title: string;
  status: 'init' | 'executing' | 'finish' | 'failed';
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  nodes: NodeExecutionDetail[];
  errors?: WorkflowError[];
}

export const workflowRunDetailCommand = new Command('detail')
  .description('Get detailed workflow run information including all node results')
  .argument('<runId>', 'Workflow run ID')
  .option('--no-tool-calls', 'Exclude tool call summaries')
  .option('--preview-length <length>', 'Output preview length (default: 500)', '500')
  .action(async (runId, options) => {
    try {
      const params = new URLSearchParams();
      if (options.toolCalls === false) {
        params.set('includeToolCalls', 'false');
      }
      if (options.previewLength) {
        params.set('outputPreviewLength', options.previewLength);
      }

      const queryString = params.toString();
      const url = `/v1/cli/workflow/run/${runId}/detail${queryString ? `?${queryString}` : ''}`;
      const result = await apiRequest<WorkflowRunDetailResponse>(url);

      ok('workflow.run.detail', {
        runId: result.runId,
        workflowId: result.workflowId,
        title: result.title,
        status: result.status,
        progress: {
          total: result.totalNodes,
          executed: result.executedNodes,
          failed: result.failedNodes,
        },
        timing: {
          startedAt: result.startedAt,
          finishedAt: result.finishedAt,
          durationMs: result.durationMs,
        },
        nodes: result.nodes,
        errors: result.errors,
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
        error instanceof Error ? error.message : 'Failed to get workflow run detail',
      );
    }
  });
