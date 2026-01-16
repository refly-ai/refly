/**
 * refly workflow - Workflow command group
 *
 * All commands use workflowId (not runId) for simplicity.
 * The backend automatically finds the current/latest execution.
 */

import { Command } from 'commander';
import { workflowCreateCommand } from './create.js';
import { workflowGenerateCommand } from './generate.js';
import { workflowListCommand } from './list.js';
import { workflowGetCommand } from './get.js';
import { workflowEditCommand } from './edit.js';
import { workflowDeleteCommand } from './delete.js';
import { workflowRunCommand } from './run.js';
import { workflowRunsCommand } from './runs.js';
import { workflowAbortCommand } from './abort.js';
import { workflowStatusCommand } from './status.js';
import { workflowDetailCommand } from './detail.js';
import { workflowToolcallsCommand } from './toolcalls.js';
import { workflowToolsetKeysCommand } from './toolset-keys.js';
import { workflowLayoutCommand } from './layout.js';
import { workflowNodesCommand } from './nodes.js';
import { workflowNodeGetCommand } from './node-get.js';

export const workflowCommand = new Command('workflow')
  .description('Manage and run workflows')
  // Workflow management
  .addCommand(workflowCreateCommand)
  .addCommand(workflowGenerateCommand)
  .addCommand(workflowListCommand)
  .addCommand(workflowGetCommand)
  .addCommand(workflowEditCommand)
  .addCommand(workflowDeleteCommand)
  // Workflow execution
  .addCommand(workflowRunCommand)
  .addCommand(workflowRunsCommand)
  .addCommand(workflowStatusCommand)
  .addCommand(workflowDetailCommand)
  .addCommand(workflowToolcallsCommand)
  .addCommand(workflowAbortCommand)
  // Workflow utilities
  .addCommand(workflowToolsetKeysCommand)
  .addCommand(workflowLayoutCommand)
  .addCommand(workflowNodesCommand)
  .addCommand(workflowNodeGetCommand);
