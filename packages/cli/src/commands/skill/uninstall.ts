/**
 * refly skill uninstall - Uninstall a skill
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

export const skillUninstallCommand = new Command('uninstall')
  .description('Uninstall a skill')
  .argument('<installationId>', 'Installation ID to uninstall')
  .option('--force', 'Skip confirmation')
  .action(async (installationId, _options) => {
    try {
      await apiRequest(`/v1/skill-installations/${installationId}`, {
        method: 'DELETE',
      });

      ok('skill.uninstall', {
        installationId,
        uninstalled: true,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to uninstall skill',
      );
    }
  });
