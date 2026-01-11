/**
 * refly node - Node command group
 */

import { Command } from 'commander';
import { nodeTypesCommand } from './types.js';
import { nodeRunCommand } from './run.js';

export const nodeCommand = new Command('node')
  .description('Debug and test workflow nodes')
  .addCommand(nodeTypesCommand)
  .addCommand(nodeRunCommand);
