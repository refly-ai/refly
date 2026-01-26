/**
 * refly tool calls - Get tool execution results for an action
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface ToolCall {
  callId: string;
  toolName: string;
  toolsetId: string;
  status: string;
  input: string;
  output: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface ToolCallsResponse {
  toolCalls: ToolCall[];
  version: number;
}

export const toolCallsCommand = new Command('calls')
  .description('Get tool execution results for an action')
  .requiredOption('--result-id <resultId>', 'Action result ID')
  .option('--version <version>', 'Specific version number')
  .action(async (options) => {
    try {
      const params = new URLSearchParams({ resultId: options.resultId });
      if (options.version) {
        params.set('version', options.version);
      }

      const result = await apiRequest<ToolCallsResponse>(`/v1/cli/tool-call?${params}`);

      ok('tool.calls', {
        resultId: options.resultId,
        version: result.version,
        count: result.toolCalls?.length ?? 0,
        toolCalls: result.toolCalls?.map((tc) => ({
          callId: tc.callId,
          toolName: tc.toolName,
          toolsetId: tc.toolsetId,
          status: tc.status,
          input: tc.input,
          output: tc.output,
          error: tc.error,
          createdAt: tc.createdAt,
          updatedAt: tc.updatedAt,
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
        error instanceof Error ? error.message : 'Failed to get tool calls',
      );
    }
  });
