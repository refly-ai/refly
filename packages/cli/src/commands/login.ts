/**
 * refly login - Authenticate with OAuth (Google or GitHub), Device Flow, or API Key
 */

import { Command } from 'commander';
import * as http from 'node:http';
import * as os from 'node:os';
import type { AddressInfo } from 'node:net';
import open from 'open';
import { ok, fail, ErrorCodes } from '../utils/output.js';
import { setOAuthTokens, setApiKey, getApiEndpoint } from '../config/config.js';
import { apiRequest } from '../api/client.js';
import { logger } from '../utils/logger.js';

// CLI version for device registration
const CLI_VERSION = '0.1.0';

export const loginCommand = new Command('login')
  .description('Authenticate with Refly using OAuth or API Key')
  .option('-p, --provider <provider>', 'OAuth provider (google or github)', 'google')
  .option('-k, --api-key <key>', 'Authenticate using an API key')
  .option('-d, --device', 'Use device authorization flow (for headless environments)')
  .action(async (options) => {
    try {
      // If API key is provided, use API key authentication
      if (options.apiKey) {
        await loginWithApiKey(options.apiKey);
        return;
      }

      // Validate provider
      const provider = options.provider as 'google' | 'github';
      if (!['google', 'github'].includes(provider)) {
        return fail(ErrorCodes.INVALID_INPUT, 'Invalid provider', {
          hint: 'Provider must be "google" or "github"',
        });
      }

      // Use device flow if requested
      if (options.device) {
        await loginWithDeviceFlow();
        return;
      }

      // Otherwise, use OAuth with local callback server
      await loginWithOAuth(provider);
    } catch (error) {
      logger.error('Login failed:', error);
      fail(ErrorCodes.AUTH_REQUIRED, error instanceof Error ? error.message : 'Login failed', {
        hint: 'Try again or check your internet connection',
      });
    }
  });

/**
 * Login using API Key
 */
async function loginWithApiKey(apiKey: string): Promise<void> {
  logger.info('Validating API key...');

  // Validate API key format
  if (!apiKey.startsWith('rf_')) {
    return fail(ErrorCodes.INVALID_INPUT, 'Invalid API key format', {
      hint: 'API key should start with "rf_"',
    });
  }

  // Validate API key with backend
  const result = await apiRequest<{
    valid: boolean;
    user?: { uid: string; email?: string; name?: string };
  }>('/v1/auth/cli/api-key/validate', {
    method: 'POST',
    body: { apiKey },
    requireAuth: false,
  });

  if (!result.valid || !result.user) {
    return fail(ErrorCodes.AUTH_REQUIRED, 'Invalid or expired API key', {
      hint: 'Generate a new API key from the Refly web app',
    });
  }

  // Store API key
  logger.debug('Storing API key...');
  setApiKey({
    apiKey,
    apiKeyId: 'manual', // We don't have the key ID when user provides directly
    apiKeyName: 'CLI Login',
    user: {
      uid: result.user.uid,
      email: result.user.email || '',
      name: result.user.name,
    },
  });

  ok('login', {
    message: 'Successfully authenticated with API key',
    user: result.user,
    method: 'apikey',
  });
}

/**
 * Login using OAuth
 */
async function loginWithOAuth(provider: 'google' | 'github'): Promise<void> {
  logger.info(`Starting ${provider} OAuth flow...`);

  // 1. Start local callback server
  const { server, port, callbackPromise } = await startCallbackServer();

  try {
    // 2. Request OAuth URL from backend
    logger.debug(`Requesting OAuth URL for port ${port}`);
    const initResponse = await apiRequest<{ authUrl: string; state: string }>(
      '/v1/auth/cli/oauth/init',
      {
        method: 'GET',
        query: { provider, port: port.toString() },
        requireAuth: false,
      },
    );

    const { authUrl } = initResponse;

    // 3. Open browser to OAuth URL
    logger.info('Opening browser for authentication...');
    process.stderr.write(`Opening browser for ${provider} authentication...\n`);
    await open(authUrl);

    // 4. Wait for callback (with timeout)
    logger.debug('Waiting for OAuth callback...');
    const callbackResult = await Promise.race([
      callbackPromise,
      new Promise<{ code: string; state: string; error?: string }>(
        (_, reject) => setTimeout(() => reject(new Error('OAuth callback timeout')), 120000), // 2 minutes
      ),
    ]);

    // Handle OAuth error from provider
    if (callbackResult.error) {
      return fail(ErrorCodes.AUTH_REQUIRED, `OAuth failed: ${callbackResult.error}`, {
        hint: 'Check browser for error details',
      });
    }

    const { code, state: returnedState } = callbackResult;

    // 5. Exchange code for tokens
    logger.debug('Exchanging authorization code for tokens...');
    const tokens = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: { uid: string; email: string; name?: string };
    }>('/v1/auth/cli/oauth/callback', {
      method: 'POST',
      body: { code, state: returnedState, provider },
      requireAuth: false,
    });

    // 6. Store tokens securely
    logger.debug('Storing OAuth tokens...');
    setOAuthTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      provider,
      user: tokens.user,
    });

    ok('login', {
      message: 'Successfully authenticated',
      user: tokens.user,
      provider,
      method: 'oauth',
    });
  } finally {
    // 7. Close server
    server.close();
    logger.debug('Callback server closed');
  }
}

/**
 * Start local HTTP server to receive OAuth callback
 * Returns server, port, and a promise that resolves with callback data
 */
async function startCallbackServer(): Promise<{
  server: http.Server;
  port: number;
  callbackPromise: Promise<{ code: string; state: string; error?: string }>;
}> {
  return new Promise((resolve) => {
    let callbackResolve: (value: { code: string; state: string; error?: string }) => void;
    const callbackPromise = new Promise<{ code: string; state: string; error?: string }>((res) => {
      callbackResolve = res;
    });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost');

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        // Handle OAuth error from provider
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <title>Authentication Failed</title>
                <style>
                  body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
                  h1 { color: #d32f2f; }
                  p { color: #666; line-height: 1.6; }
                </style>
              </head>
              <body>
                <h1>Authentication Failed</h1>
                <p><strong>Error:</strong> ${error}</p>
                ${errorDescription ? `<p>${errorDescription}</p>` : ''}
                <p>You can close this window and try again.</p>
              </body>
            </html>
          `);
          callbackResolve({ code: '', state: '', error: errorDescription || error });
          return;
        }

        if (code && state) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <title>Authentication Successful</title>
                <style>
                  body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
                  h1 { color: #2e7d32; }
                  p { color: #666; line-height: 1.6; }
                </style>
              </head>
              <body>
                <h1>Authentication Successful!</h1>
                <p>You have successfully authenticated with Refly.</p>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          callbackResolve({ code, state });
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <title>Authentication Failed</title>
                <style>
                  body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
                  h1 { color: #d32f2f; }
                  p { color: #666; line-height: 1.6; }
                </style>
              </head>
              <body>
                <h1>Authentication Failed</h1>
                <p>Missing authorization code or state parameter.</p>
                <p>You can close this window and try again.</p>
              </body>
            </html>
          `);
          callbackResolve({ code: '', state: '', error: 'Missing code or state' });
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Listen on random available port
    server.listen(0, 'localhost', () => {
      const address = server.address() as AddressInfo;
      resolve({ server, port: address.port, callbackPromise });
    });
  });
}

/**
 * Device authorization flow response types
 */
interface DeviceSessionInfo {
  deviceId: string;
  cliVersion: string;
  host: string;
  status: 'pending' | 'authorized' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
}

interface DeviceSessionWithTokens extends DeviceSessionInfo {
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Login using device authorization flow
 * This is useful for headless environments or when local server can't be used
 */
async function loginWithDeviceFlow(): Promise<void> {
  logger.info('Starting device authorization flow...');

  // 1. Initialize device session
  const hostname = os.hostname();
  const initResponse = await apiRequest<DeviceSessionInfo>('/v1/auth/cli/device/init', {
    method: 'POST',
    body: {
      cliVersion: CLI_VERSION,
      host: hostname,
    },
    requireAuth: false,
  });

  const { deviceId, expiresAt } = initResponse;

  // 2. Build authorization URL
  const apiEndpoint = getApiEndpoint();
  // Extract base URL (remove /v1 if present)
  const baseUrl = apiEndpoint.replace(/\/v1$/, '').replace(/\/api\./, '/');
  const authUrl = `${baseUrl}/cli/auth?device_id=${encodeURIComponent(deviceId)}&cli_version=${encodeURIComponent(CLI_VERSION)}&host=${encodeURIComponent(hostname)}`;

  // 3. Print instructions and open browser
  process.stderr.write('\n');
  process.stderr.write('To authorize this device, open the following URL in your browser:\n');
  process.stderr.write('\n');
  process.stderr.write(`  ${authUrl}\n`);
  process.stderr.write('\n');
  process.stderr.write(`Device ID: ${deviceId}\n`);
  process.stderr.write(`Expires: ${new Date(expiresAt).toLocaleTimeString()}\n`);
  process.stderr.write('\n');
  process.stderr.write('Waiting for authorization...\n');

  // Try to open browser automatically
  try {
    await open(authUrl);
    logger.debug('Browser opened successfully');
  } catch {
    logger.debug('Could not open browser automatically');
  }

  // 4. Poll for authorization status
  const pollInterval = 2000; // 2 seconds
  const maxAttempts = 150; // 5 minutes (150 * 2s)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);

    const statusResponse = await apiRequest<DeviceSessionWithTokens>('/v1/auth/cli/device/status', {
      method: 'GET',
      query: { device_id: deviceId },
      requireAuth: false,
    });

    switch (statusResponse.status) {
      case 'authorized':
        if (statusResponse.accessToken && statusResponse.refreshToken) {
          // Get user info from the token
          // For now, we'll make an additional call to get user info
          const userInfo = await getUserInfoFromToken(statusResponse.accessToken);

          // Store tokens
          setOAuthTokens({
            accessToken: statusResponse.accessToken,
            refreshToken: statusResponse.refreshToken,
            expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
            provider: 'google', // Device flow doesn't specify provider, default to google
            user: userInfo,
          });

          ok('login', {
            message: 'Successfully authenticated via device authorization',
            user: userInfo,
            method: 'device',
          });
          return;
        }
        break;

      case 'cancelled':
        return fail(ErrorCodes.AUTH_REQUIRED, 'Authorization was cancelled', {
          hint: 'The authorization request was cancelled in the browser',
        });

      case 'expired':
        return fail(ErrorCodes.AUTH_REQUIRED, 'Authorization request expired', {
          hint: 'Run `refly login --device` again to start a new session',
        });

      case 'pending':
        // Continue polling
        if (attempt % 5 === 0) {
          process.stderr.write('.');
        }
        break;
    }
  }

  // Timeout
  fail(ErrorCodes.TIMEOUT, 'Authorization timeout', {
    hint: 'Complete authorization in the browser within 5 minutes',
  });
}

/**
 * Get user info from access token
 */
async function getUserInfoFromToken(
  accessToken: string,
): Promise<{ uid: string; email: string; name?: string }> {
  try {
    const endpoint = getApiEndpoint();
    const response = await fetch(`${endpoint}/v1/user/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = (await response.json()) as {
        success: boolean;
        data?: { uid: string; email?: string; name?: string };
      };
      if (data.success && data.data) {
        return {
          uid: data.data.uid,
          email: data.data.email || '',
          name: data.data.name,
        };
      }
    }
  } catch (error) {
    logger.debug('Failed to get user info:', error);
  }

  // Fallback if we can't get user info
  return {
    uid: 'unknown',
    email: '',
  };
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
