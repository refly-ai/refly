/**
 * Configuration management with atomic writes and secure permissions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { z } from 'zod';
import { getConfigPath, getReflyDir } from './paths.js';

// Platform agent types for config schema
const AgentTypeEnum = z.enum([
  'claude-code',
  'codex',
  'antigravity',
  'github-copilot',
  'windsurf',
  'opencode',
  'moltbot',
  'cursor',
  'continue',
  'trae',
  'qoder',
]);

// Platform config schema
const PlatformConfigSchema = z.object({
  enabled: z.boolean().default(true),
  globalPath: z.string().optional(),
});

// Config schema
const ConfigSchema = z.object({
  version: z.number().default(1),
  auth: z
    .object({
      // Authentication method: 'oauth' or 'apikey'
      method: z.enum(['oauth', 'apikey']).optional(),
      // OAuth tokens (used when method = 'oauth')
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresAt: z.string().optional(),
      provider: z.enum(['google', 'github']).optional(),
      // API Key (used when method = 'apikey')
      apiKey: z.string().optional(),
      apiKeyId: z.string().optional(),
      apiKeyName: z.string().optional(),
      // User info (shared by both methods)
      user: z
        .object({
          uid: z.string(),
          email: z.string(),
          name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  api: z
    .object({
      endpoint: z.string().default('https://refly.ai'),
    })
    .optional(),
  skill: z
    .object({
      installedVersion: z.string().optional(),
      installedAt: z.string().optional(),
    })
    .optional(),
  // Multi-platform configuration
  platforms: z.record(AgentTypeEnum, PlatformConfigSchema).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

// Default API endpoint and Web URL - injected at build time by tsup
// Build with different environments:
//   - Production: pnpm build (or REFLY_BUILD_ENV=production pnpm build)
//   - Test/Dev:   REFLY_BUILD_ENV=test pnpm build
//   - Staging:    REFLY_BUILD_ENV=staging pnpm build
//   - Custom:     REFLY_BUILD_ENDPOINT=https://custom.api.com REFLY_BUILD_WEB_URL=https://custom.web.com pnpm build
// Can be overridden at runtime by REFLY_API_ENDPOINT / REFLY_WEB_URL env vars
const DEFAULT_API_ENDPOINT = process.env.REFLY_BUILD_DEFAULT_ENDPOINT || 'https://refly.ai';
const DEFAULT_WEB_URL = process.env.REFLY_BUILD_DEFAULT_WEB_URL || 'https://refly.ai';

const DEFAULT_CONFIG: Config = {
  version: 1,
  api: {
    endpoint: DEFAULT_API_ENDPOINT,
  },
};

/**
 * Load configuration from file
 */
export function loadConfig(): Config {
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      return DEFAULT_CONFIG;
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return ConfigSchema.parse(parsed);
  } catch {
    // Return default config if parsing fails
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration atomically with secure permissions
 */
export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  const tempPath = path.join(getReflyDir(), `.config-${crypto.randomUUID()}.tmp`);

  // Validate before saving
  const validated = ConfigSchema.parse(config);

  // Write to temp file first
  fs.writeFileSync(tempPath, JSON.stringify(validated, null, 2), {
    mode: 0o600, // Owner read/write only
  });

  // Atomic rename
  fs.renameSync(tempPath, configPath);

  // Ensure permissions on final file (for existing files)
  if (os.platform() !== 'win32') {
    fs.chmodSync(configPath, 0o600);
  }
}

/**
 * Get the API endpoint (with override support)
 */
export function getApiEndpoint(override?: string): string {
  if (override) return override;

  // Check environment variable
  const envEndpoint = process.env.REFLY_API_ENDPOINT;
  if (envEndpoint) return envEndpoint;

  // Load from config
  const config = loadConfig();
  return config.api?.endpoint ?? DEFAULT_CONFIG.api!.endpoint;
}

/**
 * Get the Web URL for browser links (with override support)
 * Used to generate workflow URLs, canvas links, etc.
 */
export function getWebUrl(override?: string): string {
  if (override) return override;

  // Check environment variable
  const envWebUrl = process.env.REFLY_WEB_URL;
  if (envWebUrl) return envWebUrl;

  // Default to build-time injected value
  return DEFAULT_WEB_URL;
}

/**
 * Check if authenticated (OAuth or API Key)
 */
export function isAuthenticated(): boolean {
  const config = loadConfig();
  const method = config.auth?.method;

  if (method === 'apikey') {
    return !!config.auth?.apiKey;
  }

  // Default to OAuth check
  return !!config.auth?.accessToken;
}

/**
 * Get authentication method
 */
export function getAuthMethod(): 'oauth' | 'apikey' | undefined {
  const config = loadConfig();
  return config.auth?.method;
}

/**
 * Clear authentication
 */
export function clearAuth(): void {
  const config = loadConfig();
  config.auth = undefined;
  saveConfig(config);
}

/**
 * Update skill installation info
 */
export function updateSkillInfo(version: string): void {
  const config = loadConfig();
  config.skill = {
    installedVersion: version,
    installedAt: new Date().toISOString(),
  };
  saveConfig(config);
}

/**
 * Set OAuth tokens
 */
export function setOAuthTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  provider: 'google' | 'github';
  user: { uid: string; email: string; name?: string };
}): void {
  const config = loadConfig();
  config.auth = {
    method: 'oauth',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    provider: tokens.provider,
    user: tokens.user,
  };
  saveConfig(config);
}

/**
 * Get OAuth access token
 */
export function getAccessToken(): string | undefined {
  const config = loadConfig();
  return config.auth?.accessToken;
}

/**
 * Get OAuth refresh token
 */
export function getRefreshToken(): string | undefined {
  const config = loadConfig();
  return config.auth?.refreshToken;
}

/**
 * Get token expiry time
 */
export function getTokenExpiresAt(): string | undefined {
  const config = loadConfig();
  return config.auth?.expiresAt;
}

/**
 * Get OAuth provider
 */
export function getOAuthProvider(): 'google' | 'github' | undefined {
  const config = loadConfig();
  return config.auth?.provider;
}

/**
 * Get authenticated user info
 */
export function getAuthUser(): { uid: string; email: string; name?: string } | undefined {
  const config = loadConfig();
  return config.auth?.user;
}

/**
 * Set API Key authentication
 */
export function setApiKey(apiKeyData: {
  apiKey: string;
  apiKeyId: string;
  apiKeyName: string;
  user: { uid: string; email: string; name?: string };
}): void {
  const config = loadConfig();
  config.auth = {
    method: 'apikey',
    apiKey: apiKeyData.apiKey,
    apiKeyId: apiKeyData.apiKeyId,
    apiKeyName: apiKeyData.apiKeyName,
    user: apiKeyData.user,
  };
  saveConfig(config);
}

/**
 * Get API Key
 */
export function getApiKey(): string | undefined {
  const config = loadConfig();
  return config.auth?.apiKey;
}

/**
 * Get API Key info
 */
export function getApiKeyInfo(): { keyId: string; name: string } | undefined {
  const config = loadConfig();
  if (config.auth?.apiKeyId && config.auth?.apiKeyName) {
    return {
      keyId: config.auth.apiKeyId,
      name: config.auth.apiKeyName,
    };
  }
  return undefined;
}
