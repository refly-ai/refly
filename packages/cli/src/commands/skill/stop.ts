/**
 * refly skill stop - Stop running skill executions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { parseReflySkillMd } from '../../skill/symlink.js';
import { getReflyDomainSkillDir, getReflySkillsDir } from '../../config/paths.js';

interface StopExecutionResult {
  message: string;
  installationId: string;
  stoppedExecutions: Array<{
    executionId: string;
    workflowsAborted: number;
  }>;
}

/**
 * Get all local skill names from ~/.refly/skills/
 */
function getLocalSkillNames(): string[] {
  const skillsDir = getReflySkillsDir();
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

export const skillStopCommand = new Command('stop')
  .description('Stop running skill executions')
  .requiredOption('--name <name>', 'Local skill name (directory in ~/.refly/skills/)')
  .action(async (options) => {
    try {
      const skillsDir = getReflySkillsDir();
      const name = options.name;
      const skillDir = getReflyDomainSkillDir(name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      // Check if skill exists locally
      if (!fs.existsSync(skillMdPath)) {
        const availableSkills = getLocalSkillNames();
        const skillList =
          availableSkills.length > 0 ? availableSkills.join(', ') : '(no skills installed)';

        fail(ErrorCodes.NOT_FOUND, `Skill "${name}" not found`, {
          hint: `Available skills: ${skillList}\n\nSkills directory: ${skillsDir}`,
        });
      }

      // Read installationId from SKILL.md
      const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
      let installationId!: string;

      try {
        const { meta } = parseReflySkillMd(skillContent);

        if (!meta.installationId) {
          fail(ErrorCodes.INVALID_INPUT, `Skill "${name}" does not have an installationId`, {
            hint: `This skill may have been created locally but not installed.\n\nTo install: refly skill install ${meta.skillId}`,
          });
        }

        installationId = meta.installationId;
      } catch (parseError) {
        fail(
          ErrorCodes.INVALID_INPUT,
          `Failed to parse SKILL.md: ${(parseError as Error).message}`,
          {
            hint: 'Make sure SKILL.md has valid frontmatter with required fields',
          },
        );
      }

      // Call API to stop running executions
      const result = await apiRequest<StopExecutionResult>(
        `/v1/skill-installations/${installationId}/stop`,
        {
          method: 'POST',
        },
      );

      ok('skill.stop', {
        name,
        installationId,
        message: result.message,
        stoppedExecutions: result.stoppedExecutions,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        // Check if it's a "no running executions" error
        if (error.code === 'NOT_FOUND') {
          fail(ErrorCodes.NOT_FOUND, `No running executions for skill "${options.name}"`, {
            hint: 'The skill is not currently running',
          });
        }

        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to stop skill',
      );
    }
  });
