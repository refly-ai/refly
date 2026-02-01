/**
 * refly skill get - Get skill package details
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface SkillPackageDetail {
  skillId: string;
  name: string;
  version: string;
  description?: string;
  uid: string;
  triggers: string[];
  tags: string[];
  status: string;
  isPublic: boolean;
  downloadCount: number;
  shareId?: string;
  createdAt: string;
  updatedAt: string;
  workflows?: Array<{
    skillWorkflowId: string;
    name: string;
    description?: string;
    isEntry: boolean;
  }>;
}

export const skillGetCommand = new Command('get')
  .description('Get skill package details')
  .argument('<skillId>', 'Skill package ID')
  .option('--include-workflows', 'Include workflow details')
  .option('--share-id <shareId>', 'Share ID for accessing private skills')
  .action(async (skillId, options) => {
    try {
      const params = new URLSearchParams();
      if (options.includeWorkflows) params.set('includeWorkflows', 'true');
      if (options.shareId) params.set('shareId', options.shareId);

      const queryString = params.toString();
      const url = queryString
        ? `/v1/skill-packages/${skillId}?${queryString}`
        : `/v1/skill-packages/${skillId}`;

      const result = await apiRequest<SkillPackageDetail>(url);

      ok('skill.get', {
        skill: {
          skillId: result.skillId,
          name: result.name,
          version: result.version,
          description: result.description,
          triggers: result.triggers,
          tags: result.tags,
          status: result.status,
          isPublic: result.isPublic,
          downloadCount: result.downloadCount,
          shareId: result.shareId,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          workflows: result.workflows,
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
        error instanceof Error ? error.message : 'Failed to get skill package',
      );
    }
  });
