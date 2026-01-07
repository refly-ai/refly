/**
 * Authentication helper functions for load tests
 */

import http from 'k6/http';
import { check } from 'k6';
import { config, getHeaders } from '../config.js';

/**
 * Validate if the auth token is valid by making a test API call
 * @returns {boolean} Whether the token is valid
 */
export function validateToken() {
  if (!config.authToken) {
    console.error('❌ K6_AUTH_TOKEN environment variable is not set');
    return false;
  }

  // Make an authenticated API call to verify token
  const response = http.post(
    `${config.baseUrl}/v1/schedule/list`,
    JSON.stringify({ page: 1, pageSize: 1 }),
    { headers: getHeaders(), timeout: config.timeout },
  );

  const success = check(response, {
    'token is valid': (r) => r.status === 200,
  });

  if (!success) {
    console.error(`❌ Token validation failed. Status: ${response.status}, Body: ${response.body}`);
  }

  return success;
}

/**
 * Get current user information
 * @returns {Object|null} User data or null if failed
 */
export function getCurrentUser() {
  const response = http.get(`${config.baseUrl}/v1/user/me`, {
    headers: getHeaders(),
    timeout: config.timeout,
  });

  if (response.status !== 200) {
    console.error(`Failed to get current user: ${response.status}`);
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    return body.data;
  } catch (e) {
    console.error(`Failed to parse user response: ${e}`);
    return null;
  }
}

/**
 * HTTP client wrapper with automatic authentication headers
 */
export const authHttp = {
  post: (url, body, params = {}) => {
    return http.post(url, body, {
      ...params,
      headers: { ...getHeaders(), ...(params.headers || {}) },
    });
  },

  get: (url, params = {}) => {
    return http.get(url, {
      ...params,
      headers: { ...getHeaders(), ...(params.headers || {}) },
    });
  },
};
