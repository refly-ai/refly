/**
 * refly init - Initialize CLI and install skill files
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../utils/output.js';
import { installSkill, isSkillInstalled } from '../skill/installer.js';
import { loadConfig, saveConfig, getApiEndpoint, setApiKey } from '../config/config.js';
import { getReflyDir } from '../config/paths.js';

// Default API endpoint - injected at build time by tsup
// Build with different environments:
//   - Test/Dev: REFLY_BUILD_ENV=test pnpm build
//   - Production: REFLY_BUILD_ENV=production pnpm build (or just pnpm build)
//   - Custom: REFLY_BUILD_ENDPOINT=https://custom.refly.ai pnpm build
const DEFAULT_API_ENDPOINT = process.env.REFLY_BUILD_DEFAULT_ENDPOINT || 'https://refly.ai';

/**
 * Generate API key via dev endpoint (bypasses authentication)
 */
async function generateDevApiKey(
  endpoint: string,
  email: string,
): Promise<{
  keyId: string;
  apiKey: string;
  name: string;
  user: { uid: string; email: string; name: string | null };
} | null> {
  try {
    const response = await fetch(`${endpoint}/v1/auth/cli/dev/api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        name: 'CLI Auto-generated Key',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to generate API key: ${errorText}`);
      return null;
    }

    const data: any = await response.json();
    if (data?.success && data.data) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error(`Failed to connect to server: ${error}`);
    return null;
  }
}

export const initCommand = new Command('init')
  .description('Initialize Refly CLI and install skill files')
  .option('--force', 'Force reinstall even if already installed')
  .option('--host <url>', 'API server URL', DEFAULT_API_ENDPOINT)
  .option('--email <email>', 'Auto-generate API key for this email (dev mode)')
  .action(async (options) => {
    try {
      const { force, host, email } = options;
      const apiEndpoint = host || DEFAULT_API_ENDPOINT;

      // Check current state
      const skillStatus = isSkillInstalled();

      if (skillStatus.installed && skillStatus.upToDate && !force && !email) {
        return ok('init', {
          message: 'Refly CLI already initialized',
          configDir: getReflyDir(),
          skillInstalled: true,
          skillVersion: skillStatus.currentVersion,
          apiEndpoint: getApiEndpoint(),
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

      // Auto-generate API key if email provided
      let apiKeyInfo: {
        keyId: string;
        apiKey: string;
        name: string;
        user: { uid: string; email: string; name: string | null };
      } | null = null;

      if (email) {
        console.log(`\nGenerating API key for ${email}...`);
        apiKeyInfo = await generateDevApiKey(apiEndpoint, email);

        if (apiKeyInfo) {
          // Save API key to config
          setApiKey({
            apiKey: apiKeyInfo.apiKey,
            apiKeyId: apiKeyInfo.keyId,
            apiKeyName: apiKeyInfo.name,
            user: {
              uid: apiKeyInfo.user.uid,
              email: apiKeyInfo.user.email,
              name: apiKeyInfo.user.name || undefined,
            },
          });
          console.log('API key generated and saved successfully!');
        } else {
          console.warn(
            `Warning: Failed to generate API key. You can login manually with 'refly login'`,
          );
        }
      }

      ok('init', {
        message: 'Refly CLI initialized successfully',
        configDir: getReflyDir(),
        apiEndpoint: apiEndpoint,
        skillInstalled: result.skillInstalled,
        skillPath: result.skillPath,
        commandsInstalled: result.commandsInstalled,
        commandsPath: result.commandsPath,
        version: result.version,
        ...(apiKeyInfo
          ? {
              authenticated: true,
              authMethod: 'apikey',
              user: apiKeyInfo.user,
              apiKeyId: apiKeyInfo.keyId,
            }
          : {
              nextStep: 'Run `refly login` to authenticate, or use --email <email> for dev mode',
            }),
      });
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to initialize',
        { hint: 'Check permissions and try again' },
      );
    }
  });
