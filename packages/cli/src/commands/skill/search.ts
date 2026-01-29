/**
 * refly skill search - Search public skill packages
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
  uid: string;
  triggers: string[];
  tags: string[];
  downloadCount: number;
  createdAt: string;
}

export const skillSearchCommand = new Command('search')
  .description('Search public skill packages')
  .argument('<query>', 'Search query')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('--page <number>', 'Page number', '1')
  .option('--page-size <number>', 'Page size', '20')
  .action(async (query, options) => {
    try {
      const params = new URLSearchParams();
      params.set('query', query);
      if (options.tags) params.set('tags', options.tags);
      params.set('page', options.page);
      params.set('pageSize', options.pageSize);

      const result = await apiRequest<{
        items: SkillPackageSummary[];
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
      }>(`/v1/skill-packages/public/search?${params.toString()}`);

      ok('skill.search', {
        query,
        skills: result.items.map((s) => ({
          skillId: s.skillId,
          name: s.name,
          version: s.version,
          description: s.description,
          triggers: s.triggers,
          tags: s.tags,
          downloadCount: s.downloadCount,
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
        error instanceof Error ? error.message : 'Failed to search skill packages',
      );
    }
  });
