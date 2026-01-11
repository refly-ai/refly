/**
 * Sandbox Module Constants
 */

/**
 * Redis Queue Keys (BullMQ)
 *
 * Architecture: BullMQ ensures each message is consumed by exactly ONE worker
 * - API uses BullMQ to enqueue requests
 * - Worker uses BullMQ processor to dequeue and process
 * - Response still uses Pub/Sub (one-to-one with requestId)
 */
export const SANDBOX_QUEUES = {
  /** Request queue for code execution (BullMQ) */
  REQUEST: 'sandbox-execute-request',
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
