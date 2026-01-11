/**
 * refly node run - Run a single node for debugging
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface NodeRunResult {
  result: unknown;
  metrics: {
    durationMs: number;
    tokensUsed?: number;
  };
  logs?: string[];
}

export const nodeRunCommand = new Command('run')
  .description('Run a single node for debugging')
  .requiredOption('--type <nodeType>', 'Node type to run')
  .requiredOption('--input <json>', 'Input data as JSON')
  .action(async (options) => {
    try {
      // Parse input JSON
      let input: unknown;
      try {
        input = JSON.parse(options.input);
      } catch {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --input', {
          hint: 'Ensure the input is valid JSON',
        });
      }

      const result = await apiRequest<NodeRunResult>('/v1/cli/node/run', {
        method: 'POST',
        body: {
          type: options.type,
          input,
        },
      });

      ok('node.run', {
        type: options.type,
        result: result.result,
        metrics: result.metrics,
        logs: result.logs ?? [],
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to run node',
      );
    }
  });
