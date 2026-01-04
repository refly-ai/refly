/**
 * Sandbox Module Constants
 */

/**
 * Redis Queue Keys (using List for single-consumer pattern)
 *
 * Architecture: Redis List ensures each message is consumed by exactly ONE worker
 * - API uses LPUSH to enqueue requests
 * - Worker uses BRPOP to dequeue and process (blocking pop)
 * - Response still uses Pub/Sub (one-to-one with requestId)
 */
export const SANDBOX_QUEUES = {
  /** Request queue for code execution (Redis List) */
  REQUEST: 'sandbox:execute:request',
  /** Response channel prefix (Redis Pub/Sub) */
  RESPONSE_PREFIX: 'sandbox:execute:response:',
} as const;

/**
 * Timeout Configuration (milliseconds)
 */
export const SANDBOX_TIMEOUTS = {
  /** Default execution timeout */
  DEFAULT: 60000, // 60 seconds
} as const;
