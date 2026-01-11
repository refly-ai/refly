/**
 * refly builder start - Start a new builder session
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { createSession, saveSession, setCurrent, getCurrentSession } from '../../builder/store.js';
import { BuilderError } from '../../utils/errors.js';

export const builderStartCommand = new Command('start')
  .description('Start a new builder session')
  .requiredOption('--name <name>', 'Workflow name')
  .option('--description <description>', 'Workflow description')
  .option('--force', 'Abort existing session and start new')
  .action(async (options) => {
    try {
      const { name, description, force } = options;

      // Check for existing session
      const existing = getCurrentSession();
      if (existing && existing.state !== 'COMMITTED' && existing.state !== 'ABORTED') {
        if (!force) {
          throw new BuilderError(
            ErrorCodes.BUILDER_ALREADY_STARTED,
            `A builder session is already active: ${existing.workflowDraft.name}`,
            { sessionId: existing.id, state: existing.state },
            'Use --force to abort and start new, or run `refly builder abort`',
          );
        }
        // Force: abort existing
        setCurrent(null);
      }

      // Create new session
      const session = createSession(name, description);
      saveSession(session);
      setCurrent(session.id);

      ok('builder.start', {
        message: 'Builder session started',
        sessionId: session.id,
        workflowName: name,
        state: session.state,
        nextStep: 'Add nodes with `refly builder add-node --node \'{"id":"n1","type":"..."}\'`',
      });
    } catch (error) {
      if (error instanceof BuilderError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to start builder',
      );
    }
  });
