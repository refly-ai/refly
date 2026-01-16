/**
 * refly builder add-node - Add a node to the draft
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { getCurrentSession } from '../../builder/store.js';
import { addNode } from '../../builder/ops.js';
import { generateGraph } from '../../builder/graph.js';
import { BuilderError } from '../../utils/errors.js';

export const builderAddNodeCommand = new Command('add-node')
  .description('Add a node to the workflow draft')
  .requiredOption('--node <json>', 'Node definition as JSON')
  .action(async (options) => {
    try {
      const session = getCurrentSession();

      if (!session) {
        fail(ErrorCodes.BUILDER_NOT_STARTED, 'No active builder session', {
          hint: 'refly builder start --name "your-workflow"',
        });
      }

      // Parse node JSON
      let nodeData: unknown;
      try {
        nodeData = JSON.parse(options.node);
      } catch {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --node', {
          hint: 'Ensure the node is valid JSON: --node \'{"id":"n1","type":"..."}\'',
        });
      }

      // Add node
      const { node, diff } = addNode(session, nodeData);
      const graph = generateGraph(session);

      ok('builder.add-node', {
        message: `Node "${node.id}" added`,
        node,
        diff,
        builder: {
          state: session.state,
          nodeCount: graph.stats.nodeCount,
        },
      });
    } catch (error) {
      if (error instanceof BuilderError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to add node',
      );
    }
  });
