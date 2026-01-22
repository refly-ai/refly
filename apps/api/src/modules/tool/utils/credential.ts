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
