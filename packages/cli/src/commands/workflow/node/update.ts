/**
 * refly workflow node update - Update a node in a workflow
 *
 * Updates node data such as query, toolsetKeys, title, etc.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../../utils/output.js';
import { apiRequest } from '../../../api/client.js';
import { CLIError } from '../../../utils/errors.js';

interface UpdateNodeOperation {
  type: 'update_node';
  nodeId: string;
  data: Record<string, unknown>;
}

interface UpdateWorkflowRequest {
  operations: UpdateNodeOperation[];
}

export const nodeUpdateCommand = new Command('update')
  .description('Update a node in a workflow')
  .argument('<workflowId>', 'Workflow ID (c-xxx)')
  .argument('<nodeId>', 'Node ID to update')
  .option('--query <query>', 'Update the query/prompt for the node')
  .option('--title <title>', 'Update the node title')
  .option('--toolset-keys <keys>', 'Comma-separated toolset keys (e.g., "web_search,execute_code")')
  .option('--data <json>', 'Full node data as JSON (advanced usage)')
  .option('--resolve-toolset-keys', 'Resolve toolset keys to full IDs')
  .action(async (workflowId, nodeId, options) => {
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
      // Build node data update
      let nodeData: Record<string, unknown> = {};

      // Parse --data if provided (advanced usage)
      if (options.data) {
        try {
          nodeData = JSON.parse(options.data);
        } catch {
          fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --data', {
            hint: 'Data format: \'{"data": {"metadata": {"query": "...", "toolsetKeys": ["..."]}}}\'',
            suggestedFix: {
              field: '--data',
              format: 'json-object',
              example: '{"data": {"metadata": {"query": "Search for information"}}}',
            },
          });
          return;
        }
      }

      // Build metadata updates from individual options
      const metadataUpdates: Record<string, unknown> = {};

      if (options.query) {
        metadataUpdates.query = options.query;
      }

      if (options.title) {
        metadataUpdates.title = options.title;
      }

      if (options.toolsetKeys) {
        const keys = options.toolsetKeys.split(',').map((k: string) => k.trim());
        metadataUpdates.toolsetKeys = keys;
      }

      // Merge metadata into node data
      if (Object.keys(metadataUpdates).length > 0) {
        nodeData = {
          ...nodeData,
          data: {
            ...((nodeData.data as Record<string, unknown>) || {}),
            metadata: {
              ...(((nodeData.data as Record<string, unknown>)?.metadata as Record<
                string,
                unknown
              >) || {}),
              ...metadataUpdates,
            },
          },
        };
      }

      // Validate at least one update is provided
      if (Object.keys(nodeData).length === 0) {
        fail(ErrorCodes.INVALID_INPUT, 'No update provided', {
          hint: 'Use --query, --title, --toolset-keys, or --data to specify what to update',
          suggestedFix: {
            field: '--query',
            format: 'string',
            example: '--query "Search for the latest news"',
          },
        });
        return;
      }

      // Build request
      const body: UpdateWorkflowRequest = {
        operations: [
          {
            type: 'update_node',
            nodeId,
            data: nodeData,
          },
        ],
      };

      // Build query params
      const queryParams = options.resolveToolsetKeys ? '?resolveToolsetKeys=true' : '';

      await apiRequest(`/v1/cli/workflow/${workflowId}${queryParams}`, {
        method: 'PATCH',
        body,
      });

      ok('workflow.node.update', {
        message: 'Node updated successfully',
        workflowId,
        nodeId,
        updates: {
          ...(options.query && { query: options.query }),
          ...(options.title && { title: options.title }),
          ...(options.toolsetKeys && {
            toolsetKeys: options.toolsetKeys.split(',').map((k: string) => k.trim()),
          }),
          ...(options.data && { data: 'custom data applied' }),
        },
        nextSteps: [
          `View updated node: \`refly workflow node get ${workflowId} ${nodeId}\``,
          `List all nodes: \`refly workflow node list ${workflowId}\``,
        ],
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
        error instanceof Error ? error.message : 'Failed to update node',
      );
    }
  });
