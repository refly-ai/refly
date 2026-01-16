/**
 * refly builder connect - Connect two nodes
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { getCurrentSession } from '../../builder/store.js';
import { connectNodes } from '../../builder/ops.js';
import { generateGraph } from '../../builder/graph.js';
import { BuilderError } from '../../utils/errors.js';

export const builderConnectCommand = new Command('connect')
  .description('Connect two nodes (add dependency)')
  .requiredOption('--from <nodeId>', 'Source node ID')
  .requiredOption('--to <nodeId>', 'Target node ID (will depend on source)')
  .action(async (options) => {
    try {
      const session = getCurrentSession();

      if (!session) {
        fail(ErrorCodes.BUILDER_NOT_STARTED, 'No active builder session', {
          hint: 'refly builder start --name "your-workflow"',
        });
      }

      // Connect nodes
      const { diff } = connectNodes(session, options.from, options.to);
      const graph = generateGraph(session);

      ok('builder.connect', {
        message: `Connected "${options.from}" -> "${options.to}"`,
        diff,
        builder: {
          state: session.state,
          edgeCount: graph.stats.edgeCount,
        },
      });
    } catch (error) {
      if (error instanceof BuilderError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to connect nodes',
      );
    }
  });
