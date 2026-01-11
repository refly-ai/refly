/**
 * refly workflow edit - Edit an existing workflow
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

export const workflowEditCommand = new Command('edit')
  .description('Edit an existing workflow')
  .argument('<workflowId>', 'Workflow ID')
  .requiredOption('--ops <json>', 'Operations to apply as JSON')
  .action(async (workflowId, options) => {
    try {
      // Parse ops JSON
      let ops: unknown;
      try {
        ops = JSON.parse(options.ops);
      } catch {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --ops', {
          hint: 'Ensure the operations are valid JSON',
        });
      }

      const result = await apiRequest<{
        workflowId: string;
        name: string;
        updatedAt: string;
      }>(`/v1/cli/workflow/${workflowId}`, {
        method: 'PATCH',
        body: { ops },
      });

      ok('workflow.edit', {
        message: 'Workflow updated successfully',
        workflowId: result.workflowId,
        name: result.name,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to edit workflow',
      );
    }
  });
