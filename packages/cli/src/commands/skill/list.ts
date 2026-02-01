/**
 * refly skill list - List all skill packages
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface SkillPackageSummary {
  skillId: string;
  name: string;
  version: string;
  description?: string;
  status: string;
  isPublic: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export const skillListCommand = new Command('list')
  .description('List skill packages')
  .option('--status <status>', 'Filter by status (draft, published, deprecated)')
  .option('--mine', 'Show only my skill packages')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('--page <number>', 'Page number', '1')
  .option('--page-size <number>', 'Page size', '20')
  .action(async (options) => {
    try {
      const params = new URLSearchParams();
      if (options.status) params.set('status', options.status);
      if (options.mine) params.set('mine', 'true');
      if (options.tags) params.set('tags', options.tags);
      params.set('page', options.page);
      params.set('pageSize', options.pageSize);

      const result = await apiRequest<{
        items: SkillPackageSummary[];
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
      }>(`/v1/skill-packages?${params.toString()}`);

      ok('skill.list', {
        skills: result.items.map((s) => ({
          skillId: s.skillId,
          name: s.name,
          version: s.version,
          description: s.description,
          status: s.status,
          isPublic: s.isPublic,
          downloadCount: s.downloadCount,
          createdAt: s.createdAt,
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
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
        error instanceof Error ? error.message : 'Failed to list skill packages',
      );
    }
  });
