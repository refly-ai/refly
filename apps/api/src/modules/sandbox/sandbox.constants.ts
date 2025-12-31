/**
 * Sandbox Module Constants
 */

/**
 * Redis Pub/Sub Channels
 */
export const SANDBOX_CHANNELS = {
  /** Request channel for code execution */
  REQUEST: 'sandbox:execute:request',
  /** Response channel prefix (append requestId) */
  RESPONSE_PREFIX: 'sandbox:execute:response:',
} as const;

/**
 * Timeout Configuration (milliseconds)
 */
export const SANDBOX_TIMEOUTS = {
  /** Default execution timeout */
  DEFAULT: 60000, // 60 seconds
} as const;
