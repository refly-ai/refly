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

// The main run command handles `workflow run <workflowId>`
// We need to handle this specially since `run` is both a command and a subcommand group

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
  .addCommand(workflowStatusCommand);

// Add the run get subcommand under a different path
// Users will use: refly workflow run get <runId>
workflowCommand.addCommand(
  new Command('run-status')
    .description('Get workflow run status (alias for run get)')
    .argument('<runId>', 'Run ID')
    .action(async (runId) => {
      // Delegate to run-get
      const { ok, fail, ErrorCodes } = await import('../../utils/output.js');
      const { apiRequest } = await import('../../api/client.js');
      const { CLIError } = await import('../../utils/errors.js');

      try {
        const result = await apiRequest(`/v1/cli/workflow/run/${runId}`);
        ok('workflow.run.get', result);
      } catch (error) {
        if (error instanceof CLIError) {
          fail(error.code, error.message, { details: error.details, hint: error.hint });
        }
        fail(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Failed to get run status',
        );
      }
    }),
);
