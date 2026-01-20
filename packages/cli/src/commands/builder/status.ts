/**
 * refly builder status - Show current builder session status
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { getCurrentSession } from '../../builder/store.js';
import { generateGraph } from '../../builder/graph.js';

export const builderStatusCommand = new Command('status')
  .description('Show current builder session status')
  .action(async () => {
    try {
      const session = getCurrentSession();

      if (!session) {
        fail(ErrorCodes.BUILDER_NOT_STARTED, 'No active builder session', {
          hint: 'refly builder start --name "your-workflow"',
        });
      }

      const graph = generateGraph(session);

      ok('builder.status', {
        sessionId: session.id,
        state: session.state,
        workflowName: session.workflowDraft.name,
        description: session.workflowDraft.description ?? null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        nodes: graph.nodes,
        stats: graph.stats,
        validation: session.validation,
        commit: session.commit ?? null,
      });
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get status',
      );
    }
  });
