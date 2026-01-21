/**
 * refly skill install - Install a skill package
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface SkillInstallationResponse {
  installationId: string;
  skillId: string;
  installedVersion: string;
  status: string;
  userConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  skillPackage?: {
    name: string;
    version: string;
  };
}

export const skillInstallCommand = new Command('install')
  .description('Install a skill package')
  .argument('<skillId>', 'Skill package ID to install')
  .option('--version <version>', 'Specific version to install')
  .option('--share-id <shareId>', 'Share ID for private skills')
  .option('--config <json>', 'Installation config JSON')
  .action(async (skillId, options) => {
    try {
      const body: Record<string, unknown> = { skillId };
      if (options.version) body.version = options.version;
      if (options.shareId) body.shareId = options.shareId;

      if (options.config) {
        try {
          body.config = JSON.parse(options.config);
        } catch {
          fail(ErrorCodes.INVALID_INPUT, 'Invalid config JSON');
          return;
        }
      }

      const result = await apiRequest<SkillInstallationResponse>(
        '/v1/skill-installations/install',
        {
          method: 'POST',
          body,
        },
      );

      ok('skill.install', {
        installationId: result.installationId,
        skillId: result.skillId,
        skillName: result.skillPackage?.name,
        skillVersion: result.installedVersion,
        status: result.status,
        config: result.userConfig,
        installedAt: result.createdAt,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to install skill',
      );
    }
  });
