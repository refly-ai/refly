/**
 * refly init - Initialize CLI, install skill files, and authenticate
 */

import { Command } from 'commander';
import {
  getAccessToken,
  getApiEndpoint,
  getApiKey,
  getAuthUser,
  loadConfig,
  saveConfig,
} from '../config/config.js';
import { getReflyDir } from '../config/paths.js';
import { installSkill, isSkillInstalled } from '../skill/installer.js';
import { detectInstalledAgents, deploySkillToAllPlatforms } from '../platform/manager.js';
import { printDim, printError, println, printLogo, printSuccess } from '../utils/logo.js';
import { ErrorCodes, fail, isPrettyOutput, ok, print } from '../utils/output.js';
import { isTTY, shouldUseColor } from '../utils/ui.js';
import { loginWithDeviceFlow } from './login.js';

// Default API endpoint - injected at build time by tsup
// Build with different environments:
//   - Test/Dev: REFLY_BUILD_ENV=test pnpm build
//   - Production: REFLY_BUILD_ENV=production pnpm build (or just pnpm build)
//   - Custom: REFLY_BUILD_ENDPOINT=https://custom.refly.ai pnpm build
const DEFAULT_API_ENDPOINT = process.env.REFLY_BUILD_DEFAULT_ENDPOINT || 'https://refly.ai';

export const initCommand = new Command('init')
  .description('Initialize Refly CLI, install skill files, and authenticate')
  .option('--force', 'Force reinstall even if already installed')
  .option('--host <url>', 'API server URL', DEFAULT_API_ENDPOINT)
  .option('--skip-login', 'Skip automatic login after initialization')
  .action(async (options) => {
    try {
      const { force, host, skipLogin } = options;
      // Use build-time injected endpoint, or --host if explicitly provided
      const apiEndpoint = host || DEFAULT_API_ENDPOINT;

      // Determine output mode
      const pretty = isPrettyOutput();
      const tty = isTTY();
      const useColor = shouldUseColor();

      // Check current state
      const skillStatus = isSkillInstalled();
      const isAuthenticated = !!(getAccessToken() || getApiKey());

      // Already initialized case
      if (skillStatus.installed && skillStatus.upToDate && !force && isAuthenticated) {
        if (pretty && tty) {
          printLogo({ color: useColor });
          println('');
          printSuccess('Already initialized and authenticated');
          const user = getAuthUser();
          if (user?.email) {
            printDim(`  Logged in as ${user.email}`);
          }
          println('');
          printDim('Run `refly status` for details.');
          return;
        }
        return ok('init', {
          message: 'Refly CLI already initialized and authenticated',
          configDir: getReflyDir(),
          skillInstalled: true,
          skillVersion: skillStatus.currentVersion,
          apiEndpoint: getApiEndpoint(),
          authenticated: true,
        });
      }

      // Pretty mode: Show logo and progress
      if (pretty && tty) {
        printLogo({ color: useColor });
        println('');
        println('Initializing Refly CLI...');
        println('');
      }

      // Initialize config with API endpoint
      const config = loadConfig();
      config.api = {
        endpoint: apiEndpoint,
      };
      saveConfig(config);

      // Install skill files
      const installResult = installSkill();

      // Pretty mode: Show installation results
      if (pretty && tty) {
        if (installResult.skillInstalled) {
          printSuccess('Skill files installed');
        } else {
          printError('Skill files installation failed');
        }

        if (installResult.commandsInstalled) {
          printSuccess('Slash commands installed');
        } else {
          printError('Slash commands installation failed');
        }
        println('');
      }

      // Detect and sync to all installed agents (multi-platform support)
      const installedAgents = await detectInstalledAgents();
      const deployableAgents = installedAgents.filter((a) => a.format !== 'unknown');

      if (pretty && tty && deployableAgents.length > 0) {
        println(`Found ${deployableAgents.length} installed agent(s):`);
        for (const agent of deployableAgents) {
          const dir = agent.globalSkillsDir || agent.skillsDir || 'N/A';
          println(`  \u2713 ${agent.displayName.padEnd(16)} ${dir}`);
        }
        println('');
      }

      // Deploy base skill to all agents
      const platformResults: Array<{ agent: string; success: boolean; path?: string }> = [];
      if (deployableAgents.length > 0) {
        const deployResult = await deploySkillToAllPlatforms('refly', { force: true });
        for (const [agentName, result] of deployResult.results) {
          platformResults.push({
            agent: agentName,
            success: result.success,
            path: result.deployedPath || undefined,
          });
        }

        if (pretty && tty) {
          const successCount = platformResults.filter((r) => r.success).length;
          if (successCount === deployableAgents.length) {
            printSuccess(`Synced to ${successCount} agent(s)`);
          } else {
            printDim(`Synced to ${successCount}/${deployableAgents.length} agent(s)`);
          }
          println('');
        }
      }

      if (!pretty) {
        // JSON mode: print install result
        print('init', {
          message: 'Refly CLI initialized successfully',
          configDir: getReflyDir(),
          apiEndpoint: apiEndpoint,
          skillInstalled: installResult.skillInstalled,
          skillPath: installResult.skillPath,
          symlinkPath: installResult.symlinkPath,
          commandsInstalled: installResult.commandsInstalled,
          commandsPath: installResult.commandsPath,
          version: installResult.version,
          platforms: {
            detected: installedAgents.map((a) => a.name),
            deployed: platformResults,
          },
        });
      }

      // Auto-login unless skipped or already authenticated
      if (!skipLogin && !isAuthenticated) {
        if (pretty && tty) {
          println('Starting authentication...');
          printDim('A browser window will open for login.');
          println('');
        }

        // Call loginWithDeviceFlow with emitOutput=false so we can handle result ourselves
        const loginSuccess = await loginWithDeviceFlow(false);

        if (pretty && tty) {
          if (loginSuccess) {
            printSuccess('Authentication successful');
            const user = getAuthUser();
            if (user?.email) {
              printDim(`  Welcome, ${user.email}!`);
            }
          } else {
            printError('Authentication was not completed');
            printDim('  Run `refly login` to authenticate later.');
          }
          println('');
        } else if (!pretty && loginSuccess) {
          // JSON mode: output login success
          print('login', {
            message: 'Successfully authenticated',
            user: getAuthUser(),
          });
        }
      } else if (pretty && tty) {
        if (isAuthenticated) {
          printSuccess('Already authenticated');
          const user = getAuthUser();
          if (user?.email) {
            printDim(`  Logged in as ${user.email}`);
          }
        } else {
          printDim('Skipped login. Run `refly login` to authenticate later.');
        }
        println('');
      }

      // Final message
      if (pretty && tty) {
        println('Ready to use! Try `refly status` to verify.');
        return;
      }

      // JSON mode final output (if not already printed)
      if (!pretty) {
        return ok('init', {
          message: 'Refly CLI initialized successfully',
          configDir: getReflyDir(),
          apiEndpoint: apiEndpoint,
          skillInstalled: installResult.skillInstalled,
          skillPath: installResult.skillPath,
          symlinkPath: installResult.symlinkPath,
          commandsInstalled: installResult.commandsInstalled,
          commandsPath: installResult.commandsPath,
          version: installResult.version,
          authenticated: !!(getAccessToken() || getApiKey()),
        });
      }
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to initialize',
        { hint: 'Check permissions and try again' },
      );
    }
  });
