/**
 * refly upgrade - Reinstall/upgrade skill files
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../utils/output.js';
import { installSkill, isSkillInstalled } from '../skill/installer.js';

export const upgradeCommand = new Command('upgrade')
  .description('Reinstall or upgrade skill files')
  .action(async () => {
    try {
      const beforeStatus = isSkillInstalled();
      const result = installSkill();

      ok('upgrade', {
        message: 'Skill files upgraded successfully',
        previousVersion: beforeStatus.currentVersion ?? null,
        newVersion: result.version,
        skillPath: result.skillPath,
        commandsInstalled: result.commandsInstalled,
      });
    } catch (error) {
      return fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to upgrade',
        { hint: 'Check permissions and try again' },
      );
    }
  });
