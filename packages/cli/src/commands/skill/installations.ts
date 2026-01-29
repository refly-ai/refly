/**
 * refly skill installations - List installed skills
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface SkillInstallationSummary {
  installationId: string;
  skillId: string;
  installedVersion: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  skillPackage?: {
    name: string;
    version: string;
  };
}

export const skillInstallationsCommand = new Command('installations')
  .description('List installed skills')
  .option(
    '--status <status>',
    'Filter by status (downloading, initializing, ready, error, disabled)',
  )
  .option('--page <number>', 'Page number', '1')
  .option('--page-size <number>', 'Page size', '20')
  .action(async (options) => {
    try {
      const params = new URLSearchParams();
      if (options.status) params.set('status', options.status);
      params.set('page', options.page);
      params.set('pageSize', options.pageSize);

      const result = await apiRequest<{
        items: SkillInstallationSummary[];
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
      }>(`/v1/skill-installations?${params.toString()}`);

      ok('skill.installations', {
        installations: result.items.map((i) => ({
          installationId: i.installationId,
          skillId: i.skillId,
          skillName: i.skillPackage?.name,
          skillVersion: i.installedVersion,
          status: i.status,
          installedAt: i.createdAt,
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
        error instanceof Error ? error.message : 'Failed to list installed skills',
      );
    }
  });
