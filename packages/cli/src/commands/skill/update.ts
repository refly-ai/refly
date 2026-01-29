/**
 * refly skill update - Update skill installation from local SKILL.md
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { Command } from 'commander';

import { apiRequest } from '../../api/client.js';
import { getReflyDomainSkillDir, getReflySkillsDir } from '../../config/paths.js';
import { parseReflySkillMd } from '../../skill/symlink.js';
import { CLIError } from '../../utils/errors.js';
import { ok, fail, ErrorCodes } from '../../utils/output.js';

interface UpdateInstallationResponse {
  installationId: string;
  skillId: string;
  name?: string;
  description?: string;
  workflowId?: string;
  triggers?: string[];
  tags?: string[];
  version?: string;
  updatedAt: string;
}

const MIN_DESCRIPTION_WORDS = 20;

/**
 * Validate description meets minimum word count requirement for Claude Code discovery.
 * Returns error info if validation fails, null if valid.
 */
function validateDescription(
  description: string | undefined,
  skillName: string,
): { message: string; hint: string; example: string } | null {
  if (!description) {
    return {
      message: 'Skill description is required for Claude Code discovery',
      hint: `Add a description field with at least ${MIN_DESCRIPTION_WORDS} words to your SKILL.md`,
      example: generateDescriptionExample(skillName),
    };
  }

  const wordCount = description.trim().split(/\s+/).length;
  if (wordCount < MIN_DESCRIPTION_WORDS) {
    return {
      message: `Description too short (${wordCount} words). Minimum ${MIN_DESCRIPTION_WORDS} words required for Claude Code discovery`,
      hint: `Expand the description in your SKILL.md to at least ${MIN_DESCRIPTION_WORDS} words`,
      example: generateDescriptionExample(skillName),
    };
  }

  return null;
}

/**
 * Generate an example description based on skill name.
 */
function generateDescriptionExample(skillName: string): string {
  const baseName = skillName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `${baseName} automation and processing. Use when Claude needs to: (1) [describe primary use case], (2) [describe secondary use case], or [general catch-all scenario].`;
}

export const skillUpdateCommand = new Command('update')
  .description('Update skill installation from local SKILL.md')
  .requiredOption('--name <name>', 'Local skill name (directory in ~/.refly/skills/)')
  .option('--id <installationId>', 'Override installation ID (default: from SKILL.md)')
  .option('--skip-description', 'Skip description validation')
  .action(async (options) => {
    try {
      const name = options.name as string;
      const skillDir = getReflyDomainSkillDir(name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      if (!fs.existsSync(skillMdPath)) {
        const skillsDir = getReflySkillsDir();
        fail(ErrorCodes.NOT_FOUND, `SKILL.md not found at ${skillMdPath}`, {
          hint: `Make sure the skill '${name}' exists in ${skillsDir}/\n\nTo see installed skills: refly skill list`,
        });
        return;
      }

      const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
      let meta: ReturnType<typeof parseReflySkillMd>['meta'];
      try {
        const parsed = parseReflySkillMd(skillContent);
        meta = parsed.meta;
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

      // Use installationId from --id flag or from SKILL.md
      const installationId = options.id || meta.installationId;
      if (!installationId) {
        fail(ErrorCodes.INVALID_INPUT, 'Installation ID not found', {
          hint: 'Provide --id <installationId> or ensure your SKILL.md contains the installationId field',
        });
        return;
      }

      // Validate description unless --skip-description is provided
      const skipDescription = options.skipDescription as boolean;
      if (!skipDescription) {
        const descriptionError = validateDescription(meta.description, name);
        if (descriptionError) {
          fail(ErrorCodes.VALIDATION_ERROR, descriptionError.message, {
            hint: descriptionError.hint,
            recoverable: true,
            suggestedFix: {
              field: 'description',
              format:
                '[What it does]. Use when [scenarios]: (1) [case1], (2) [case2], or [catch-all].',
              example: descriptionError.example,
            },
          });
          return;
        }
      }

      // Build update payload from meta - only include non-empty fields
      const updatePayload: Record<string, unknown> = {
        ...(meta.name && { name: meta.name }),
        ...(meta.description && { description: meta.description }),
        ...(meta.workflowId && { workflowId: meta.workflowId }),
        ...(meta.triggers?.length && { triggers: meta.triggers }),
        ...(meta.tags?.length && { tags: meta.tags }),
        ...(meta.version && { version: meta.version }),
      };

      if (Object.keys(updatePayload).length === 0) {
        fail(ErrorCodes.INVALID_INPUT, 'No updateable fields found in SKILL.md', {
          hint: 'Ensure SKILL.md contains fields like name, description, triggers, tags, or version',
        });
        return;
      }

      // Call PATCH /v1/skill-installations/{id}
      const response = await apiRequest<UpdateInstallationResponse>(
        `/v1/skill-installations/${installationId}`,
        {
          method: 'PATCH',
          body: updatePayload,
        },
      );

      ok('skill.update', {
        ...response,
        localName: name,
        updated: true,
        fields: Object.keys(updatePayload),
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
        error instanceof Error ? error.message : 'Failed to update skill installation',
      );
    }
  });
