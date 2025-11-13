/**
 * Scalebox internal queue constants
 * These queues are only used within the scalebox module
 */

/**
 * Scalebox execution queue (internal queue, not exposed externally)
 */
export const SCALEBOX_EXECUTION_QUEUE = 'scaleboxExecution';

/**
 * Default configuration values for Scalebox
 */
export const SCALEBOX_DEFAULT_TIMEOUT = 30000; // 30 seconds
export const SCALEBOX_DEFAULT_MAX_QUEUE_SIZE = 50; // Maximum 50 tasks in queue
export const SCALEBOX_DEFAULT_CONCURRENCY = 10; // Maximum 10 concurrent executions
