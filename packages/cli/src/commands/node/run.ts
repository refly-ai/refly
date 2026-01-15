/**
 * refly node run - Run a single node for debugging
 *
 * Currently supports skillResponse node type.
 * Uses Redis distributed lock to prevent concurrent execution.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface NodeRunResult {
  nodeType: string;
  status: 'completed' | 'failed';
  output?: {
    resultId: string;
    version: number;
    status: string;
    message?: string;
    hint?: string;
  };
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  duration?: number;
  error?: string;
}

export const nodeRunCommand = new Command('run')
  .description('Run a single node for debugging (currently supports skillResponse only)')
  .requiredOption('--type <nodeType>', 'Node type to run (e.g., "skillResponse")')
  .option('--query <query>', 'Query text for skillResponse node')
  .option('--input <json>', 'Full input data as JSON (alternative to --query)')
  .option('--config <json>', 'Node configuration as JSON (e.g., {"modelItemId": "..."})')
  .action(async (options) => {
    try {
      // Build input from query or JSON
      let input: Record<string, unknown> = {};
      if (options.query) {
        input = { query: options.query };
      } else if (options.input) {
        try {
          input = JSON.parse(options.input);
        } catch {
          fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --input', {
            hint: 'Ensure the input is valid JSON',
          });
          return;
        }
      }

      // Parse config if provided
      let config: Record<string, unknown> = {};
      if (options.config) {
        try {
          config = JSON.parse(options.config);
        } catch {
          fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --config', {
            hint: 'Ensure the config is valid JSON',
          });
          return;
        }
      }

      const result = await apiRequest<NodeRunResult>('/v1/cli/node/run', {
        method: 'POST',
        body: {
          nodeType: options.type,
          input,
          config,
        },
      });

      if (result.status === 'completed') {
        ok('node.run', {
          nodeType: result.nodeType,
          status: result.status,
          output: result.output,
          duration: result.duration,
          tokenUsage: result.tokenUsage,
        });
      } else {
        fail(ErrorCodes.EXECUTION_FAILED, result.error || 'Node execution failed', {
          details: {
            nodeType: result.nodeType,
            output: result.output,
          },
        });
      }
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
