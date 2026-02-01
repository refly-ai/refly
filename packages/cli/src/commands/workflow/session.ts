/**
 * refly workflow session - Get workflow session info
 *
 * Returns the latest copilot session ID for a workflow, useful for
 * maintaining context continuity in workflow edit operations.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface WorkflowSessionResponse {
  workflowId: string;
  sessionId?: string;
  createdAt?: string;
  lastUsedAt?: string;
}

export const workflowSessionCommand = new Command('session')
  .description('Get the latest copilot session for a workflow')
  .argument('<workflowId>', 'Workflow ID (canvas ID)')
  .action(async (workflowId) => {
    try {
      const result = await apiRequest<WorkflowSessionResponse>(
        `/v1/cli/workflow/${workflowId}/session`,
      );

      ok('workflow.session', result);
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
        error instanceof Error ? error.message : 'Failed to get workflow session',
      );
    }
  });
