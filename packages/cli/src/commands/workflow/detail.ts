/**
 * refly workflow detail - Get detailed workflow execution information
 *
 * Supports both workflowId (c-xxx) and runId (we-xxx).
 * - workflowId: gets detail for the latest run
 * - runId: gets detail for the specific run
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { buildWorkflowApiUrl, detectIdType } from './utils.js';

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

interface WorkflowDetailResponse {
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

export const workflowDetailCommand = new Command('detail')
  .description('Get detailed workflow execution information including all node results')
  .argument('<id>', 'Workflow ID (c-xxx) or Run ID (we-xxx)')
  .option('--no-tool-calls', 'Exclude tool call summaries')
  .option('--preview-length <length>', 'Output preview length (default: 500)', '500')
  .action(async (id, options) => {
    try {
      const params = new URLSearchParams();
      if (options.toolCalls === false) {
        params.set('includeToolCalls', 'false');
      }
      if (options.previewLength) {
        params.set('outputPreviewLength', options.previewLength);
      }

      // Auto-detect ID type and build appropriate URL
      const idType = detectIdType(id);
      const url = buildWorkflowApiUrl(id, 'detail', params);
      const result = await apiRequest<WorkflowDetailResponse>(url);

      ok('workflow.detail', {
        runId: result.runId,
        workflowId: result.workflowId,
        title: result.title,
        status: result.status,
        idType, // Include ID type in output for clarity
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
        error instanceof Error ? error.message : 'Failed to get workflow detail',
      );
    }
  });
