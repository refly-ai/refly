/**
 * refly workflow layout - Auto-layout workflow nodes
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

export const workflowLayoutCommand = new Command('layout')
  .description('Auto-layout workflow nodes to prevent overlapping')
  .argument('<workflowId>', 'Workflow ID or URL')
  .option('--direction <dir>', 'Layout direction: LR (left-right) or TB (top-bottom)', 'LR')
  .action(async (workflowIdOrUrl, options) => {
    try {
      // Extract workflowId from URL if needed
      let workflowId = workflowIdOrUrl;
      if (workflowIdOrUrl.includes('/workflow/')) {
        const match = workflowIdOrUrl.match(/\/workflow\/(c-[a-z0-9]+)/);
        if (match) {
          workflowId = match[1];
        }
      }

      // Validate direction
      const direction = options.direction?.toUpperCase();
      if (direction && direction !== 'LR' && direction !== 'TB') {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid direction. Use LR or TB', {
          hint: 'LR = left-to-right, TB = top-to-bottom',
        });
      }

      // Build API endpoint
      let endpoint = `/v1/cli/workflow/${workflowId}/layout`;
      if (direction) {
        endpoint += `?direction=${direction}`;
      }

      await apiRequest<{ success: boolean }>(endpoint, {
        method: 'POST',
      });

      ok('workflow.layout', {
        message: 'Workflow layout updated successfully',
        workflowId,
        direction: direction || 'LR',
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to layout workflow',
      );
    }
  });
