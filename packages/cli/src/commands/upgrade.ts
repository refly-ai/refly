/**
 * refly upgrade - Upgrade CLI and reinstall skill files
 */

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { ok, fail, print, ErrorCodes } from '../utils/output.js';
import { installSkill, isSkillInstalled } from '../skill/installer.js';
import { logger } from '../utils/logger.js';
import { getLegacyBuilderDir } from '../config/paths.js';

// Build-time injected constants
const CLI_VERSION = process.env.REFLY_BUILD_CLI_VERSION || '0.0.0';
const NPM_TAG = process.env.REFLY_BUILD_NPM_TAG || 'latest';

/**
 * Compare two semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareSemver(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const parts = v.replace(/^v/, '').split('-')[0].split('.');
    return parts.map((p) => Number.parseInt(p, 10) || 0);
  };

  const aParts = parseVersion(a);
  const bParts = parseVersion(b);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }
  return 0;
}

// Package name on npm
const PACKAGE_NAME = '@powerformer/refly-cli';

interface VersionInfo {
  current: string;
  latest: string | null;
  tag: string;
  updateAvailable: boolean;
}

/**
 * Get current CLI version (injected at build time)
 */
function getCurrentVersion(): string {
  return CLI_VERSION;
}

/**
 * Get current npm tag (injected at build time)
 */
function getCurrentTag(): string {
  return NPM_TAG;
}

/**
 * Get latest version from npm registry for the current tag
 */
async function getLatestVersion(): Promise<string | null> {
  const tag = getCurrentTag();
  try {
    // Use dist-tag to get version for the specific tag
    const result = execSync(`npm view ${PACKAGE_NAME}@${tag} version 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result.trim();
  } catch (error) {
    logger.debug(`Failed to get version for tag '${tag}' from npm:`, error);
    return null;
  }
}

/**
 * Check version info
 */
async function checkVersion(): Promise<VersionInfo> {
  const current = getCurrentVersion();
  const tag = getCurrentTag();
  const latest = await getLatestVersion();

  // Only show update available if latest version is actually newer (not just different)
  const updateAvailable = latest !== null && compareSemver(latest, current) > 0;

  return {
    current,
    latest,
    tag,
    updateAvailable,
  };
}

/**
 * Upgrade CLI package via npm
 */
function upgradeCli(): { success: boolean; error?: string } {
  const tag = getCurrentTag();
  try {
    logger.info(`Upgrading CLI via npm (tag: ${tag})...`);

    // Use npm to install the version for the current tag globally
    execSync(`npm install -g ${PACKAGE_NAME}@${tag}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120000, // 2 minutes
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to upgrade CLI:', message);
    return { success: false, error: message };
  }
}

/**
 * Clean up legacy data directories that are no longer used
 */
function cleanupLegacyData(): { builderCleaned: boolean } {
  const result = { builderCleaned: false };

  // Clean up legacy builder directory (~/.refly/builder)
  const builderDir = getLegacyBuilderDir();
  if (fs.existsSync(builderDir)) {
    try {
      fs.rmSync(builderDir, { recursive: true, force: true });
      result.builderCleaned = true;
      logger.info('Cleaned up legacy builder directory');
    } catch (error) {
      logger.debug('Failed to clean up legacy builder directory:', error);
    }
  }

  return result;
}

export const upgradeCommand = new Command('upgrade')
  .description('Upgrade CLI to latest version and reinstall skill files')
  .option('--check', 'Only check for updates without installing')
  .option('--skill-only', 'Only reinstall skill files without upgrading CLI')
  .option('--cli-only', 'Only upgrade CLI without reinstalling skill files')
  .action(async (options) => {
    try {
      const { check, skillOnly, cliOnly } = options;

      // Check for updates
      const versionInfo = await checkVersion();

      // Check only mode
      if (check) {
        return ok('upgrade.check', {
          currentVersion: versionInfo.current,
          latestVersion: versionInfo.latest,
          tag: versionInfo.tag,
          updateAvailable: versionInfo.updateAvailable,
          message: versionInfo.updateAvailable
            ? `Update available: ${versionInfo.current} → ${versionInfo.latest} (tag: ${versionInfo.tag})`
            : `Already on latest version (tag: ${versionInfo.tag})`,
        });
      }

      // Skill only mode
      if (skillOnly) {
        const beforeStatus = isSkillInstalled();
        const result = installSkill();

        return ok('upgrade', {
          message: 'Skill files updated successfully',
          cliUpgraded: false,
          skillUpdated: true,
          previousVersion: beforeStatus.currentVersion ?? null,
          newVersion: result.version,
          skillPath: result.skillPath,
          commandsInstalled: result.commandsInstalled,
        });
      }

      // CLI upgrade
      let cliUpgraded = false;
      let cliError: string | undefined;

      if (!cliOnly) {
        // Show current status
        print('upgrade.progress', {
          step: 'checking',
          currentVersion: versionInfo.current,
          latestVersion: versionInfo.latest,
        });
      }

      if (!skillOnly) {
        if (versionInfo.updateAvailable) {
          print('upgrade.progress', {
            step: 'upgrading',
            from: versionInfo.current,
            to: versionInfo.latest,
          });

          const upgradeResult = upgradeCli();
          cliUpgraded = upgradeResult.success;
          cliError = upgradeResult.error;

          if (!cliUpgraded) {
            return fail(ErrorCodes.INTERNAL_ERROR, 'Failed to upgrade CLI', {
              hint: cliError || `Try running: npm install -g ${PACKAGE_NAME}@${versionInfo.tag}`,
            });
          }
        } else {
          logger.info('CLI is already on latest version');
        }
      }

      // Reinstall skill files (unless cli-only)
      let skillResult = null;
      if (!cliOnly) {
        skillResult = installSkill();
      }

      // Clean up legacy data
      const cleanupResult = cleanupLegacyData();

      // Final output
      const newVersionInfo = await checkVersion();

      // Determine message based on what was updated
      let message: string;
      if (cliUpgraded && skillResult) {
        message = 'CLI and skill files updated successfully';
      } else if (cliUpgraded) {
        message = 'CLI updated successfully';
      } else if (skillResult) {
        message = 'Skill files updated (CLI already on latest version)';
      } else {
        message = 'Already on latest version';
      }

      ok('upgrade', {
        message,
        cliUpgraded,
        skillUpdated: !!skillResult,
        previousVersion: versionInfo.current,
        currentVersion: newVersionInfo.current,
        latestVersion: newVersionInfo.latest,
        tag: newVersionInfo.tag,
        skillPath: skillResult?.skillPath ?? null,
        commandsInstalled: skillResult?.commandsInstalled ?? false,
        legacyDataCleaned: cleanupResult.builderCleaned,
      });
    } catch (error) {
      return fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to upgrade',
        { hint: 'Check permissions and try again' },
      );
    }
  });
