/**
 * refly workflow toolset-keys - List available toolset inventory keys
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface ToolsetKey {
  key: string;
  name: string;
  type: string;
  requiresAuth: boolean;
}

interface ToolsetKeysResponse {
  keys: ToolsetKey[];
}

export const workflowToolsetKeysCommand = new Command('toolset-keys')
  .description('List available toolset inventory keys for use with --toolsets')
  .option('--type <type>', 'Filter by toolset type (e.g., "regular", "external_oauth")')
  .action(async (options) => {
    try {
      const result = await apiRequest<ToolsetKeysResponse>('/v1/cli/workflow/toolset-keys', {
        method: 'GET',
      });

      let keys = result.keys;

      // Filter by type if specified
      if (options.type) {
        keys = keys.filter((k) => k.type === options.type);
      }

      ok('workflow.toolset-keys', {
        message: `Found ${keys.length} available toolset keys`,
        keys: keys.map((k) => ({
          key: k.key,
          name: k.name,
          type: k.type,
          requiresAuth: k.requiresAuth,
        })),
        hint: 'Use these keys with --toolsets option, e.g., --toolsets "tavily,fal_audio"',
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
        error instanceof Error ? error.message : 'Failed to list toolset keys',
      );
    }
  });
