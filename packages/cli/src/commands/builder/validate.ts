/**
 * refly builder validate - Validate the workflow draft
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { getCurrentSession } from '../../builder/store.js';
import { validateDraft } from '../../builder/validate.js';
import { generateGraph } from '../../builder/graph.js';

export const builderValidateCommand = new Command('validate')
  .description('Validate the workflow draft')
  .action(async () => {
    try {
      const session = getCurrentSession();

      if (!session) {
        fail(ErrorCodes.BUILDER_NOT_STARTED, 'No active builder session', {
          hint: 'refly builder start --name "your-workflow"',
        });
      }

      // Validate
      const result = validateDraft(session);
      const graph = generateGraph(session);

      if (!result.ok) {
        fail(ErrorCodes.VALIDATION_ERROR, 'Workflow validation failed', {
          details: {
            errors: result.errors,
            graph: graph.stats,
          },
          hint: 'Fix the errors and run validate again',
        });
      }

      ok('builder.validate', {
        message: 'Workflow validation passed',
        state: session.state,
        graph: graph.stats,
        nextStep: 'Run `refly builder commit` to create the workflow',
      });
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to validate',
      );
    }
  });
