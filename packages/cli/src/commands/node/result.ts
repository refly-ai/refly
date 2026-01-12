/**
 * refly node result - Get node execution result
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface NodeStep {
  stepIndex: number;
  content: string;
  toolCalls?: unknown[];
}

interface NodeResult {
  resultId: string;
  status: string;
  content: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  steps?: NodeStep[];
  toolCalls?: unknown[];
  messages?: unknown[];
}

export const nodeResultCommand = new Command('result')
  .description('Get node execution result')
  .argument('<resultId>', 'Node result ID')
  .option('--include-steps', 'Include detailed step information')
  .option('--include-messages', 'Include chat messages')
  .option('--include-tool-calls', 'Include tool call details')
  .action(async (resultId, options) => {
    try {
      const result = await apiRequest<NodeResult>(`/v1/cli/action/result?resultId=${resultId}`);

      // Format output based on options
      const output: Record<string, unknown> = {
        resultId: result.resultId,
        status: result.status,
        content: result.content,
        tokenUsage: result.tokenUsage,
      };

      if (options.includeSteps && result.steps) {
        output.steps = result.steps.map((step) => ({
          stepIndex: step.stepIndex,
          content: step.content,
          toolCallsCount: step.toolCalls?.length ?? 0,
        }));
      }

      if (options.includeToolCalls && result.toolCalls) {
        output.toolCalls = result.toolCalls;
      }

      if (options.includeMessages && result.messages) {
        output.messages = result.messages;
      }

      ok('node.result', output);
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
