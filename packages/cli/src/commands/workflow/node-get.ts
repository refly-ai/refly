/**
 * refly workflow node - Get single node information from a workflow
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface NodeData {
  id: string;
  type: string;
  data?: {
    title?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  position?: { x: number; y: number };
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface WorkflowData {
  workflowId: string;
  name: string;
  nodes: NodeData[];
  edges: EdgeData[];
}

export const workflowNodeGetCommand = new Command('node')
  .description('Get single node information from a workflow')
  .argument('<workflowId>', 'Workflow ID')
  .argument('<nodeId>', 'Node ID')
  .option('--include-connections', 'Include incoming and outgoing connections')
  .action(async (workflowId, nodeId, options) => {
    try {
      const result = await apiRequest<WorkflowData>(`/v1/cli/workflow/${workflowId}`);

      // Find the specific node
      const node = result.nodes.find((n) => n.id === nodeId);

      if (!node) {
        fail(ErrorCodes.NODE_NOT_FOUND, `Node ${nodeId} not found in workflow ${workflowId}`, {
          hint: `Use 'refly workflow nodes ${workflowId}' to list all nodes`,
        });
      }

      // Build output
      const output: Record<string, unknown> = {
        workflowId: result.workflowId,
        workflowName: result.name,
        node: {
          id: node.id,
          type: node.type,
          title: node.data?.title || node.data?.metadata?.title || undefined,
          position: node.position,
          metadata: node.data?.metadata || {},
          data: node.data,
        },
      };

      // Find connections if requested
      if (options.includeConnections && result.edges?.length) {
        const incoming = result.edges
          .filter((e) => e.target === nodeId)
          .map((e) => ({
            from: e.source,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          }));

        const outgoing = result.edges
          .filter((e) => e.source === nodeId)
          .map((e) => ({
            to: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          }));

        output.connections = {
          incoming,
          outgoing,
          incomingCount: incoming.length,
          outgoingCount: outgoing.length,
        };
      }

      ok('workflow.node', output);
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get node information',
      );
    }
  });
