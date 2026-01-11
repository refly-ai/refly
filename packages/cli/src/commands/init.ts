/**
 * refly init - Initialize CLI and install skill files
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../utils/output.js';
import { installSkill, isSkillInstalled } from '../skill/installer.js';
import { loadConfig, saveConfig } from '../config/config.js';
import { getReflyDir } from '../config/paths.js';

export const initCommand = new Command('init')
  .description('Initialize Refly CLI and install skill files')
  .option('--force', 'Force reinstall even if already installed')
  .action(async (options) => {
    try {
      const { force } = options;

      // Check current state
      const skillStatus = isSkillInstalled();

      if (skillStatus.installed && skillStatus.upToDate && !force) {
        ok('init', {
          message: 'Refly CLI already initialized',
          configDir: getReflyDir(),
          skillInstalled: true,
          skillVersion: skillStatus.currentVersion,
        });
      }

      // Initialize config
      const config = loadConfig();
      saveConfig(config);

      // Install skill files
      const result = installSkill();

      ok('init', {
        message: 'Refly CLI initialized successfully',
        configDir: getReflyDir(),
        skillInstalled: result.skillInstalled,
        skillPath: result.skillPath,
        commandsInstalled: result.commandsInstalled,
        commandsPath: result.commandsPath,
        version: result.version,
        nextStep: 'Run `refly login` to authenticate',
      });
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to initialize',
        { hint: 'Check permissions and try again' },
      );
    }
  });
