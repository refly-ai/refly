/**
 * refly workflow create - Removed command
 *
 * This command has been removed. Use `refly workflow generate` instead.
 */

import { Command } from 'commander';
import { fail, ErrorCodes } from '../../utils/output.js';

export const workflowCreateCommand = new Command('create')
  .description('[Removed] Use "refly workflow generate" instead')
  .allowUnknownOption(true)
  .action(async () => {
    fail(ErrorCodes.INVALID_INPUT, 'Command "workflow create" has been removed', {
      hint: 'Use "refly workflow generate" to create workflows from natural language.\n\nExample:\n  refly workflow generate --query "Parse PDF, summarize content, translate to Chinese"',
      suggestedFix: {
        field: 'command',
        example: 'refly workflow generate --query "your workflow description"',
      },
    });
  });
