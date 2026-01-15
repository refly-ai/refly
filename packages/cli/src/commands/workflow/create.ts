/**
 * refly workflow create - Create a workflow directly
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

export const workflowCreateCommand = new Command('create')
  .description('Create a workflow from a spec')
  .requiredOption('--name <name>', 'Workflow name')
  .requiredOption('--spec <json>', 'Workflow spec as JSON')
  .option('--description <description>', 'Workflow description')
  .action(async (options) => {
    try {
      // Parse spec JSON
      let spec: unknown;
      try {
        spec = JSON.parse(options.spec);
      } catch {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --spec', {
          hint: 'Ensure the spec is valid JSON',
        });
      }

      // Call API
      const result = await apiRequest<{
        workflowId: string;
        name: string;
        createdAt: string;
      }>('/v1/cli/workflow', {
        method: 'POST',
        body: {
          name: options.name,
          description: options.description,
          spec,
        },
      });

      ok('workflow.create', {
        message: 'Workflow created successfully',
        workflowId: result.workflowId,
        name: result.name,
        createdAt: result.createdAt,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to create workflow',
      );
    }
  });
