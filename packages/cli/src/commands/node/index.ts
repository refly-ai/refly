/**
 * refly node - Node command group
 */

import { Command } from 'commander';
import { nodeTypesCommand } from './types.js';
import { nodeRunCommand } from './run.js';
import { nodeResultCommand } from './result.js';

export const nodeCommand = new Command('node')
  .description('Node operations: types, run, and execution results')
  .addCommand(nodeTypesCommand)
  .addCommand(nodeRunCommand)
  .addCommand(nodeResultCommand);
