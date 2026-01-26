/**
 * refly skill install - Install a skill package
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { createReflySkillWithSymlink, generateReflySkillMd } from '../../skill/symlink.js';
import { logger } from '../../utils/logger.js';

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
    displayName?: string;
    version: string;
    description?: string;
    triggers?: string[];
    tags?: string[];
    workflowId?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
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
          fail(ErrorCodes.INVALID_INPUT, 'Invalid config JSON', {
            hint: 'Config must be a valid JSON object, e.g., \'{"key": "value"}\'',
            suggestedFix: {
              field: '--config',
              format: 'json-object',
              example: '{"key": "value"}',
            },
          });
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

      // Create local skill directory and symlink
      let localPath: string | undefined;
      let symlinkPath: string | undefined;

      const skillName = result.skillPackage?.name;
      const workflowId = result.skillPackage?.workflowId;

      if (skillName && workflowId) {
        try {
          // Generate SKILL.md content
          const skillMdContent = generateReflySkillMd({
            name: skillName,
            displayName: result.skillPackage?.displayName,
            description: result.skillPackage?.description || `Skill: ${skillName}`,
            skillId: result.skillId,
            workflowId,
            installationId: result.installationId,
            triggers: result.skillPackage?.triggers,
            tags: result.skillPackage?.tags,
            version: result.installedVersion,
            inputSchema: result.skillPackage?.inputSchema,
            outputSchema: result.skillPackage?.outputSchema,
          });

          // Create skill directory and symlink
          const symlinkResult = createReflySkillWithSymlink(skillName, skillMdContent);

          if (symlinkResult.success) {
            localPath = symlinkResult.reflyPath;
            symlinkPath = symlinkResult.claudePath;
            logger.info(`Created local skill: ${localPath}`);
          } else {
            logger.warn(`Failed to create local skill: ${symlinkResult.error}`);
          }
        } catch (err) {
          // Log but don't fail - cloud installation was successful
          logger.warn(`Failed to create local skill: ${(err as Error).message}`);
        }
      }

      ok('skill.install', {
        installationId: result.installationId,
        skillId: result.skillId,
        skillName: result.skillPackage?.name,
        skillVersion: result.installedVersion,
        status: result.status,
        config: result.userConfig,
        installedAt: result.createdAt,
        localPath,
        symlinkPath,
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
        error instanceof Error ? error.message : 'Failed to install skill',
      );
    }
  });
