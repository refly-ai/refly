/**
 * refly workflow abort - Abort a running workflow
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

export const workflowAbortCommand = new Command('abort')
  .description('Abort a running workflow')
  .argument('<workflowId>', 'Workflow ID')
  .action(async (workflowId) => {
    try {
      await apiRequest(`/v1/cli/workflow/${workflowId}/abort`, {
        method: 'POST',
      });

      ok('workflow.abort', {
        message: 'Workflow run aborted',
        workflowId,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to abort workflow',
      );
    }
  });
