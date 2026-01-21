/**
 * refly workflow run - Workflow run command group
 *
 * Subcommands:
 * - `workflow run start <workflowId>` - Start a workflow execution
 * - `workflow run get <runId>` - Get run status
 * - `workflow run detail <runId>` - Get detailed run info
 * - `workflow run node-detail <runId> <nodeId>` - Get node execution detail
 * - `workflow run toolcalls <runId>` - Get tool calls for run
 * - `workflow run node-start` - Run single node for debugging or start from node
 * - `workflow run node-result <resultId>` - Get node execution result
 * - `workflow run node-abort <resultId>` - Abort running node execution
 * - `workflow run node-toolcalls <resultId>` - List tool calls from node execution
 * - `workflow run node-toolcall <callId>` - Get single tool call detail
 */

import { Command } from 'commander';
import { workflowRunStartCommand } from './run-start.js';
import { workflowRunGetCommand } from './run-get.js';
import { workflowRunDetailCommand } from './run-detail.js';
import { workflowRunNodeDetailCommand } from './run-node-detail.js';
import { workflowRunToolcallsCommand } from './run-toolcalls.js';
import { workflowRunNodeStartCommand } from './run-node-start.js';
import { workflowRunNodeResultCommand } from './run-node-result.js';
import { workflowRunNodeAbortCommand } from './run-node-abort.js';
import { workflowRunNodeToolcallsCommand } from './run-node-toolcalls.js';
import { workflowRunNodeToolcallCommand } from './run-node-toolcall.js';

export const workflowRunCommand = new Command('run')
  .description('Workflow run operations: start, query status, and inspect results')
  .addCommand(workflowRunStartCommand)
  .addCommand(workflowRunGetCommand)
  .addCommand(workflowRunDetailCommand)
  .addCommand(workflowRunNodeDetailCommand)
  .addCommand(workflowRunToolcallsCommand)
  .addCommand(workflowRunNodeStartCommand)
  .addCommand(workflowRunNodeResultCommand)
  .addCommand(workflowRunNodeAbortCommand)
  .addCommand(workflowRunNodeToolcallsCommand)
  .addCommand(workflowRunNodeToolcallCommand)
  .action(() => {
    // Show help when no subcommand is provided
    workflowRunCommand.help();
  });
