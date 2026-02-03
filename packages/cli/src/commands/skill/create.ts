/**
 * refly skill create - Create a new skill package
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { getWebUrl } from '../../config/config.js';
import { CLIError } from '../../utils/errors.js';
import {
  createReflySkillWithSymlink,
  generateReflySkillMd,
  isSkillSymlinkValid,
} from '../../skill/symlink.js';
import { getReflyDomainSkillDir } from '../../config/paths.js';
import { logger } from '../../utils/logger.js';

interface CreateSkillPayload {
  skillId: string;
  name: string;
  status: string;
  createdAt: string;
  workflowId?: string;
  workflowIds?: string[];
  workflows?: Array<{
    workflowId: string;
    name?: string;
    description?: string;
  }>;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  /** Auto-created installation ID (creator is auto-installed) */
  installationId?: string;
}

interface CreateSkillResponse {
  ok: boolean;
  type: string;
  version: string;
  payload: CreateSkillPayload;
}

export const skillCreateCommand = new Command('create')
  .description('Create a new skill package with workflow')
  .requiredOption('--name <name>', 'Skill package name')
  .option('--skill-version <version>', 'Semantic version', '1.0.0')
  .option('--description <description>', 'Skill description')
  .option('--triggers <triggers>', 'Trigger phrases (comma-separated)')
  .option('--tags <tags>', 'Category tags (comma-separated)')
  .option('--workflow <workflowId>', 'Bind existing workflow ID')
  .option('--workflow-ids <workflowIds>', 'Bind multiple workflow IDs (comma-separated)')
  .option('--workflow-spec <json>', 'Workflow spec JSON (structured)')
  .option('--workflow-query <query>', 'Natural language workflow description (be specific)')
  .option('--verbose', 'Include workflow details in output')
  .action(async (options) => {
    try {
      // Validate: must provide at least one workflow option
      const hasWorkflowOption =
        options.workflow || options.workflowIds || options.workflowSpec || options.workflowQuery;

      if (!hasWorkflowOption) {
        ok('skill.create.needs_workflow', {
          status: 'pending',
          name: options.name,
          message: 'Skill requires a workflow definition. Please provide more details.',
          questions: [
            'What should this skill do? Please describe the workflow functionality in detail.',
            'Or do you have an existing workflow ID to bind to this skill?',
          ],
          options: {
            bindExisting: '--workflow <workflowId>',
            generateNew: '--workflow-query "<detailed description>"',
          },
          example:
            'refly skill create --name "web-search" --workflow-query "Search the web for a given topic using Exa, then summarize the top 5 results into a markdown document"',
        });
        return;
      }

      const input: Record<string, unknown> = {
        name: options.name,
        version: options.skillVersion,
      };

      if (options.description) input.description = options.description;
      if (options.triggers)
        input.triggers = options.triggers.split(',').map((t: string) => t.trim());
      if (options.tags) input.tags = options.tags.split(',').map((t: string) => t.trim());
      if (options.workflow) input.workflowId = options.workflow;
      if (options.workflowIds) {
        input.workflowIds = options.workflowIds
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
      }
      if (options.workflowSpec) {
        input.workflowSpec = JSON.parse(options.workflowSpec);
      }
      if (options.workflowQuery) input.workflowQuery = options.workflowQuery;

      const response = await apiRequest<CreateSkillResponse>('/v1/cli/skill-packages', {
        method: 'POST',
        body: input,
      });

      // Extract payload from wrapped CLI response
      const result = response.payload;

      // Create local domain skill with symlink if workflow was created
      let localPath: string | undefined;
      let _symlinkPath: string | undefined;

      if (result.workflowId) {
        try {
          // Normalize skill name for local file system (lowercase, hyphens)
          const localName = options.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          // Check if local skill already exists
          const skillDir = getReflyDomainSkillDir(localName);
          const symlinkStatus = isSkillSymlinkValid(localName);

          if (fs.existsSync(skillDir) || symlinkStatus.exists) {
            logger.debug(`Local skill '${localName}' already exists, skipping sync`);
          } else {
            // Generate SKILL.md content
            const skillMdContent = generateReflySkillMd({
              name: localName,
              displayName: options.name,
              description: (input.description as string) || `Skill: ${options.name}`,
              skillId: result.skillId,
              workflowId: result.workflowId,
              triggers: input.triggers as string[] | undefined,
              tags: input.tags as string[] | undefined,
              version: options.skillVersion,
              inputSchema: result.inputSchema,
              outputSchema: result.outputSchema,
            });

            // Create skill directory and symlink
            const symlinkResult = createReflySkillWithSymlink(localName, skillMdContent);

            if (symlinkResult.success) {
              localPath = symlinkResult.reflyPath;
              _symlinkPath = symlinkResult.claudePath;
              logger.info(`Created local domain skill: ${localName}`);
            } else {
              logger.warn(`Failed to create local skill: ${symlinkResult.error}`);
            }
          }
        } catch (syncError) {
          // Log but don't fail - cloud skill was created successfully
          logger.warn(`Failed to sync to local: ${(syncError as Error).message}`);
        }
      }

      const webUrl = getWebUrl();
      const payload: Record<string, unknown> = {
        skillId: result.skillId,
        installationId: result.installationId,
        name: result.name,
        status: result.status,
        createdAt: result.createdAt,
        workflowId: result.workflowId,
        workflowUrl: result.workflowId ? `${webUrl}/workflow/${result.workflowId}` : undefined,
        localPath: localPath,
      };

      if (options.verbose) {
        payload.workflowIds = result.workflowIds;
        payload.workflows = result.workflows;
      }

      ok('skill.create', payload);
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
        error instanceof Error ? error.message : 'Failed to create skill package',
      );
    }
  });
