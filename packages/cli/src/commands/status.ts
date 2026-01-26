/**
 * refly status - Check CLI configuration and authentication status
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../utils/output.js';
import {
  loadConfig,
  getApiEndpoint,
  isAuthenticated,
  getOAuthProvider,
  getApiKeyInfo,
} from '../config/config.js';
import { verifyConnection } from '../api/client.js';
import { isSkillInstalled } from '../skill/installer.js';
import { getReflyDir, getCliVersion } from '../config/paths.js';

export const statusCommand = new Command('status')
  .description('Check CLI configuration and authentication status')
  .action(async () => {
    try {
      loadConfig();
      const skillStatus = isSkillInstalled();

      // Check authentication
      let authStatus: 'valid' | 'expired' | 'missing' = 'missing';
      let user: { uid: string; name?: string; email?: string } | undefined;
      let authMethod: 'oauth' | 'apikey' | undefined;
      let authDetails: Record<string, unknown> = {};

      if (isAuthenticated()) {
        const verification = await verifyConnection();
        if (verification.authenticated) {
          authStatus = 'valid';
          user = verification.user;
          authMethod = verification.authMethod;

          // Add auth-specific details
          if (authMethod === 'oauth') {
            const provider = getOAuthProvider();
            authDetails = { provider };
          } else if (authMethod === 'apikey') {
            const keyInfo = getApiKeyInfo();
            authDetails = { keyId: keyInfo?.keyId, keyName: keyInfo?.name };
          }
        } else if (verification.connected) {
          authStatus = 'expired';
        }
      }

      // Build response
      const payload = {
        cli_version: getCliVersion(),
        config_dir: getReflyDir(),
        api_endpoint: getApiEndpoint(),
        auth_status: authStatus,
        auth_method: authMethod ?? null,
        auth_details: Object.keys(authDetails).length > 0 ? authDetails : null,
        user: user ?? null,
        skill: {
          installed: skillStatus.installed,
          version: skillStatus.currentVersion ?? null,
          up_to_date: skillStatus.upToDate,
        },
      };

      // If not authenticated, return error response
      if (authStatus !== 'valid') {
        fail(
          ErrorCodes.AUTH_REQUIRED,
          authStatus === 'expired' ? 'Authentication expired' : 'Not authenticated',
          {
            details: payload,
            hint: 'refly login',
          },
        );
      }

      ok('status', payload);
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get status',
        { hint: 'Try running `refly init` first' },
      );
    }
  });
