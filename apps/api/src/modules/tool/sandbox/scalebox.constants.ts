/**
 * Scalebox Default Configuration (flat structure)
 *
 * Note: These values serve as defaults for runtime-configurable options.
 * LOCAL_CONCURRENCY is compile-time only (used directly in @Processor decorator).
 */

// ==================== Executor Template ====================

/** Code size threshold for switching to path mode (64KB) */
export const CODE_SIZE_THRESHOLD = 64 * 1024;

/** Credentials file path in sandbox */
export const EXECUTOR_CREDENTIALS_PATH = '/tmp/.s3_cred';

/** Executor resource limits defaults */
export const EXECUTOR_LIMITS_DEFAULTS = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalWrite: 50 * 1024 * 1024, // 50MB
  maxFiles: 100,
  maxProcesses: 50,
} as const;

export type ExecutorLimits = typeof EXECUTOR_LIMITS_DEFAULTS;

/** Executor supported languages */
export type ExecutorLanguage = 'python' | 'javascript' | 'shell';

/**
 * Language mapping from OpenAPI schema to executor supported languages
 * Direct 1:1 mapping, no aliases
 */
export const LANGUAGE_MAP: Record<string, ExecutorLanguage> = {
  python: 'python',
  javascript: 'javascript',
  shell: 'shell',
} as const;

// ==================== Wrapper Type ====================

export type WrapperType = 'executor' | 'interpreter';

/** Default wrapper type - interpreter for open source compatibility */
export const DEFAULT_WRAPPER_TYPE: WrapperType = 'interpreter';

// ==================== Scalebox Defaults ====================

export const SCALEBOX_DEFAULTS = {
  // Sandbox
  SANDBOX_TIMEOUT_MS: 60 * 60 * 1000, // 1 hour

  // Pool
  MAX_SANDBOXES: 10,
  LOCAL_CONCURRENCY: 5, // Compile-time constant, not env-configurable
  MAX_QUEUE_SIZE: 100,
  AUTO_PAUSE_DELAY_MS: 2 * 60 * 1000, // 2 minutes
  IDLE_QUEUE_TTL_MULTIPLIER: 3, // idle queue TTL = sandboxTimeoutMs * multiplier

  // Lock
  RUN_CODE_TIMEOUT_SEC: 5 * 60, // 5 minutes
  LOCK_WAIT_TIMEOUT_SEC: 60, // Max time to wait for lock acquisition
  LOCK_POLL_INTERVAL_MS: 100,
  LOCK_INITIAL_TTL_SEC: 10, // Short initial TTL, renewed periodically
  LOCK_RENEWAL_INTERVAL_MS: 3000, // Renew every 3s (should be < TTL/2)

  // Health Check (create/connect readiness verification)
  HEALTH_CHECK_MAX_ATTEMPTS: 30,
  HEALTH_CHECK_INTERVAL_MS: 500,

  // Lifecycle Retry (create/connect)
  LIFECYCLE_RETRY_MAX_ATTEMPTS: 3,
  LIFECYCLE_RETRY_DELAY_MS: 2000,

  // Pause Retry
  PAUSE_RETRY_MAX_ATTEMPTS: 3,
  PAUSE_RETRY_DELAY_MS: 2000,

  // Kill Retry (async cleanup)
  KILL_RETRY_MAX_ATTEMPTS: 20,
  KILL_RETRY_INTERVAL_MS: 500,
} as const;

export const ERROR_MESSAGE_MAX_LENGTH = 1000;

export const S3_DEFAULT_CONFIG = {
  endPoint: 's3.us-east-1.amazonaws.com',
  port: 443,
  useSSL: true,
  accessKey: '',
  secretKey: '',
  bucket: 'refly-devbox-private',
  region: 'us-east-1',
} as const;

export const SANDBOX_DRIVE_MOUNT_POINT = '/mnt/refly';

export const REDIS_KEYS = {
  METADATA_PREFIX: 'scalebox:pool:meta',
  IDLE_QUEUE: 'scalebox:pool:idle',
  LOCK_EXECUTE_PREFIX: 'scalebox:execute:lock',
  LOCK_SANDBOX_PREFIX: 'scalebox:sandbox:lock',
} as const;
