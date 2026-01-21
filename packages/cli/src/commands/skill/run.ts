/**
 * refly skill run - Run an installed skill
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface SkillExecutionResult {
  executionId: string;
  installationId: string;
  status: string;
  workflowExecutions: Array<{
    skillWorkflowId: string;
    workflowId: string;
    status: string;
  }>;
  result?: unknown;
  error?: string;
}

export const skillRunCommand = new Command('run')
  .description('Run an installed skill')
  .argument('<installationId>', 'Installation ID')
  .option('--input <json>', 'Input JSON for the skill')
  .option('--workflow <skillWorkflowId>', 'Run specific workflow only')
  .option('--async', 'Run asynchronously')
  .action(async (installationId, options) => {
    try {
      // Parse and validate input JSON
      let input: Record<string, unknown> = {};
      if (options.input) {
        try {
          input = JSON.parse(options.input);
          if (typeof input !== 'object' || input === null || Array.isArray(input)) {
            fail(ErrorCodes.INVALID_INPUT, 'Input must be a JSON object');
            return;
          }
        } catch {
          fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON input');
          return;
        }
      }

      const body: Record<string, unknown> = { input };
      if (options.workflow) body.workflowId = options.workflow;
      if (options.async) body.async = true;

      const result = await apiRequest<SkillExecutionResult>(
        `/v1/skill-installations/${installationId}/run`,
        {
          method: 'POST',
          body,
        },
      );

      ok('skill.run', {
        executionId: result.executionId,
        installationId: result.installationId,
        status: result.status,
        workflowExecutions: result.workflowExecutions,
        result: result.result,
        error: result.error,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to run skill',
      );
    }
  });
