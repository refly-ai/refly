/**
 * Workflow Execution Constants
 *
 * Configuration for workflow execution polling and timeouts.
 * These constants are used by WorkflowService for managing workflow execution lifecycle.
 */

/**
 * Workflow execution polling and timeout configuration
 */
export const WORKFLOW_EXECUTION_CONSTANTS = {
  /** Interval between polling checks for workflow status (in milliseconds) */
  POLL_INTERVAL_MS: 1500,

  /** Maximum time allowed for entire workflow execution (30 minutes) */
  EXECUTION_TIMEOUT_MS: 30 * 60 * 1000,

  /** Maximum time allowed for a single node execution (10 minutes) */
  NODE_EXECUTION_TIMEOUT_MS: 10 * 60 * 1000,

  /** TTL for distributed lock during polling (5 seconds) */
  POLL_LOCK_TTL_MS: 5000,
} as const;
