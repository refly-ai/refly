/**
 * refly init - Initialize CLI, install skill files, and authenticate
 */

import { Command } from 'commander';
import { ok, print, fail, ErrorCodes, isPrettyOutput } from '../utils/output.js';
import { installSkill, isSkillInstalled } from '../skill/installer.js';
import {
  loadConfig,
  saveConfig,
  getApiEndpoint,
  getAccessToken,
  getApiKey,
  getAuthUser,
} from '../config/config.js';
import { getReflyDir } from '../config/paths.js';
import { loginWithDeviceFlow } from './login.js';
import { isTTY, shouldUseColor } from '../utils/ui.js';
import { printLogo, printSuccess, printError, printDim, println } from '../utils/logo.js';

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
      } else if (!pretty) {
        // JSON mode: print install result
        print('init', {
          message: 'Refly CLI initialized successfully',
          configDir: getReflyDir(),
          apiEndpoint: apiEndpoint,
          skillInstalled: installResult.skillInstalled,
          skillPath: installResult.skillPath,
          commandsInstalled: installResult.commandsInstalled,
          commandsPath: installResult.commandsPath,
          version: installResult.version,
        });
      }

      // Auto-login unless skipped or already authenticated
      if (!skipLogin && !isAuthenticated) {
        if (pretty && tty) {
          println('Starting authentication...');
          printDim('A browser window will open for login.');
          println('');
        }

        // Call loginWithDeviceFlow without emitOutput so we can handle result ourselves
        const loginResult = await loginWithDeviceFlow({ emitOutput: false });

        if (pretty && tty) {
          if (loginResult.ok) {
            printSuccess('Authentication successful');
            if (loginResult.user?.email) {
              printDim(`  Welcome, ${loginResult.user.email}!`);
            }
          } else {
            printError('Authentication was not completed');
            printDim('  Run `refly login` to authenticate later.');
          }
          println('');
        } else if (!pretty && loginResult.ok) {
          // JSON mode: output login success
          print('login', {
            message: 'Successfully authenticated',
            user: loginResult.user,
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
          commandsInstalled: installResult.commandsInstalled,
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
