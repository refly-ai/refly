/**
 * refly workflow run toolcalls - Get all tool calls for a workflow run
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface ToolCallDetail {
  callId: string;
  toolsetId: string;
  toolName: string;
  stepName?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'executing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
}

interface WorkflowToolCallsResponse {
  runId: string;
  totalCount: number;
  toolCalls: ToolCallDetail[];
  byStatus: {
    executing: number;
    completed: number;
    failed: number;
  };
  byToolset: Record<string, number>;
  byTool: Record<string, number>;
}

export const workflowRunToolcallsCommand = new Command('toolcalls')
  .description('Get all tool calls for a workflow run')
  .argument('<runId>', 'Workflow run ID')
  .option('--node-id <nodeId>', 'Filter by node ID')
  .option('--toolset-id <toolsetId>', 'Filter by toolset ID')
  .option('--tool-name <toolName>', 'Filter by tool name')
  .option('--status <status>', 'Filter by status (executing, completed, failed)')
  .option('--limit <limit>', 'Maximum number of results (default: 100)', '100')
  .option('--offset <offset>', 'Pagination offset (default: 0)', '0')
  .option('--raw', 'Disable output sanitization (show full tool outputs)')
  .action(async (runId, options) => {
    try {
      const params = new URLSearchParams();
      if (options.nodeId) {
        params.set('nodeId', options.nodeId);
      }
      if (options.toolsetId) {
        params.set('toolsetId', options.toolsetId);
      }
      if (options.toolName) {
        params.set('toolName', options.toolName);
      }
      if (options.status) {
        params.set('status', options.status);
      }
      if (options.limit) {
        params.set('limit', options.limit);
      }
      if (options.offset) {
        params.set('offset', options.offset);
      }
      if (options.raw) {
        params.set('sanitizeForDisplay', 'false');
      }

      const queryString = params.toString();
      const url = `/v1/cli/workflow/run/${runId}/toolcalls${queryString ? `?${queryString}` : ''}`;
      const result = await apiRequest<WorkflowToolCallsResponse>(url);

      ok('workflow.toolcalls', {
        runId: result.runId,
        totalCount: result.totalCount,
        toolCalls: result.toolCalls,
        summary: {
          byStatus: result.byStatus,
          byToolset: result.byToolset,
          byTool: result.byTool,
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
        error instanceof Error ? error.message : 'Failed to get workflow tool calls',
      );
    }
  });
