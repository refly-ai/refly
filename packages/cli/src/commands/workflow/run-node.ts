/**
 * refly workflow run node - Get detailed node execution result
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

interface ActionMessage {
  messageId: string;
  type: 'ai' | 'tool';
  content?: string;
  reasoningContent?: string;
  toolCallId?: string;
  createdAt: string;
}

interface NodeResultDetailResponse {
  nodeId: string;
  nodeExecutionId: string;
  nodeType: string;
  title: string;
  status: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  query?: string;
  originalQuery?: string;
  resultId?: string;
  resultVersion?: number;
  output?: {
    content: string;
    reasoningContent?: string;
    artifacts?: unknown[];
    structuredData?: Record<string, unknown>;
  };
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  toolCalls: ToolCallDetail[];
  messages?: ActionMessage[];
  error?: {
    type: string;
    message: string;
  };
}

export const workflowRunNodeCommand = new Command('node')
  .description('Get detailed execution result for a specific node')
  .argument('<runId>', 'Workflow run ID')
  .argument('<nodeId>', 'Node ID')
  .option('--include-messages', 'Include AI conversation messages')
  .option('--raw', 'Disable output sanitization (show full tool outputs)')
  .action(async (runId, nodeId, options) => {
    try {
      const params = new URLSearchParams();
      if (options.includeMessages) {
        params.set('includeMessages', 'true');
      }
      if (options.raw) {
        params.set('sanitizeForDisplay', 'false');
      }

      const queryString = params.toString();
      const url = `/v1/cli/workflow/run/${runId}/node/${nodeId}${queryString ? `?${queryString}` : ''}`;
      const result = await apiRequest<NodeResultDetailResponse>(url);

      ok('workflow.node.result', {
        nodeId: result.nodeId,
        nodeExecutionId: result.nodeExecutionId,
        nodeType: result.nodeType,
        title: result.title,
        status: result.status,
        timing: {
          startTime: result.startTime,
          endTime: result.endTime,
          durationMs: result.durationMs,
        },
        query: result.query,
        originalQuery: result.originalQuery,
        resultId: result.resultId,
        resultVersion: result.resultVersion,
        output: result.output,
        tokenUsage: result.tokenUsage,
        toolCallsCount: result.toolCalls?.length ?? 0,
        toolCalls: result.toolCalls,
        messages: result.messages,
        error: result.error,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get node result',
      );
    }
  });
