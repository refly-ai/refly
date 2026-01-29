/**
 * refly workflow run node-toolcalls - List tool calls from a node execution
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
}

interface ToolCallResult {
  callId: string;
  toolsetId: string;
  toolName: string;
  stepName?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: 'executing' | 'completed' | 'failed';
  error?: string;
  createdAt?: string;
  updatedAt?: string;
  durationMs?: number;
}

interface NodeStep {
  name: string;
  content: string;
  reasoningContent?: string;
  tokenUsage?: TokenUsage[];
  toolCalls?: ToolCallResult[];
}

interface NodeResult {
  resultId: string;
  version: number;
  title: string;
  status: string;
  steps?: NodeStep[];
  createdAt: string;
  updatedAt: string;
}

export const workflowRunNodeToolcallsCommand = new Command('node-toolcalls')
  .description('List tool calls from a node execution')
  .argument('<resultId>', 'Node result ID')
  .option('--status <status>', 'Filter by status (executing, completed, failed)')
  .option('--tool-name <toolName>', 'Filter by tool name')
  .option('--toolset-id <toolsetId>', 'Filter by toolset ID')
  .action(async (resultId, options) => {
    try {
      const result = await apiRequest<NodeResult>(`/v1/cli/action/result?resultId=${resultId}`);

      // Collect all tool calls from all steps
      const allToolCalls: ToolCallResult[] = [];
      for (const step of result.steps ?? []) {
        if (step.toolCalls?.length) {
          for (const tc of step.toolCalls) {
            // Apply filters
            if (options.status && tc.status !== options.status) {
              continue;
            }
            if (options.toolName && tc.toolName !== options.toolName) {
              continue;
            }
            if (options.toolsetId && tc.toolsetId !== options.toolsetId) {
              continue;
            }
            allToolCalls.push(tc);
          }
        }
      }

      // Calculate summary statistics
      const byStatus: Record<string, number> = { executing: 0, completed: 0, failed: 0 };
      const byToolset: Record<string, number> = {};
      const byTool: Record<string, number> = {};

      for (const tc of allToolCalls) {
        byStatus[tc.status] = (byStatus[tc.status] || 0) + 1;
        byToolset[tc.toolsetId] = (byToolset[tc.toolsetId] || 0) + 1;
        byTool[tc.toolName] = (byTool[tc.toolName] || 0) + 1;
      }

      ok('workflow.run.node-toolcalls', {
        resultId: result.resultId,
        version: result.version,
        title: result.title,
        status: result.status,
        totalCount: allToolCalls.length,
        toolCalls: allToolCalls.map((tc) => ({
          callId: tc.callId,
          toolsetId: tc.toolsetId,
          toolName: tc.toolName,
          stepName: tc.stepName,
          status: tc.status,
          error: tc.error,
          durationMs: tc.durationMs,
        })),
        summary: {
          byStatus,
          byToolset,
          byTool,
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
        error instanceof Error ? error.message : 'Failed to get node tool calls',
      );
    }
  });
