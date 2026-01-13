/**
 * refly workflow - Workflow command group
 */

import { Command } from 'commander';
import { workflowCreateCommand } from './create.js';
import { workflowGenerateCommand } from './generate.js';
import { workflowListCommand } from './list.js';
import { workflowGetCommand } from './get.js';
import { workflowEditCommand } from './edit.js';
import { workflowDeleteCommand } from './delete.js';
import { workflowRunCommand } from './run.js';
import { workflowAbortCommand } from './abort.js';
import { workflowStatusCommand } from './status.js';
import { workflowToolsetKeysCommand } from './toolset-keys.js';
import { workflowLayoutCommand } from './layout.js';

// The run command is now a command group with subcommands:
//   refly workflow run <workflowId> - Start a workflow
//   refly workflow run detail <runId> - Get detailed run info
//   refly workflow run node <runId> <nodeId> - Get node result
//   refly workflow run toolcalls <runId> - Get tool calls

export const workflowCommand = new Command('workflow')
  .description('Manage and run workflows')
  .addCommand(workflowCreateCommand)
  .addCommand(workflowGenerateCommand)
  .addCommand(workflowListCommand)
  .addCommand(workflowGetCommand)
  .addCommand(workflowEditCommand)
  .addCommand(workflowDeleteCommand)
  .addCommand(workflowRunCommand)
  .addCommand(workflowAbortCommand)
  .addCommand(workflowStatusCommand)
  .addCommand(workflowToolsetKeysCommand)
  .addCommand(workflowLayoutCommand);
