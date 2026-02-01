/**
 * refly workflow node - Node management subcommand group
 */

import { Command } from 'commander';
import { nodeListCommand } from './list.js';
import { nodeGetCommand } from './get.js';
import { nodeAddCommand } from './add.js';
import { nodeUpdateCommand } from './update.js';
import { nodeDeleteCommand } from './delete.js';
import { nodeOutputCommand } from './output.js';

export const workflowNodeCommand = new Command('node')
  .description('Manage workflow nodes')
  .addCommand(nodeListCommand)
  .addCommand(nodeGetCommand)
  .addCommand(nodeAddCommand)
  .addCommand(nodeUpdateCommand)
  .addCommand(nodeDeleteCommand)
  .addCommand(nodeOutputCommand);
