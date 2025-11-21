/**
 * Credential utilities
 * Handles credential resolution, validation, and authentication injection
 */

import type { HandlerContext } from '@refly/openapi-schema';

/**
 * Inject authentication credentials into handler context
 * @param context - Handler context to inject credentials into
 * @param credentials - Credentials to inject
 * @returns Updated context with merged credentials
 */
export function injectCredentials(
  context: HandlerContext,
  credentials: Record<string, unknown>,
): HandlerContext {
  return {
    ...context,
    credentials: {
      ...context.credentials,
      ...credentials,
    },
  };
}

/**
 * Resolve credentials from toolset configuration
 * Returns credentials as-is from the toolset configuration object
 * No environment variable substitution is performed
 */
export function resolveCredentials(credentials: Record<string, unknown>): Record<string, unknown> {
  if (!credentials || typeof credentials !== 'object') {
    return credentials;
  }

  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively resolve nested objects
      resolved[key] = resolveCredentials(value as Record<string, unknown>);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Validate that all required credentials are present
 */
export function validateCredentials(
  credentials: Record<string, unknown>,
  required: string[],
): void {
  const missing = required.filter((key) => {
    const value = credentials[key];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required credentials: ${missing.join(', ')}`);
  }
}

/**
 * Mask sensitive credential values for logging
 */
export function maskCredentials(credentials: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value === 'string') {
      masked[key] = maskValue(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      masked[key] = maskCredentials(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Mask a credential value (show first and last 4 characters)
 */
function maskValue(value: string): string {
  if (value.length <= 8) {
    return '***';
  }

  const first = value.slice(0, 4);
  const last = value.slice(-4);
  const middle = '*'.repeat(Math.min(value.length - 8, 10));

  return `${first}${middle}${last}`;
}
