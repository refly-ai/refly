/**
 * refly skill unpublish - Unpublish a skill package
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

export const skillUnpublishCommand = new Command('unpublish')
  .description('Unpublish a skill package to make it private')
  .argument('<skillId>', 'Skill package ID to unpublish')
  .action(async (skillId) => {
    try {
      await apiRequest(`/v1/skill-packages/${skillId}/unpublish`, {
        method: 'POST',
      });

      ok('skill.unpublish', {
        skillId,
        status: 'draft',
        isPublic: false,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to unpublish skill package',
      );
    }
  });
