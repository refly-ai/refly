/**
 * API client for Refly backend communication.
 * Handles authentication, retries, and error mapping.
 * Supports both OAuth tokens and API Keys for authentication.
 */

import {
  getApiEndpoint,
  getAccessToken,
  getRefreshToken,
  getTokenExpiresAt,
  setOAuthTokens,
  getOAuthProvider,
  getAuthUser,
  getAuthMethod,
  getApiKey,
} from '../config/config.js';
import { ErrorCodes, type ErrorCode } from '../utils/output.js';
import { CLIError, AuthError, NetworkError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  errCode?: string;
  errMsg?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  query?: Record<string, string>;
  timeout?: number;
  requireAuth?: boolean;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Make an authenticated API request with automatic token refresh (for OAuth)
 * or API Key authentication
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, timeout = DEFAULT_TIMEOUT, requireAuth = true } = options;

  const endpoint = getApiEndpoint();
  let url = `${endpoint}${path}`;

  // Add query parameters
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(query);
    url = `${url}?${params.toString()}`;
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'refly-cli/0.1.0',
  };

  // Handle authentication based on method
  if (requireAuth) {
    const authMethod = getAuthMethod();

    if (authMethod === 'apikey') {
      // Use API Key authentication
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new AuthError('Not authenticated');
      }
      headers['X-API-Key'] = apiKey;
    } else {
      // Use OAuth authentication (default)
      let accessToken = getAccessToken();

      if (!accessToken) {
        throw new AuthError('Not authenticated');
      }

      // Check if OAuth token is expired and refresh if needed
      const expiresAt = getTokenExpiresAt();
      if (expiresAt && new Date(expiresAt) < new Date()) {
        logger.debug('Access token expired, refreshing...');
        try {
          accessToken = await refreshAccessToken();
        } catch (error) {
          logger.error('Failed to refresh token:', error);
          throw new AuthError('Session expired, please login again');
        }
      }

      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    logger.debug(`API Request: ${method} ${path}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data = (await response.json()) as APIResponse<T>;

    // Handle API-level errors
    if (!response.ok || !data.success) {
      throw mapAPIError(response.status, data);
    }

    return data.data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof CLIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new CLIError(ErrorCodes.TIMEOUT, 'Request timed out', undefined, 'Try again later');
      }

      if (error.message.includes('fetch')) {
        throw new NetworkError('Cannot connect to API');
      }
    }

    throw new CLIError(
      ErrorCodes.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

/**
 * Refresh access token using refresh token (OAuth only)
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new AuthError('No refresh token available');
  }

  const provider = getOAuthProvider();
  const user = getAuthUser();

  if (!provider || !user) {
    throw new AuthError('Invalid OAuth state');
  }

  const endpoint = getApiEndpoint();
  const url = `${endpoint}/v1/auth/cli/oauth/refresh`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'refly-cli/0.1.0',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new AuthError('Failed to refresh token');
  }

  const data = (await response.json()) as APIResponse<{
    accessToken: string;
    refreshToken: string;
  }>;

  if (!data.success || !data.data) {
    throw new AuthError('Failed to refresh token');
  }

  // Update stored tokens
  setOAuthTokens({
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    provider,
    user,
  });

  logger.debug('Access token refreshed successfully');
  return data.data.accessToken;
}

/**
 * Map API error response to CLIError
 */
function mapAPIError(status: number, response: APIResponse): CLIError {
  const errCode = response.errCode ?? 'UNKNOWN';
  const errMsg = response.errMsg ?? 'Unknown error';

  // Map HTTP status codes
  if (status === 401 || status === 403) {
    return new AuthError(errMsg);
  }

  if (status === 404) {
    return new CLIError(ErrorCodes.NOT_FOUND, errMsg, undefined, 'Check the resource ID');
  }

  if (status === 409) {
    return new CLIError(ErrorCodes.CONFLICT, errMsg, undefined, 'Refresh and try again');
  }

  if (status === 422) {
    return new CLIError(ErrorCodes.INVALID_INPUT, errMsg, undefined, 'Check input format');
  }

  if (status >= 500) {
    return new CLIError(ErrorCodes.API_ERROR, errMsg, undefined, 'Try again later');
  }

  // Map API error codes to ErrorCode type
  return new CLIError(errCode as ErrorCode, errMsg);
}

/**
 * Verify API connection and authentication
 */
export async function verifyConnection(): Promise<{
  connected: boolean;
  authenticated: boolean;
  authMethod?: 'oauth' | 'apikey';
  user?: { uid: string; name?: string; email?: string };
}> {
  try {
    const authMethod = getAuthMethod();

    // Check if we have any credentials
    if (authMethod === 'apikey') {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { connected: true, authenticated: false };
      }
    } else {
      const accessToken = getAccessToken();
      if (!accessToken) {
        return { connected: true, authenticated: false };
      }
    }

    const user = await apiRequest<{ uid: string; name?: string; email?: string }>('/v1/user/me', {
      requireAuth: true,
    });

    return { connected: true, authenticated: true, authMethod, user };
  } catch (error) {
    if (error instanceof AuthError) {
      return { connected: true, authenticated: false };
    }
    if (error instanceof NetworkError) {
      return { connected: false, authenticated: false };
    }
    // For other errors, assume connection works but auth failed
    return { connected: true, authenticated: false };
  }
}
