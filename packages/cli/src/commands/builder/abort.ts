/**
 * refly builder abort - Abort the current session
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { getCurrentSession, setCurrent, deleteSession } from '../../builder/store.js';

export const builderAbortCommand = new Command('abort')
  .description('Abort the current builder session')
  .option('--keep', 'Keep session file (do not delete)')
  .action(async (options) => {
    try {
      const session = getCurrentSession();

      if (!session) {
        fail(ErrorCodes.BUILDER_NOT_STARTED, 'No active builder session', {
          hint: 'Nothing to abort',
        });
      }

      const sessionId = session.id;
      const workflowName = session.workflowDraft.name;

      // Clear current pointer
      setCurrent(null);

      // Optionally delete session file
      if (!options.keep) {
        deleteSession(sessionId);
      }

      ok('builder.abort', {
        message: 'Builder session aborted',
        sessionId,
        workflowName,
        deleted: !options.keep,
      });
    } catch (error) {
      fail(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Failed to abort');
    }
  });
