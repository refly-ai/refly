/**
 * refly workflow list - List all workflows
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface WorkflowSummary {
  workflowId: string;
  name: string;
  description?: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export const workflowListCommand = new Command('list')
  .description('List all workflows')
  .option('--limit <number>', 'Maximum number of workflows to return', '50')
  .option('--offset <number>', 'Offset for pagination', '0')
  .action(async (options) => {
    try {
      const limit = Number.parseInt(options.limit, 10);
      const offset = Number.parseInt(options.offset, 10);

      const result = await apiRequest<{
        workflows: WorkflowSummary[];
        total: number;
      }>(`/v1/cli/workflow?limit=${limit}&offset=${offset}`);

      ok('workflow.list', {
        workflows: result.workflows,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to list workflows',
      );
    }
  });
