/**
 * refly builder update-node - Update an existing node
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { getCurrentSession } from '../../builder/store.js';
import { updateNode } from '../../builder/ops.js';
import { generateGraph } from '../../builder/graph.js';
import { BuilderError } from '../../utils/errors.js';

export const builderUpdateNodeCommand = new Command('update-node')
  .description('Update an existing node in the workflow draft')
  .requiredOption('--id <nodeId>', 'Node ID to update')
  .requiredOption('--patch <json>', 'Patch to apply as JSON')
  .action(async (options) => {
    try {
      const session = getCurrentSession();

      if (!session) {
        fail(ErrorCodes.BUILDER_NOT_STARTED, 'No active builder session', {
          hint: 'refly builder start --name "your-workflow"',
        });
      }

      // Parse patch JSON
      let patch: Record<string, unknown>;
      try {
        patch = JSON.parse(options.patch);
      } catch {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --patch', {
          hint: 'Ensure the patch is valid JSON',
        });
      }

      // Update node
      const { node, diff } = updateNode(session, options.id, patch);
      const graph = generateGraph(session);

      ok('builder.update-node', {
        message: `Node "${node.id}" updated`,
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
        error instanceof Error ? error.message : 'Failed to update node',
      );
    }
  });
