/**
 * refly workflow node list - List all nodes in a workflow
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../../utils/output.js';
import { apiRequest } from '../../../api/client.js';
import { CLIError } from '../../../utils/errors.js';

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

export const nodeListCommand = new Command('list')
  .description('List all nodes in a workflow')
  .argument('<workflowId>', 'Workflow ID')
  .option('--include-edges', 'Include edge/connection information')
  .option('--include-position', 'Include node position coordinates')
  .option('--include-metadata', 'Include full node metadata')
  .action(async (workflowId, options) => {
    try {
      const result = await apiRequest<WorkflowData>(`/v1/cli/workflow/${workflowId}`);

      // Format nodes for output
      const nodes = result.nodes.map((node) => {
        const output: Record<string, unknown> = {
          id: node.id,
          type: node.type,
          title: node.data?.title || node.data?.metadata?.title || undefined,
        };

        if (options.includePosition && node.position) {
          output.position = node.position;
        }

        if (options.includeMetadata && node.data?.metadata) {
          output.metadata = node.data.metadata;
        }

        return output;
      });

      const output: Record<string, unknown> = {
        workflowId: result.workflowId,
        workflowName: result.name,
        nodeCount: nodes.length,
        nodes,
      };

      if (options.includeEdges && result.edges?.length) {
        output.edges = result.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        }));
        output.edgeCount = result.edges.length;
      }

      ok('workflow.node.list', output);
    } catch (error) {
      if (error instanceof CLIError) {
        // Replace placeholders with actual values in hint
        const hint = error.hint?.replace(/<workflowId>/g, workflowId);
        fail(error.code, error.message, {
          details: error.details,
          hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get workflow nodes',
      );
    }
  });
