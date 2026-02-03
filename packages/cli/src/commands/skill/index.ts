/**
 * refly skill - Skill command group
 *
 * Manages skill packages (cloud) and local skills.
 */

import { Command } from 'commander';
import { skillListCommand } from './list.js';
import { skillGetCommand } from './get.js';
import { skillCreateCommand } from './create.js';
import { skillUpdateCommand } from './update.js';
import { skillPublishCommand } from './publish.js';
import { skillUnpublishCommand } from './unpublish.js';
import { skillRunCommand } from './run.js';
import { skillStopCommand } from './stop.js';
import { skillSearchCommand } from './search.js';
import { skillInstallCommand } from './install.js';
import { skillUninstallCommand } from './uninstall.js';
import { skillInstallationsCommand } from './installations.js';
import { skillValidateCommand } from './validate.js';
import { skillSyncCommand } from './sync.js';

export const skillCommand = new Command('skill')
  .description('Manage skill packages and local skills')
  // Skill management
  .addCommand(skillListCommand)
  .addCommand(skillGetCommand)
  .addCommand(skillCreateCommand)
  .addCommand(skillUpdateCommand)
  .addCommand(skillPublishCommand)
  .addCommand(skillUnpublishCommand)
  // Skill discovery
  .addCommand(skillSearchCommand)
  // Skill installation (cloud skills)
  .addCommand(skillInstallCommand)
  .addCommand(skillUninstallCommand)
  .addCommand(skillInstallationsCommand)
  // Skill execution
  .addCommand(skillRunCommand)
  .addCommand(skillStopCommand)
  // Skill validation (local skills)
  .addCommand(skillValidateCommand)
  // Skill registry sync
  .addCommand(skillSyncCommand);
