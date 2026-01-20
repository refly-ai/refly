/**
 * refly upgrade - Upgrade CLI and reinstall skill files
 */

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ok, fail, print, ErrorCodes } from '../utils/output.js';
import { installSkill, isSkillInstalled } from '../skill/installer.js';
import { logger } from '../utils/logger.js';

// Package name on npm
const PACKAGE_NAME = '@powerformer/refly-cli';

interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}

/**
 * Get current CLI version from package.json
 */
function getCurrentVersion(): string {
  // This is injected at build time or read from package
  try {
    // Try to get version from the running package
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkgContent = fs.readFileSync(pkgPath, { encoding: 'utf-8' });
    const pkg = JSON.parse(pkgContent);
    return pkg.version;
  } catch {
    return '0.1.0';
  }
}

/**
 * Get latest version from npm registry
 */
async function getLatestVersion(): Promise<string | null> {
  try {
    const result = execSync(`npm view ${PACKAGE_NAME} version 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result.trim();
  } catch (error) {
    logger.debug('Failed to get latest version from npm:', error);
    return null;
  }
}

/**
 * Check version info
 */
async function checkVersion(): Promise<VersionInfo> {
  const current = getCurrentVersion();
  const latest = await getLatestVersion();

  return {
    current,
    latest,
    updateAvailable: latest !== null && latest !== current,
  };
}

/**
 * Upgrade CLI package via npm
 */
function upgradeCli(): { success: boolean; error?: string } {
  try {
    logger.info('Upgrading CLI via npm...');

    // Use npm to install the latest version globally
    execSync(`npm install -g ${PACKAGE_NAME}@latest`, {
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
          updateAvailable: versionInfo.updateAvailable,
          message: versionInfo.updateAvailable
            ? `Update available: ${versionInfo.current} → ${versionInfo.latest}`
            : 'Already on latest version',
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
              hint: cliError || 'Try running: npm install -g @powerformer/refly-cli@latest',
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
        skillPath: skillResult?.skillPath ?? null,
        commandsInstalled: skillResult?.commandsInstalled ?? false,
      });
    } catch (error) {
      return fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to upgrade',
        { hint: 'Check permissions and try again' },
      );
    }
  });
