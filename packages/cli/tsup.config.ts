import { defineConfig } from 'tsup';

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
const ENV_CONFIG: Record<string, { apiEndpoint: string; webUrl: string }> = {
  production: {
    apiEndpoint: 'https://refly.ai',
    webUrl: 'https://refly.ai',
  },
  staging: {
    apiEndpoint: 'https://refly.powerformer.net',
    webUrl: 'https://refly.powerformer.net',
  },
  test: {
    apiEndpoint: 'http://localhost:5173',
    webUrl: 'http://localhost:5173',
  },
  dev: {
    apiEndpoint: 'http://localhost:5173',
    webUrl: 'http://localhost:5173',
  },
  development: {
    apiEndpoint: 'http://localhost:5173',
    webUrl: 'http://localhost:5173',
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

const defaultEndpoint = getDefaultEndpoint();
const defaultWebUrl = getDefaultWebUrl();

console.log(`[tsup] Building CLI for environment: ${buildEnv}`);
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
  },
});
