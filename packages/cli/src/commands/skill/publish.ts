/**
 * refly skill publish - Publish a skill package
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

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
}

export const skillPublishCommand = new Command('publish')
  .description('Publish a skill package to make it publicly available')
  .argument('<skillId>', 'Skill package ID to publish')
  .action(async (skillId) => {
    try {
      const result = await apiRequest<SkillPackageResponse>(
        `/v1/skill-packages/${skillId}/publish`,
        {
          method: 'POST',
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
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to publish skill package',
      );
    }
  });
