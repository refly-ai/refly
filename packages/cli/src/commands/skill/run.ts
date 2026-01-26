/**
 * refly skill run - Run an installed skill
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest, apiGetWorkflow } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { parseReflySkillMd } from '../../skill/symlink.js';
import { getReflyDomainSkillDir, getReflySkillsDir } from '../../config/paths.js';
import { checkRequiredVariables, buildMissingVariablesError } from '../../utils/variable-check.js';

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
  .option('--id <installationId>', 'Installation ID (skpi-xxx)')
  .option('--name <name>', 'Local skill name (directory in ~/.refly/skills/)')
  .option('--input <json>', 'Input JSON for the skill')
  .option('--workflow <skillWorkflowId>', 'Run specific workflow only')
  .option('--async', 'Run asynchronously')
  .option('--no-prompt', 'Disable interactive prompts (fail if required variables are missing)')
  .action(async (options) => {
    try {
      const skillsDir = getReflySkillsDir();

      // Validate: at least one of --id or --name must be provided
      if (!options.id && !options.name) {
        fail(ErrorCodes.INVALID_INPUT, 'Missing required option: --id or --name', {
          hint: `Usage:\n  refly skill run --name <name>\n  refly skill run --id <installationId>\n\nTo find your skill name:\n  refly skill list\n  ls ${skillsDir}/`,
        });
        return;
      }

      let installationId: string;
      let name: string | undefined;
      let skillId: string | undefined;
      let workflowId: string | undefined;

      // If --name is provided, read installationId from local SKILL.md
      if (options.name) {
        name = options.name;
        const skillDir = getReflyDomainSkillDir(options.name);
        const skillMdPath = path.join(skillDir, 'SKILL.md');

        if (!fs.existsSync(skillMdPath)) {
          fail(ErrorCodes.NOT_FOUND, `SKILL.md not found at ${skillMdPath}`, {
            hint: `Make sure the skill '${name}' exists in ${skillsDir}/\n\nTo see installed skills: refly skill list\nTo install a skill: refly skill install <skillId>`,
          });
          return;
        }

        const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
        try {
          const { meta } = parseReflySkillMd(skillContent);
          skillId = meta.skillId;
          workflowId = meta.workflowId;

          if (options.id) {
            // --id can override
            installationId = options.id;
          } else if (meta.installationId) {
            installationId = meta.installationId;
          } else {
            fail(ErrorCodes.INVALID_INPUT, `Skill '${name}' does not have an installationId`, {
              hint: `This skill may have been created locally but not installed.\n\nTo install: refly skill install ${meta.skillId}`,
            });
            return;
          }
        } catch (parseError) {
          fail(
            ErrorCodes.INVALID_INPUT,
            `Failed to parse SKILL.md: ${(parseError as Error).message}`,
            {
              hint: 'Make sure SKILL.md has valid frontmatter with required fields: name, description, skillId, workflowId',
            },
          );
          return;
        }
      } else {
        // --id only mode
        installationId = options.id;
      }

      // Parse and validate input JSON
      let input: Record<string, unknown> = {};
      if (options.input) {
        try {
          input = JSON.parse(options.input);
          if (typeof input !== 'object' || input === null || Array.isArray(input)) {
            fail(ErrorCodes.INVALID_INPUT, 'Input must be a JSON object', {
              hint: 'Use format: \'{"varName": "value", "fileVar": "df-fileId"}\'',
              suggestedFix: {
                field: '--input',
                format: 'json-object',
                example: '{"varName": "value", "fileVar": "df-fileId"}',
              },
            });
            return;
          }
        } catch {
          fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON input', {
            hint: 'Ensure the input is valid JSON, e.g., \'{"varName": "value"}\'',
            suggestedFix: {
              field: '--input',
              format: 'json-object',
              example: '{"varName": "value"}',
            },
          });
          return;
        }
      }

      // Check required variables when noPrompt is true (for agent/script usage)
      // Uses the skill's primary workflow to get variable definitions
      if (options.noPrompt && workflowId) {
        try {
          const workflow = await apiGetWorkflow(workflowId);
          if (workflow?.variables) {
            const checkResult = checkRequiredVariables(workflow.variables, input);

            if (!checkResult.valid) {
              const errorPayload = buildMissingVariablesError(
                'skill',
                name || installationId,
                name,
                checkResult,
              );
              fail(ErrorCodes.MISSING_VARIABLES, errorPayload.message, {
                details: errorPayload.details,
                hint: errorPayload.hint,
                suggestedFix: errorPayload.suggestedFix,
                recoverable: errorPayload.recoverable,
              });
            }
          }
        } catch {
          // If we can't fetch workflow, continue and let backend validate
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
        name,
        skillId,
        executionId: result.executionId,
        installationId: result.installationId,
        status: result.status,
        workflowExecutions: result.workflowExecutions,
        result: result.result,
        error: result.error,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to run skill',
      );
    }
  });
