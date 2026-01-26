/**
 * refly workflow run node-abort - Abort a running node execution
 *
 * Usage:
 *   refly workflow run node-abort <resultId>
 *   refly workflow run node-abort <resultId> --version <number>
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface AbortResponse {
  message: string;
  resultId: string;
}

export const workflowRunNodeAbortCommand = new Command('node-abort')
  .description('Abort a running node execution by result ID')
  .argument('<resultId>', 'Result ID to abort')
  .option('--version <number>', 'Specific version to abort', Number.parseInt)
  .action(async (resultId, options) => {
    try {
      const body: { resultId: string; version?: number } = { resultId };
      if (options.version !== undefined) {
        body.version = options.version;
      }

      const result = await apiRequest<AbortResponse>('/v1/cli/action/abort', {
        method: 'POST',
        body,
      });

      ok('workflow.run.node-abort', {
        message: result.message,
        resultId: result.resultId,
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
        error instanceof Error ? error.message : 'Failed to abort node execution',
      );
    }
  });
