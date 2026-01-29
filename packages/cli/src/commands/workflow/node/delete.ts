/**
 * refly workflow node delete - Delete a node from a workflow
 *
 * Removes a node and its connected edges from a workflow.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../../utils/output.js';
import { apiRequest } from '../../../api/client.js';
import { CLIError } from '../../../utils/errors.js';

interface RemoveNodeOperation {
  type: 'remove_node';
  nodeId: string;
}

interface UpdateWorkflowRequest {
  operations: RemoveNodeOperation[];
}

export const nodeDeleteCommand = new Command('delete')
  .description('Delete a node from a workflow')
  .argument('<workflowId>', 'Workflow ID (c-xxx)')
  .argument('<nodeId>', 'Node ID to delete')
  .action(async (workflowId, nodeId) => {
    // Validate workflowId format
    if (!workflowId.startsWith('c-')) {
      fail(ErrorCodes.INVALID_INPUT, `Invalid workflow ID: ${workflowId}`, {
        hint: 'Workflow ID should start with "c-"',
        suggestedFix: {
          field: '<workflowId>',
          format: 'c-<id>',
          example: 'c-123456',
        },
      });
      return;
    }

    try {
      // Build request
      const body: UpdateWorkflowRequest = {
        operations: [
          {
            type: 'remove_node',
            nodeId,
          },
        ],
      };

      await apiRequest(`/v1/cli/workflow/${workflowId}`, {
        method: 'PATCH',
        body,
      });

      ok('workflow.node.delete', {
        message: 'Node deleted successfully',
        workflowId,
        nodeId,
        note: 'Connected edges were also removed',
        nextSteps: [`List remaining nodes: \`refly workflow node list ${workflowId}\``],
      });
    } catch (error) {
      if (error instanceof CLIError) {
        // Replace placeholders with actual values in hint
        const hint = error.hint?.replace(/<workflowId>/g, workflowId).replace(/<nodeId>/g, nodeId);
        fail(error.code, error.message, {
          details: error.details,
          hint,
          suggestedFix: error.suggestedFix,
        });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to delete node',
      );
    }
  });
