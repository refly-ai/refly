/**
 * refly whoami - Show current authenticated user
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../utils/output.js';
import { isAuthenticated } from '../config/config.js';
import { verifyConnection } from '../api/client.js';

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated user')
  .action(async () => {
    try {
      if (!isAuthenticated()) {
        fail(ErrorCodes.AUTH_REQUIRED, 'Not authenticated', { hint: 'refly login' });
      }

      const verification = await verifyConnection();

      if (!verification.authenticated || !verification.user) {
        fail(ErrorCodes.AUTH_EXPIRED, 'Authentication expired or invalid', { hint: 'refly login' });
      }

      ok('whoami', {
        uid: verification.user.uid,
        name: verification.user.name ?? null,
        email: verification.user.email ?? null,
      });
    } catch (error) {
      fail(
        ErrorCodes.AUTH_REQUIRED,
        error instanceof Error ? error.message : 'Failed to get user info',
        { hint: 'refly login' },
      );
    }
  });
