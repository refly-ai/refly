/**
 * Sandbox Module Constants
 */

/**
 * Sandbox HTTP Configuration
 */
export const SANDBOX_HTTP = {
  /** Default sandbox service URL */
  DEFAULT_URL: 'http://localhost:3002',
} as const;

/**
 * Timeout Configuration (milliseconds)
 */
export const SANDBOX_TIMEOUTS = {
  /** Default execution timeout */
  DEFAULT: 60000, // 60 seconds
} as const;
