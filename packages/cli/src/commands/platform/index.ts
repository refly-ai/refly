/**
 * refly platform - Multi-platform skill deployment commands
 */

import { Command } from 'commander';
import { platformSyncCommand } from './sync.js';

export const platformCommand = new Command('platform')
  .description('Manage multi-platform skill deployment')
  .addCommand(platformSyncCommand);
