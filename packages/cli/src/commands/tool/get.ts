/**
 * refly tool get - Get full details for a single tool call
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface ToolCallFullDetail {
  callId: string;
  resultId: string;
  resultVersion: number;
  workflowExecutionId?: string;
  nodeId?: string;
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

export const toolGetCommand = new Command('get')
  .description('Get full details for a single tool call')
  .argument('<callId>', 'Tool call ID')
  .option('--raw', 'Disable output sanitization (show full tool output)')
  .action(async (callId, options) => {
    try {
      const params = new URLSearchParams();
      if (options.raw) {
        params.set('sanitizeForDisplay', 'false');
      }

      const queryString = params.toString();
      const url = `/v1/cli/tool-call/${callId}${queryString ? `?${queryString}` : ''}`;
      const result = await apiRequest<ToolCallFullDetail>(url);

      ok('tool.detail', {
        callId: result.callId,
        context: {
          resultId: result.resultId,
          resultVersion: result.resultVersion,
          workflowExecutionId: result.workflowExecutionId,
          nodeId: result.nodeId,
        },
        tool: {
          toolsetId: result.toolsetId,
          toolName: result.toolName,
          stepName: result.stepName,
        },
        input: result.input,
        output: result.output,
        status: result.status,
        error: result.error,
        timing: {
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          durationMs: result.durationMs,
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
        error instanceof Error ? error.message : 'Failed to get tool call detail',
      );
    }
  });
