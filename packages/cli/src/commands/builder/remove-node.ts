/**
 * refly builder remove-node - Remove a node from the draft
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { getCurrentSession } from '../../builder/store.js';
import { removeNode } from '../../builder/ops.js';
import { generateGraph } from '../../builder/graph.js';
import { BuilderError } from '../../utils/errors.js';

export const builderRemoveNodeCommand = new Command('remove-node')
  .description('Remove a node from the workflow draft')
  .requiredOption('--id <nodeId>', 'Node ID to remove')
  .action(async (options) => {
    try {
      const session = getCurrentSession();

      if (!session) {
        fail(ErrorCodes.BUILDER_NOT_STARTED, 'No active builder session', {
          hint: 'refly builder start --name "your-workflow"',
        });
      }

      // Remove node
      const { removed, diff, cleanedDeps } = removeNode(session, options.id);
      const graph = generateGraph(session);

      ok('builder.remove-node', {
        message: `Node "${removed.id}" removed`,
        removed,
        diff,
        cleanedDeps:
          cleanedDeps.length > 0
            ? {
                message: 'Dependencies cleaned from nodes',
                nodes: cleanedDeps,
              }
            : null,
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
        error instanceof Error ? error.message : 'Failed to remove node',
      );
    }
  });
