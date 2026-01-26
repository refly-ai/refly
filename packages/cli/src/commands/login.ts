/**
 * refly login - Authenticate with Device Flow or API Key
 */

import { Command } from 'commander';
import * as os from 'node:os';
import open from 'open';
import { ok, fail, printError, ErrorCodes } from '../utils/output.js';
import { setOAuthTokens, setApiKey, getApiEndpoint, getWebUrl } from '../config/config.js';
import { apiRequest } from '../api/client.js';
import { logger } from '../utils/logger.js';
import { styled, Style } from '../utils/ui.js';
import { getCliVersion } from '../config/paths.js';

export const loginCommand = new Command('login')
  .description('Authenticate with Refly')
  .option('-k, --api-key <key>', 'Authenticate using an API key')
  .action(async (options) => {
    try {
      // If API key is provided, use API key authentication
      if (options.apiKey) {
        await loginWithApiKey(options.apiKey);
        return;
      }

      // Default: use device flow (opens browser login page)
      await loginWithDeviceFlow();
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
 * Device authorization flow response types
 */
interface DeviceSessionInfo {
  deviceId: string;
  cliVersion: string;
  host: string;
  status: 'pending' | 'authorized' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
  userCode?: string;
}

interface DeviceSessionWithTokens extends DeviceSessionInfo {
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Login using device authorization flow
 * Opens browser to login page, polls for authorization
 * Exported for use by init command
 * @param emitOutput - Whether to call ok() on success (default: true). Set to false when called from init.
 */
export async function loginWithDeviceFlow(emitOutput = true): Promise<boolean> {
  logger.info('Starting device authorization flow...');

  // 1. Initialize device session
  const hostname = os.hostname();
  const initResponse = await apiRequest<DeviceSessionInfo>('/v1/auth/cli/device/init', {
    method: 'POST',
    body: {
      cliVersion: getCliVersion(),
      host: hostname,
    },
    requireAuth: false,
  });

  const { deviceId, expiresAt, userCode } = initResponse;

  // Set up cleanup handler for when process is interrupted or exits
  const cleanup = async (deviceIdToCancel: string = deviceId) => {
    try {
      logger.debug('Cleaning up device session...');
      await apiRequest('/v1/auth/cli/device/cancel', {
        method: 'POST',
        body: { device_id: deviceIdToCancel },
        requireAuth: false,
      });
      logger.debug('Device session cancelled');
    } catch (error) {
      logger.debug('Failed to cancel device session during cleanup:', error);
    }
  };

  // Handle process termination signals
  process.on('SIGINT', async () => {
    logger.debug('Received SIGINT, cleaning up...');
    await cleanup();
    process.exit(130); // 128 + SIGINT(2)
  });

  process.on('SIGTERM', async () => {
    logger.debug('Received SIGTERM, cleaning up...');
    await cleanup();
    process.exit(143); // 128 + SIGTERM(15)
  });

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', async (error) => {
    logger.debug('Uncaught exception, cleaning up:', error);
    await cleanup();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    logger.debug('Unhandled rejection, cleaning up:', reason);
    await cleanup();
    process.exit(1);
  });

  // 2. Build authorization URL
  // Use web URL for browser authorization page (may differ from API endpoint in some environments)
  const webUrl = getWebUrl();
  const authUrl = `${webUrl}/cli/auth?device_id=${encodeURIComponent(deviceId)}&cli_version=${encodeURIComponent(getCliVersion())}&host=${encodeURIComponent(hostname)}`;

  // 3. Print instructions and open browser
  process.stderr.write('\n');
  process.stderr.write('To authorize this device, open the following URL in your browser:\n');
  process.stderr.write('\n');
  process.stderr.write(`  ${authUrl}\n`);
  process.stderr.write('\n');
  if (userCode) {
    process.stderr.write(`Verification Code: ${styled(userCode, Style.TEXT_HIGHLIGHT_BOLD)}\n`);
  }
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

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await sleep(pollInterval);

      const statusResponse = await apiRequest<DeviceSessionWithTokens>(
        '/v1/auth/cli/device/status',
        {
          method: 'GET',
          query: { device_id: deviceId },
          requireAuth: false,
        },
      );

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

            // Only emit output when called directly (not from init command)
            if (emitOutput) {
              ok('login', {
                message: 'Successfully authenticated via device authorization',
                user: userInfo,
                method: 'device',
              });
            }
            return true;
          }
          break;

        case 'cancelled':
          printError(ErrorCodes.AUTH_REQUIRED, 'Authorization was cancelled', {
            hint: 'The authorization request was cancelled in the browser',
          });
          return false;

        case 'expired':
          printError(ErrorCodes.AUTH_REQUIRED, 'Authorization request expired', {
            hint: 'Run `refly login` again to start a new session',
          });
          return false;

        case 'pending':
          // Continue polling
          if (attempt % 5 === 0) {
            process.stderr.write('.');
          }
          break;
      }
    }

    // Timeout - update device status before showing error
    logger.debug('Authorization timeout, updating device status...');
    await cleanup(deviceId);
    printError(ErrorCodes.TIMEOUT, 'Authorization timeout', {
      hint: 'Complete authorization in the browser within 5 minutes',
    });
    return false;
  } finally {
    // Remove signal handlers when done
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  }
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
