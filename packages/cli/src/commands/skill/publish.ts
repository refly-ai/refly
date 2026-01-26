/**
 * refly skill publish - Publish a skill package using local SKILL.md
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { parseReflySkillMd } from '../../skill/symlink.js';
import { getReflyDomainSkillDir, getReflySkillsDir } from '../../config/paths.js';

interface SkillPackageResponse {
  skillId: string;
  name: string;
  version: string;
  description?: string;
  status: string;
  isPublic: boolean;
  shareId?: string;
  triggers: string[];
  tags: string[];
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  githubPrUrl?: string;
  githubPrNumber?: number;
}

export const skillPublishCommand = new Command('publish')
  .description('Publish a skill package using local SKILL.md')
  .option('--id <skillId>', 'Skill ID (skp-xxx) - overrides ID from SKILL.md')
  .option('--name <name>', 'Local skill name (directory in ~/.refly/skills/)')
  .action(async (options) => {
    try {
      const skillsDir = getReflySkillsDir();

      // Validate: --name is required for publish (we need the SKILL.md content)
      if (!options.name) {
        fail(ErrorCodes.INVALID_INPUT, 'Missing required option: --name', {
          hint: `The publish command requires --name to locate the local SKILL.md.\n\nUsage:\n  refly skill publish --name <name>\n  refly skill publish --name <name> --id <skillId>  # override skillId\n\nTo find your skill name:\n  refly skill list\n  ls ${skillsDir}/`,
        });
        return;
      }

      const name = options.name;

      // 1. Build path to local SKILL.md
      const skillDir = getReflyDomainSkillDir(name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      // 2. Check if SKILL.md exists
      if (!fs.existsSync(skillMdPath)) {
        fail(ErrorCodes.NOT_FOUND, `SKILL.md not found at ${skillMdPath}`, {
          hint: `Make sure the skill '${name}' exists in ${skillsDir}/\n\nTo see installed skills: refly skill list\nTo create a new skill: refly skill create --name "${name}" --workflow-query "..."`,
        });
        return;
      }

      // 3. Read and parse SKILL.md
      const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
      let parsedSkill: ReturnType<typeof parseReflySkillMd>;
      try {
        parsedSkill = parseReflySkillMd(skillContent);
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

      const { meta } = parsedSkill;

      // Use --id if provided, otherwise use skillId from SKILL.md
      const skillId = options.id || meta.skillId;

      // 4. Call API to publish with skillContent
      const result = await apiRequest<SkillPackageResponse>(
        `/v1/skill-packages/${skillId}/publish`,
        {
          method: 'POST',
          body: {
            skillContent,
          },
        },
      );

      ok('skill.publish', {
        skillId: result.skillId,
        name: result.name,
        version: result.version,
        status: result.status,
        isPublic: result.isPublic,
        shareId: result.shareId,
        shareUrl: result.shareId ? `https://refly.ai/skill/${result.shareId}` : undefined,
        githubPrUrl: result.githubPrUrl,
        githubPrNumber: result.githubPrNumber,
        localPath: skillMdPath,
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
        error instanceof Error ? error.message : 'Failed to publish skill package',
      );
    }
  });
