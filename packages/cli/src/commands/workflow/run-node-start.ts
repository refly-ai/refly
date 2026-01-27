/**
 * refly workflow run node-start - Run From Here
 *
 * Runs from the specified node and continues to downstream nodes.
 *
 * Usage:
 *   refly workflow run node-start --from <nodeId> --workflow-id <workflowId>
 *   refly workflow run node-start --from <nodeId> --run-id <runId>
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface WorkflowFromNodeResult {
  runId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
  createdAt: string;
}

export const workflowRunNodeStartCommand = new Command('node-start')
  .description('Run workflow from a specific node (Run From Here)')
  .requiredOption('--from <nodeId>', 'Node ID to run from (includes downstream nodes)')
  .option('--run-id <runId>', 'Run ID for workflow context')
  .option('--workflow-id <workflowId>', 'Workflow ID for workflow context')
  .action(async (options) => {
    try {
      // Validate input
      if (!options.workflowId && !options.runId) {
        fail(ErrorCodes.INVALID_INPUT, '--workflow-id or --run-id is required', {
          hint: 'Specify the workflow context with --workflow-id <workflowId> or --run-id <runId>',
        });
        return;
      }

      // Get workflowId
      let workflowId: string;
      if (options.workflowId) {
        workflowId = options.workflowId;
      } else {
        const runStatus = await apiRequest<{ workflowId: string }>(
          `/v1/cli/workflow/run/${options.runId}`,
        );
        workflowId = runStatus.workflowId;
      }

      const nodeId = options.from;

      // Run From Here mode: POST /v1/cli/workflow/:id/run with startNodes
      const result = await apiRequest<WorkflowFromNodeResult>(
        `/v1/cli/workflow/${workflowId}/run`,
        {
          method: 'POST',
          body: { startNodes: [nodeId] },
        },
      );

      ok('workflow.run.node-start', {
        message: `Workflow run started from node ${nodeId}`,
        runId: result.runId,
        workflowId: result.workflowId,
        startNode: nodeId,
        status: result.status,
        createdAt: result.createdAt,
        nextSteps: [
          `Check status: \`refly workflow status ${workflowId}\``,
          `Get details: \`refly workflow detail ${workflowId}\``,
          `Get node output: \`refly workflow node output ${workflowId} ${nodeId}\``,
        ],
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
        error instanceof Error ? error.message : 'Failed to run node',
      );
    }
  });
