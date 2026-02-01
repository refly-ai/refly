/**
 * refly workflow - Workflow command group
 *
 * Most commands support both workflowId (c-xxx) and runId (we-xxx):
 * - workflowId: operates on the latest run
 * - runId: operates on the specific run
 */

import { Command } from 'commander';
import { workflowCreateCommand } from './create.js';
import { workflowGenerateCommand } from './generate.js';
import { workflowListCommand } from './list.js';
import { workflowGetCommand } from './get.js';
import { workflowDeleteCommand } from './delete.js';
import { workflowRunCommand } from './run.js';
import { workflowRunsCommand } from './runs.js';
import { workflowAbortCommand } from './abort.js';
import { workflowStatusCommand } from './status.js';
import { workflowDetailCommand } from './detail.js';
import { workflowToolcallsCommand } from './toolcalls.js';
import { workflowToolsetKeysCommand } from './toolset-keys.js';
import { workflowLayoutCommand } from './layout.js';
import { workflowNodeCommand } from './node/index.js';
import { workflowEditCommand } from './edit.js';
import { workflowVariablesCommand } from './variables.js';
import { workflowResultCommand } from './result.js';
import { workflowSessionCommand } from './session.js';

export const workflowCommand = new Command('workflow')
  .description('Manage and run workflows')
  // Workflow management
  .addCommand(workflowCreateCommand)
  .addCommand(workflowGenerateCommand)
  .addCommand(workflowListCommand)
  .addCommand(workflowGetCommand)
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
  // Node management (subcommand group)
  .addCommand(workflowNodeCommand)
  // Workflow plan operations
  .addCommand(workflowEditCommand)
  // Workflow variables
  .addCommand(workflowVariablesCommand)
  // Workflow session
  .addCommand(workflowSessionCommand)
  // Action result
  .addCommand(workflowResultCommand);
