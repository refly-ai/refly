/**
 * Configuration for skill execution engine.
 */

export interface RetryPolicy {
  /** Max retry attempts per workflow */
  maxRetries: number;
  /** Initial backoff delay in ms */
  backoffMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum backoff delay cap */
  maxBackoffMs: number;
  /** Error codes that are retryable */
  retryableErrors: string[];
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
  retryableErrors: [
    'WORKFLOW_TIMEOUT',
    'MAPPING_FAILED',
    // Network/transient errors are retryable
    // Business logic errors are NOT retryable
  ],
};

export interface ExecutionConfig {
  /** Max parallel workflows per skill execution */
  maxConcurrentWorkflows: number;
  /** Max parallel skill executions per user */
  maxConcurrentExecutions: number;
  /** Timeout per workflow in ms */
  workflowTimeoutMs: number;
  /** Timeout per skill execution in ms */
  skillTimeoutMs: number;
  /** Retry policy */
  retryPolicy: RetryPolicy;
}

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  maxConcurrentWorkflows: 5,
  maxConcurrentExecutions: 3,
  workflowTimeoutMs: 300000, // 5 minutes
  skillTimeoutMs: 1800000, // 30 minutes
  retryPolicy: DEFAULT_RETRY_POLICY,
};

/**
 * Calculate exponential backoff delay.
 */
export function calculateBackoff(retryCount: number, policy: RetryPolicy): number {
  const delay = policy.backoffMs * policy.backoffMultiplier ** retryCount;
  return Math.min(delay, policy.maxBackoffMs);
}

/**
 * Execution status constants.
 */
export const EXECUTION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  PARTIAL_FAILED: 'partial_failed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

/**
 * Workflow execution status constants.
 */
export const WORKFLOW_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  BLOCKED: 'blocked',
} as const;
