/**
 * refly action - Action command group
 */

import { Command } from 'commander';
import { actionResultCommand } from './result.js';

export const actionCommand = new Command('action')
  .description('Manage and query action executions')
  .addCommand(actionResultCommand);
