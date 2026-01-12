/**
 * refly tool - Tool command group
 */

import { Command } from 'commander';
import { toolCallsCommand } from './calls.js';

export const toolCommand = new Command('tool')
  .description('Tool-related operations')
  .addCommand(toolCallsCommand);
