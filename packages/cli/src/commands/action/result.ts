/**
 * refly action result - Get action/node execution result
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface ActionStep {
  stepIndex: number;
  content: string;
  toolCalls?: unknown[];
}

interface ActionResult {
  resultId: string;
  status: string;
  content: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  steps?: ActionStep[];
  toolCalls?: unknown[];
  messages?: unknown[];
}

export const actionResultCommand = new Command('result')
  .description('Get action/node execution result')
  .argument('<resultId>', 'Action result ID')
  .option('--version <version>', 'Specific version number')
  .option('--include-steps', 'Include detailed step information')
  .option('--include-messages', 'Include chat messages')
  .option('--include-tool-calls', 'Include tool call details')
  .option('--include-files', 'Include associated files')
  .option('--raw', 'Disable output sanitization (show full tool outputs)')
  .action(async (resultId, options) => {
    try {
      const params = new URLSearchParams({ resultId });
      if (options.version) {
        params.set('version', options.version);
      }
      if (options.raw) {
        params.set('sanitizeForDisplay', 'false');
      }
      if (options.includeFiles) {
        params.set('includeFiles', 'true');
      }

      const result = await apiRequest<ActionResult>(`/v1/cli/action/result?${params}`);

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

      ok('action.result', output);
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
        error instanceof Error ? error.message : 'Failed to get action result',
      );
    }
  });
