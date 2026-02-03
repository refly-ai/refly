/**
 * refly skill uninstall - Uninstall a skill
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { removeMultiPlatformSkill, parseReflySkillMd } from '../../skill/symlink.js';
import { getReflyDomainSkillDir, getReflySkillsDir } from '../../config/paths.js';
import { logger } from '../../utils/logger.js';

export const skillUninstallCommand = new Command('uninstall')
  .description('Uninstall a skill')
  .option('--id <installationId>', 'Installation ID (skpi-xxx)')
  .option('--name <name>', 'Local skill name (directory in ~/.refly/skills/)')
  .option('--force', 'Skip confirmation')
  .option('--keep-local', 'Keep local skill files and symlink')
  .action(async (options) => {
    try {
      const skillsDir = getReflySkillsDir();

      // Validate: at least one of --id or --name must be provided
      if (!options.id && !options.name) {
        fail(ErrorCodes.INVALID_INPUT, 'Missing required option: --id or --name', {
          hint: `Usage:\n  refly skill uninstall --name <name>\n  refly skill uninstall --id <installationId>\n\nTo find your skill name:\n  refly skill list\n  ls ${skillsDir}/`,
        });
        return;
      }

      let installationId: string | undefined;
      let skillId: string | undefined;
      let name: string | undefined;

      // If --name is provided, read installationId from local SKILL.md
      if (options.name) {
        name = options.name;
        if (!name) {
          fail(ErrorCodes.INVALID_INPUT, 'Skill name cannot be empty', {
            hint: `Usage:\n  refly skill uninstall --name <name>\n  refly skill uninstall --id <installationId>\n\nTo find your skill name:\n  refly skill list\n  ls ${skillsDir}/`,
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
          skillId = meta.skillId;
          installationId = options.id || meta.installationId; // --id can override
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

      // Delete from API if installationId exists
      if (installationId) {
        try {
          await apiRequest(`/v1/skill-installations/${installationId}`, {
            method: 'DELETE',
          });
        } catch (error) {
          // If installation not found on server, continue with local cleanup
          if (error instanceof CLIError && error.code === 'NOT_FOUND') {
            logger.debug('Installation not found on server, proceeding with local cleanup');
          } else {
            throw error;
          }
        }
      }

      // Clean up local skill from all platforms (only if --name was provided)
      let directoryRemoved = false;
      const platformResults: Array<{ agent: string; success: boolean }> = [];

      if (name && !options.keepLocal) {
        try {
          const cleanup = await removeMultiPlatformSkill(name);
          directoryRemoved = cleanup.directoryRemoved;

          for (const [agentName, result] of cleanup.platformResults.results) {
            platformResults.push({
              agent: agentName,
              success: result.success,
            });
          }

          logger.info(
            `Cleaned up local skill: ${name}, removed from ${cleanup.platformResults.successCount} platform(s)`,
          );
        } catch (err) {
          // Log but don't fail - API uninstall was successful
          logger.warn(`Failed to clean up local skill: ${(err as Error).message}`);
        }
      }

      ok('skill.uninstall', {
        name,
        skillId,
        installationId,
        uninstalled: true,
        localCleanup: {
          directoryRemoved,
          platforms: platformResults.length > 0 ? platformResults : undefined,
        },
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
        error instanceof Error ? error.message : 'Failed to uninstall skill',
      );
    }
  });
