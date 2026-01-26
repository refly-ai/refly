/**
 * refly logout - Revoke tokens and remove stored credentials
 */

import { Command } from 'commander';
import { ok } from '../utils/output.js';
import { clearAuth, isAuthenticated, getRefreshToken } from '../config/config.js';
import { apiRequest } from '../api/client.js';
import { logger } from '../utils/logger.js';

export const logoutCommand = new Command('logout')
  .description('Logout and remove stored credentials')
  .action(async () => {
    const wasAuthenticated = isAuthenticated();

    if (!wasAuthenticated) {
      return ok('logout', {
        message: 'No credentials were stored',
      });
    }

    // If using OAuth tokens, revoke them on the server
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        logger.debug('Revoking OAuth tokens on server...');
        await apiRequest('/v1/auth/cli/oauth/revoke', {
          method: 'POST',
        });
        logger.debug('OAuth tokens revoked successfully');
      } catch (error) {
        // Ignore errors during logout (token might already be invalid)
        logger.debug('Failed to revoke tokens on server (ignored):', error);
      }
    }

    // Clear local credentials
    clearAuth();

    ok('logout', {
      message: 'Successfully logged out',
    });
  });
