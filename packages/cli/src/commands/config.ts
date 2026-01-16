/**
 * refly config - Manage CLI configuration
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../utils/output.js';
import { loadConfig, saveConfig } from '../config/config.js';

export const configCommand = new Command('config')
  .description('Manage CLI configuration')
  .addCommand(
    new Command('get')
      .description('Get configuration value')
      .argument('[key]', 'Configuration key (e.g., api.endpoint)')
      .action((key?: string) => {
        const config = loadConfig();

        if (!key) {
          // Show all config (mask sensitive values)
          const safeConfig = {
            ...config,
            auth: config.auth
              ? {
                  method: config.auth.method,
                  provider: config.auth.provider,
                  apiKeyId: config.auth.apiKeyId,
                  apiKeyName: config.auth.apiKeyName,
                  user: config.auth.user,
                  // Mask sensitive tokens
                  accessToken: config.auth.accessToken ? '***' : undefined,
                  refreshToken: config.auth.refreshToken ? '***' : undefined,
                  apiKey: config.auth.apiKey ? '***' : undefined,
                }
              : undefined,
          };
          ok('config', safeConfig);
          return;
        }

        // Get specific key
        const value = getNestedValue(config, key);
        if (value === undefined) {
          return fail(ErrorCodes.NOT_FOUND, `Configuration key '${key}' not found`);
        }

        ok('config', { [key]: value });
      }),
  )
  .addCommand(
    new Command('set')
      .description('Set configuration value')
      .argument('<key>', 'Configuration key (e.g., api.endpoint)')
      .argument('<value>', 'Configuration value')
      .action((key: string, value: string) => {
        const config = loadConfig();

        // Only allow setting certain keys
        const allowedKeys = ['api.endpoint'];
        if (!allowedKeys.includes(key)) {
          return fail(ErrorCodes.INVALID_INPUT, `Cannot set '${key}'`, {
            hint: `Allowed keys: ${allowedKeys.join(', ')}`,
          });
        }

        setNestedValue(config, key, value);
        saveConfig(config);

        ok('config', {
          message: `Set ${key} = ${value}`,
          [key]: value,
        });
      }),
  )
  .addCommand(
    new Command('reset')
      .description('Reset configuration to defaults')
      .option('--api', 'Reset only API endpoint')
      .action((options) => {
        const config = loadConfig();

        if (options.api) {
          config.api = { endpoint: 'https://api.refly.ai' };
          saveConfig(config);
          ok('config', {
            message: 'API endpoint reset to default',
            'api.endpoint': 'https://api.refly.ai',
          });
        } else {
          // Full reset (preserve auth)
          const auth = config.auth;
          saveConfig({
            version: 1,
            api: { endpoint: 'https://api.refly.ai' },
            auth,
          });
          ok('config', { message: 'Configuration reset to defaults (auth preserved)' });
        }
      }),
  )
  .addCommand(
    new Command('path').description('Show configuration file path').action(() => {
      const { getConfigPath } = require('../config/paths.js');
      ok('config', { path: getConfigPath() });
    }),
  );

// Also add shorthand for common operations
configCommand.action(() => {
  // Default action: show current config
  const config = loadConfig();
  const safeConfig = {
    version: config.version,
    api: config.api,
    auth: config.auth
      ? {
          method: config.auth.method,
          provider: config.auth.provider,
          user: config.auth.user,
        }
      : undefined,
    skill: config.skill,
  };
  ok('config', safeConfig);
});

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;

  let current = obj;
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[lastKey] = value;
}
