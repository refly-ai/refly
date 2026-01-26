/**
 * refly workflow delete - Delete a workflow
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

export const workflowDeleteCommand = new Command('delete')
  .description('Delete a workflow')
  .argument('<workflowId>', 'Workflow ID')
  .action(async (workflowId) => {
    try {
      await apiRequest(`/v1/cli/workflow/${workflowId}`, {
        method: 'DELETE',
      });

      ok('workflow.delete', {
        message: 'Workflow deleted successfully',
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
        error instanceof Error ? error.message : 'Failed to delete workflow',
      );
    }
  });
