/**
 * refly workflow node add - Add a node to a workflow
 *
 * Adds a new node to an existing workflow.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../../utils/output.js';
import { apiRequest } from '../../../api/client.js';
import { CLIError } from '../../../utils/errors.js';

interface CanvasNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

interface AddNodeOperation {
  type: 'add_node';
  node: CanvasNode;
}

interface AddEdgeOperation {
  type: 'add_edge';
  edge: {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  };
}

interface UpdateWorkflowRequest {
  operations: (AddNodeOperation | AddEdgeOperation)[];
}

export const nodeAddCommand = new Command('add')
  .description('Add a node to a workflow')
  .argument('<workflowId>', 'Workflow ID (c-xxx)')
  .requiredOption('--type <type>', 'Node type (skillResponse, start, document, resource, memo)')
  .option('--id <nodeId>', 'Custom node ID (auto-generated if not provided)')
  .option('--query <query>', 'Query/prompt for the node')
  .option('--title <title>', 'Node title')
  .option('--toolset-keys <keys>', 'Comma-separated toolset keys (e.g., "web_search,execute_code")')
  .option('--position <x,y>', 'Node position as "x,y" (default: 0,0)')
  .option('--connect-from <nodeId>', 'Connect from this node (creates edge)')
  .option('--connect-to <nodeId>', 'Connect to this node (creates edge)')
  .option('--resolve-toolset-keys', 'Resolve toolset keys to full IDs')
  .option('--auto-layout', 'Enable auto-layout to prevent overlapping')
  .action(async (workflowId, options) => {
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

    // Validate node type
    const validTypes = ['skillResponse', 'start', 'document', 'resource', 'memo'];
    if (!validTypes.includes(options.type)) {
      fail(ErrorCodes.INVALID_INPUT, `Invalid node type: ${options.type}`, {
        hint: `Valid types: ${validTypes.join(', ')}`,
        suggestedFix: {
          field: '--type',
          format: 'string',
          example: 'skillResponse',
        },
      });
      return;
    }

    try {
      // Generate node ID if not provided
      const nodeId = options.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Parse position
      let position = { x: 0, y: 0 };
      if (options.position) {
        const parts = options.position.split(',').map((p: string) => Number.parseFloat(p.trim()));
        if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
          position = { x: parts[0], y: parts[1] };
        }
      }

      // Build node metadata
      const metadata: Record<string, unknown> = {};
      if (options.query) {
        metadata.query = options.query;
      }
      if (options.title) {
        metadata.title = options.title;
      }
      if (options.toolsetKeys) {
        metadata.toolsetKeys = options.toolsetKeys.split(',').map((k: string) => k.trim());
      }

      // Build node
      const node: CanvasNode = {
        id: nodeId,
        type: options.type,
        position,
        data: {
          metadata,
        },
      };

      // Build operations
      const operations: (AddNodeOperation | AddEdgeOperation)[] = [
        {
          type: 'add_node',
          node,
        },
      ];

      // Add edges if requested
      if (options.connectFrom) {
        operations.push({
          type: 'add_edge',
          edge: {
            id: `edge-${options.connectFrom}-${nodeId}`,
            source: options.connectFrom,
            target: nodeId,
          },
        });
      }
      if (options.connectTo) {
        operations.push({
          type: 'add_edge',
          edge: {
            id: `edge-${nodeId}-${options.connectTo}`,
            source: nodeId,
            target: options.connectTo,
          },
        });
      }

      // Build request
      const body: UpdateWorkflowRequest = { operations };

      // Build query params
      const queryParams: string[] = [];
      if (options.resolveToolsetKeys) queryParams.push('resolveToolsetKeys=true');
      if (options.autoLayout) queryParams.push('autoLayout=true');
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

      await apiRequest(`/v1/cli/workflow/${workflowId}${queryString}`, {
        method: 'PATCH',
        body,
      });

      ok('workflow.node.add', {
        message: 'Node added successfully',
        workflowId,
        nodeId,
        type: options.type,
        position,
        ...(options.query && { query: options.query }),
        ...(options.toolsetKeys && {
          toolsetKeys: options.toolsetKeys.split(',').map((k: string) => k.trim()),
        }),
        ...(options.connectFrom && { connectedFrom: options.connectFrom }),
        ...(options.connectTo && { connectedTo: options.connectTo }),
        nextSteps: [
          `View node: \`refly workflow node get ${workflowId} ${nodeId}\``,
          `List all nodes: \`refly workflow node list ${workflowId}\``,
        ],
      });
    } catch (error) {
      if (error instanceof CLIError) {
        // Replace placeholders with actual values in hint
        const hint = error.hint?.replace(/<workflowId>/g, workflowId);
        fail(error.code, error.message, {
          details: error.details,
          hint,
          suggestedFix: error.suggestedFix,
        });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to add node',
      );
    }
  });
