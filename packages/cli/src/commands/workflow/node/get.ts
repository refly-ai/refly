/**
 * refly workflow node get - Get single node information from a workflow
 *
 * Supports both workflowId (c-xxx) and runId (we-xxx).
 * - workflowId: gets node definition from workflow
 * - runId: gets node definition from the workflow associated with the run
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../../utils/output.js';
import { apiRequest } from '../../../api/client.js';
import { CLIError } from '../../../utils/errors.js';
import { detectIdType } from '../utils.js';

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

export const nodeGetCommand = new Command('get')
  .description('Get single node information from a workflow')
  .argument('<id>', 'Workflow ID (c-xxx) or Run ID (we-xxx)')
  .argument('<nodeId>', 'Node ID')
  .option('--include-connections', 'Include incoming and outgoing connections')
  .action(async (id, nodeId, options) => {
    try {
      // Auto-detect ID type
      const idType = detectIdType(id);

      // For runId, we need to first get the workflowId from the run
      let workflowId = id;
      if (idType === 'run') {
        // Get run info to extract workflowId
        const runInfo = await apiRequest<{ workflowId: string }>(`/v1/cli/workflow/run/${id}`);
        workflowId = runInfo.workflowId;
      }

      const result = await apiRequest<WorkflowData>(`/v1/cli/workflow/${workflowId}`);

      // Find the specific node
      const node = result.nodes.find((n) => n.id === nodeId);

      if (!node) {
        fail(ErrorCodes.NODE_NOT_FOUND, `Node ${nodeId} not found in workflow ${workflowId}`, {
          hint: `Use 'refly workflow node list ${id}' to list all nodes`,
        });
      }

      // Build output
      const output: Record<string, unknown> = {
        workflowId: result.workflowId,
        workflowName: result.name,
        idType,
        ...(idType === 'run' ? { runId: id } : {}),
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

      ok('workflow.node.get', output);
    } catch (error) {
      if (error instanceof CLIError) {
        // Replace placeholders with actual values in hint
        const hint = error.hint
          ?.replace(/<workflowId>/g, id)
          .replace(/<id>/g, id)
          .replace(/<nodeId>/g, nodeId);
        fail(error.code, error.message, {
          details: error.details,
          hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get node information',
      );
    }
  });
