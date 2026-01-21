/**
 * Standardized abort error messages and constants
 *
 * IMPORTANT: These messages are used for error classification and display to users.
 * Any changes here should be carefully tested to ensure correct error categorization.
 */

/**
 * User-facing abort error messages
 * These messages will be stored in the database and displayed to users
 */
export const ABORT_MESSAGES = {
  /**
   * User actively stopped the execution
   * Used for all user-initiated abort scenarios:
   * - User clicks stop button (same pod or cross pod)
   * - User stops execution before it starts (queued abort)
   * - User aborts via API
   */
  USER_ABORT: 'User stopped the execution',

  /**
   * System timeout - stream idle
   * Triggered when no output is received within the configured timeout period
   */
  STREAM_TIMEOUT: 'Execution timeout - no output received within specified time',
} as const;

/**
 * Internal log labels for tracking different abort detection paths
 * These are NOT shown to users, only used in logs for debugging
 */
export const ABORT_LOG_LABELS = {
  /** User abort detected in same pod via API call */
  USER_API_SAME_POD: 'user_abort_same_pod',

  /** User abort detected in cross pod via API call */
  USER_API_CROSS_POD: 'user_abort_cross_pod',

  /** User abort detected via polling in executing pod */
  USER_POLLING_DETECTION: 'user_abort_polling',

  /** User abort detected before execution starts (queued task) */
  USER_BEFORE_EXECUTION: 'user_abort_queued',

  /** System timeout - stream idle */
  SYSTEM_STREAM_TIMEOUT: 'system_stream_timeout',
} as const;

/**
 * Type definitions for abort messages
 */
export type AbortMessage = (typeof ABORT_MESSAGES)[keyof typeof ABORT_MESSAGES];
export type AbortLogLabel = (typeof ABORT_LOG_LABELS)[keyof typeof ABORT_LOG_LABELS];

/**
 * Helper function to check if an error message is a user-initiated abort
 * @param message - Error message to check
 * @returns true if the message indicates user-initiated abort
 */
export function isUserAbortMessage(message: string): boolean {
  return message === ABORT_MESSAGES.USER_ABORT;
}

/**
 * Helper function to check if an error message is a system timeout
 * @param message - Error message to check
 * @returns true if the message indicates system timeout
 */
export function isSystemTimeoutMessage(message: string): boolean {
  return message === ABORT_MESSAGES.STREAM_TIMEOUT;
}
