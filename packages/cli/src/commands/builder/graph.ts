/**
 * refly builder graph - Show DAG structure
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { getCurrentSession } from '../../builder/store.js';
import { generateGraph, generateAsciiGraph } from '../../builder/graph.js';

export const builderGraphCommand = new Command('graph')
  .description('Show workflow DAG structure')
  .option('--ascii', 'Output ASCII representation')
  .action(async (options) => {
    try {
      const session = getCurrentSession();

      if (!session) {
        fail(ErrorCodes.BUILDER_NOT_STARTED, 'No active builder session', {
          hint: 'refly builder start --name "your-workflow"',
        });
      }

      const graph = generateGraph(session);

      if (options.ascii) {
        // ASCII mode - still JSON but include ASCII representation
        const ascii = generateAsciiGraph(session);
        ok('builder.graph', {
          ascii,
          ...graph,
        });
      } else {
        ok('builder.graph', graph);
      }
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to generate graph',
      );
    }
  });
