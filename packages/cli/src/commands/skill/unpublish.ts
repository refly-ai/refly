/**
 * refly skill unpublish - Unpublish a skill package
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { parseReflySkillMd } from '../../skill/symlink.js';
import { getReflyDomainSkillDir, getReflySkillsDir } from '../../config/paths.js';

export const skillUnpublishCommand = new Command('unpublish')
  .description('Unpublish a skill package to make it private')
  .option('--id <skillId>', 'Skill ID (skp-xxx)')
  .option('--name <name>', 'Local skill name (directory in ~/.refly/skills/)')
  .action(async (options) => {
    try {
      const skillsDir = getReflySkillsDir();

      // Validate: at least one of --id or --name must be provided
      if (!options.id && !options.name) {
        fail(ErrorCodes.INVALID_INPUT, 'Missing required option: --id or --name', {
          hint: `Usage:\n  refly skill unpublish --name <name>\n  refly skill unpublish --id <skillId>\n\nTo find your skill name:\n  refly skill list\n  ls ${skillsDir}/`,
        });
        return;
      }

      let skillId: string;
      let name: string | undefined;

      // If --name is provided, read skillId from local SKILL.md
      if (options.name) {
        name = options.name;
        if (!name) {
          fail(ErrorCodes.INVALID_INPUT, 'Skill name cannot be empty', {
            hint: `Usage:\n  refly skill unpublish --name <name>\n  refly skill unpublish --id <skillId>\n\nTo find your skill name:\n  refly skill list\n  ls ${skillsDir}/`,
          });
          return;
        }
        const skillDir = getReflyDomainSkillDir(name);
        const skillMdPath = path.join(skillDir, 'SKILL.md');

        if (!fs.existsSync(skillMdPath)) {
          fail(ErrorCodes.NOT_FOUND, `SKILL.md not found at ${skillMdPath}`, {
            hint: `Make sure the skill '${name}' exists in ${skillsDir}/\n\nTo see installed skills: refly skill list`,
          });
          return;
        }

        const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
        try {
          const { meta } = parseReflySkillMd(skillContent);
          skillId = options.id || meta.skillId; // --id can override
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
        skillId = options.id;
      }

      await apiRequest(`/v1/skill-packages/${skillId}/unpublish`, {
        method: 'POST',
      });

      ok('skill.unpublish', {
        name,
        skillId,
        status: 'draft',
        isPublic: false,
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
        error instanceof Error ? error.message : 'Failed to unpublish skill package',
      );
    }
  });
