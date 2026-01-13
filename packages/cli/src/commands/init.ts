/**
 * refly init - Initialize CLI, install skill files, and authenticate
 */

import { Command } from 'commander';
import { ok, print, fail, ErrorCodes } from '../utils/output.js';
import { installSkill, isSkillInstalled } from '../skill/installer.js';
import {
  loadConfig,
  saveConfig,
  getApiEndpoint,
  getAccessToken,
  getApiKey,
} from '../config/config.js';
import { getReflyDir } from '../config/paths.js';
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
      const apiEndpoint = host || DEFAULT_API_ENDPOINT;

      // Check current state
      const skillStatus = isSkillInstalled();
      const isAuthenticated = !!(getAccessToken() || getApiKey());

      if (skillStatus.installed && skillStatus.upToDate && !force && isAuthenticated) {
        return ok('init', {
          message: 'Refly CLI already initialized and authenticated',
          configDir: getReflyDir(),
          skillInstalled: true,
          skillVersion: skillStatus.currentVersion,
          apiEndpoint: getApiEndpoint(),
          authenticated: true,
        });
      }

      // Initialize config with API endpoint
      const config = loadConfig();
      config.api = {
        endpoint: apiEndpoint,
      };
      saveConfig(config);

      // Install skill files
      const result = installSkill();

      // Output initialization success (use print instead of ok to continue execution)
      print('init', {
        message: 'Refly CLI initialized successfully',
        configDir: getReflyDir(),
        apiEndpoint: apiEndpoint,
        skillInstalled: result.skillInstalled,
        skillPath: result.skillPath,
        commandsInstalled: result.commandsInstalled,
        commandsPath: result.commandsPath,
        version: result.version,
      });

      // Auto-login unless skipped or already authenticated
      if (!skipLogin && !isAuthenticated) {
        process.stderr.write('\nStarting authentication...\n');
        const loginSuccess = await loginWithDeviceFlow();

        if (!loginSuccess) {
          process.stderr.write(
            '\nAuthentication was not completed. You can login later with `refly login`.\n',
          );
        }
      } else if (isAuthenticated) {
        process.stderr.write('\nAlready authenticated.\n');
      } else {
        process.stderr.write('\nSkipped login. Run `refly login` to authenticate later.\n');
      }
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to initialize',
        { hint: 'Check permissions and try again' },
      );
    }
  });
