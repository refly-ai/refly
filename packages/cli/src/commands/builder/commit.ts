/**
 * refly builder commit - Commit the draft and create workflow
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { getCurrentSession } from '../../builder/store.js';
import { commitSession } from '../../builder/commit.js';
import { BuilderError } from '../../utils/errors.js';
import { CLIError } from '../../utils/errors.js';

export const builderCommitCommand = new Command('commit')
  .description('Commit the validated draft and create the workflow')
  .action(async () => {
    try {
      const session = getCurrentSession();

      if (!session) {
        fail(ErrorCodes.BUILDER_NOT_STARTED, 'No active builder session', {
          hint: 'refly builder start --name "your-workflow"',
        });
      }

      // Commit
      const result = await commitSession(session);

      ok('builder.commit', {
        message: 'Workflow created successfully',
        workflowId: result.workflowId,
        workflowName: result.name,
        createdAt: result.createdAt,
        nextStep: `Run your workflow with \`refly workflow run ${result.workflowId}\``,
      });
    } catch (error) {
      if (error instanceof BuilderError || error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Failed to commit');
    }
  });
