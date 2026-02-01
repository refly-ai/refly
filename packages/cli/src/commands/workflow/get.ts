/**
 * refly workflow get - Get workflow details
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface WorkflowDetail {
  workflowId: string;
  name: string;
  description?: string;
  spec: {
    version: number;
    nodes: Array<{
      id: string;
      type: string;
      input: Record<string, unknown>;
      dependsOn: string[];
    }>;
    metadata?: Record<string, unknown>;
  };
  createdAt: string;
  updatedAt: string;
  sessionId?: string;
}

export const workflowGetCommand = new Command('get')
  .description('Get workflow details')
  .argument('<workflowId>', 'Workflow ID')
  .action(async (workflowId) => {
    try {
      const result = await apiRequest<WorkflowDetail>(`/v1/cli/workflow/${workflowId}`);

      ok('workflow.get', result);
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
        error instanceof Error ? error.message : 'Failed to get workflow',
      );
    }
  });
