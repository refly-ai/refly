/**
 * refly workflow edit - Edit an existing workflow
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface UpdateWorkflowBody {
  name?: string;
  variables?: Array<{ name: string; value: unknown }>;
  operations?: Array<{
    type: 'add_node' | 'remove_node' | 'update_node' | 'add_edge' | 'remove_edge';
    [key: string]: unknown;
  }>;
}

/**
 * Transform CLI operation format to backend format
 * CLI uses: { op: "add", node: {...} }
 * Backend expects: { type: "add_node", node: {...} }
 */
function transformOperations(
  ops: Array<{ op: string; [key: string]: unknown }>,
): UpdateWorkflowBody['operations'] {
  const opMapping: Record<string, string> = {
    add: 'add_node',
    remove: 'remove_node',
    update: 'update_node',
    addEdge: 'add_edge',
    removeEdge: 'remove_edge',
    // Also support direct backend format
    add_node: 'add_node',
    remove_node: 'remove_node',
    update_node: 'update_node',
    add_edge: 'add_edge',
    remove_edge: 'remove_edge',
  };

  return ops.map((op) => {
    const { op: opType, ...rest } = op;
    const backendType = opMapping[opType];
    if (!backendType) {
      throw new Error(`Unknown operation type: ${opType}`);
    }
    return {
      type: backendType as 'add_node' | 'remove_node' | 'update_node' | 'add_edge' | 'remove_edge',
      ...rest,
    };
  });
}

export const workflowEditCommand = new Command('edit')
  .description('Edit an existing workflow')
  .argument('<workflowId>', 'Workflow ID or URL')
  .option('--name <name>', 'New workflow name')
  .option('--ops <json>', 'Node/edge operations as JSON array')
  .option('--variables <json>', 'Workflow variables as JSON array')
  .option('--toolsets <keys>', 'Toolset inventory keys (comma-separated, e.g., "tavily,fal_audio")')
  .option('--auto-layout', 'Enable auto-layout to prevent node overlapping')
  .action(async (workflowIdOrUrl, options) => {
    try {
      // Extract workflowId from URL if needed
      let workflowId = workflowIdOrUrl;
      if (workflowIdOrUrl.includes('/workflow/')) {
        const match = workflowIdOrUrl.match(/\/workflow\/(c-[a-z0-9]+)/);
        if (match) {
          workflowId = match[1];
        }
      }

      // Build request body
      const body: UpdateWorkflowBody = {};

      if (options.name) {
        body.name = options.name;
      }

      // Parse toolset keys if provided
      let toolsetKeys: string[] | undefined;
      if (options.toolsets) {
        toolsetKeys = options.toolsets
          .split(',')
          .map((k: string) => k.trim())
          .filter((k: string) => k.length > 0);
      }

      if (options.ops) {
        try {
          const rawOps = JSON.parse(options.ops);
          body.operations = transformOperations(rawOps);

          // Inject toolsetKeys into add_node operations if --toolsets is provided
          if (toolsetKeys && toolsetKeys.length > 0 && body.operations) {
            body.operations = body.operations.map((op) => {
              if (op.type === 'add_node' && op.node) {
                const node = op.node as Record<string, unknown>;
                const data = (node.data as Record<string, unknown>) || {};
                const metadata = (data.metadata as Record<string, unknown>) || {};
                return {
                  ...op,
                  node: {
                    ...node,
                    data: {
                      ...data,
                      metadata: {
                        ...metadata,
                        toolsetKeys,
                      },
                    },
                  },
                };
              }
              return op;
            });
          }
        } catch (error) {
          fail(ErrorCodes.INVALID_INPUT, `Invalid operations: ${(error as Error).message}`, {
            hint: 'Ensure the operations are a valid JSON array with correct op types',
          });
        }
      }

      if (options.variables) {
        try {
          body.variables = JSON.parse(options.variables);
        } catch {
          fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --variables', {
            hint: 'Ensure the variables are a valid JSON array',
          });
        }
      }

      // Check if any update option was provided
      if (!options.name && !options.ops && !options.variables) {
        fail(ErrorCodes.INVALID_INPUT, 'No update options provided', {
          hint: 'Use --name, --ops, --variables, or --toolsets to specify what to update',
        });
      }

      // Build API endpoint with query parameters
      let endpoint = `/v1/cli/workflow/${workflowId}`;
      const queryParams: string[] = [];
      if (toolsetKeys && toolsetKeys.length > 0) {
        queryParams.push('resolveToolsetKeys=true');
      }
      if (options.autoLayout) {
        queryParams.push('autoLayout=true');
      }
      if (queryParams.length > 0) {
        endpoint += `?${queryParams.join('&')}`;
      }

      await apiRequest<{ success: boolean }>(endpoint, {
        method: 'PATCH',
        body,
      });

      ok('workflow.edit', {
        message: 'Workflow updated successfully',
        workflowId,
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
