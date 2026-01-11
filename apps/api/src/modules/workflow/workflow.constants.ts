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
  /** Interval between polling checks for workflow status (in milliseconds, configurable via WORKFLOW_POLL_INTERVAL_MS) */
  POLL_INTERVAL_MS: 1500,

  /** Maximum time allowed for entire workflow execution (30 minutes, configurable via WORKFLOW_EXECUTION_TIMEOUT_MS) */
  EXECUTION_TIMEOUT_MS: 30 * 60 * 1000,

  /** Maximum time allowed for a single node execution (30 minutes, configurable via WORKFLOW_NODE_EXECUTION_TIMEOUT_MS) */
  NODE_EXECUTION_TIMEOUT_MS: 30 * 60 * 1000,

  /** TTL for distributed lock during polling (5 seconds, configurable via WORKFLOW_POLL_LOCK_TTL_MS) */
  POLL_LOCK_TTL_MS: 5000,
} as const;
