/**
 * refly skill delete - Delete a skill package
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

export const skillDeleteCommand = new Command('delete')
  .description('Delete a skill package')
  .argument('<skillId>', 'Skill package ID to delete')
  .option('--force', 'Skip confirmation')
  .action(async (skillId, _options) => {
    try {
      await apiRequest(`/v1/skill-packages/${skillId}`, {
        method: 'DELETE',
      });

      ok('skill.delete', {
        skillId,
        deleted: true,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to delete skill package',
      );
    }
  });
