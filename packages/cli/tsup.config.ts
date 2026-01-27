import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read package.json version
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
const cliVersion = packageJson.version;

// Build-time configuration for different environments
// Usage:
//   - Production: pnpm build (or REFLY_BUILD_ENV=production pnpm build)
//   - Test/Dev:   REFLY_BUILD_ENV=test pnpm build
//   - Staging:    REFLY_BUILD_ENV=staging pnpm build
//   - Custom:     REFLY_BUILD_ENDPOINT=https://custom.api.com REFLY_BUILD_WEB_URL=https://custom.web.com pnpm build
const buildEnv = process.env.REFLY_BUILD_ENV || 'production';
const customEndpoint = process.env.REFLY_BUILD_ENDPOINT;
const customWebUrl = process.env.REFLY_BUILD_WEB_URL;

// Environment configuration mapping
// npmTag: the npm distribution tag used for publishing and upgrading
const ENV_CONFIG: Record<string, { apiEndpoint: string; webUrl: string; npmTag: string }> = {
  production: {
    apiEndpoint: 'https://api.refly.ai',
    webUrl: 'https://refly.ai',
    npmTag: 'latest',
  },
  staging: {
    apiEndpoint: 'https://staging-api.refly.ai',
    webUrl: 'https://staging.refly.ai',
    npmTag: 'staging',
  },
  test: {
    apiEndpoint: 'https://refly-api.powerformer.net',
    webUrl: 'https://refly.powerformer.net',
    npmTag: 'test',
  },
  dev: {
    apiEndpoint: 'http://localhost:5800',
    webUrl: 'http://localhost:5173',
    npmTag: 'dev',
  },
  development: {
    apiEndpoint: 'http://localhost:5173',
    webUrl: 'http://localhost:5173',
    npmTag: 'dev',
  },
};

// Determine the default API endpoint based on build environment
function getDefaultEndpoint(): string {
  if (customEndpoint) return customEndpoint;
  return ENV_CONFIG[buildEnv]?.apiEndpoint ?? ENV_CONFIG.production.apiEndpoint;
}

// Determine the default Web URL based on build environment
function getDefaultWebUrl(): string {
  if (customWebUrl) return customWebUrl;
  if (customEndpoint) return customEndpoint; // Assume same domain if only endpoint specified
  return ENV_CONFIG[buildEnv]?.webUrl ?? ENV_CONFIG.production.webUrl;
}

// Determine the npm tag based on build environment
function getNpmTag(): string {
  return ENV_CONFIG[buildEnv]?.npmTag ?? 'latest';
}

const defaultEndpoint = getDefaultEndpoint();
const defaultWebUrl = getDefaultWebUrl();
const npmTag = getNpmTag();

console.log(`[tsup] Building CLI for environment: ${buildEnv}`);
console.log(`[tsup] CLI version: ${cliVersion}`);
console.log(`[tsup] NPM tag: ${npmTag}`);
console.log(`[tsup] Default API endpoint: ${defaultEndpoint}`);
console.log(`[tsup] Default Web URL: ${defaultWebUrl}`);

export default defineConfig({
  entry: {
    'bin/refly': 'src/bin/refly.ts',
    index: 'src/index.ts',
  },
  format: ['cjs'],
  target: 'node18',
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: ['commander', 'zod', 'open'],
  // Inject build-time constants
  define: {
    'process.env.REFLY_BUILD_DEFAULT_ENDPOINT': JSON.stringify(defaultEndpoint),
    'process.env.REFLY_BUILD_DEFAULT_WEB_URL': JSON.stringify(defaultWebUrl),
    'process.env.REFLY_BUILD_ENV': JSON.stringify(buildEnv),
    'process.env.REFLY_BUILD_CLI_VERSION': JSON.stringify(cliVersion),
    'process.env.REFLY_BUILD_NPM_TAG': JSON.stringify(npmTag),
  },
});
