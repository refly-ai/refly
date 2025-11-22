/**
 * Default configuration values for Scalebox
 */
export const SCALEBOX_DEFAULT_TIMEOUT = 60000;

/**
 * Default configuration values for Sandbox Pool
 */
export const SCALEBOX_DEFAULT_MAX_SANDBOXES = 10;
export const SCALEBOX_DEFAULT_MIN_REMAINING_MS = 2 * 60 * 1000; // 2 minutes
export const SCALEBOX_DEFAULT_SANDBOX_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Maximum lifetime for a single sandbox instance
 * Prevents accumulation of:
 * - FUSE mount/unmount residual state (memory, file descriptors)
 * - User code side effects (background processes, timers, cron jobs)
 * - Temporary files, log files, and orphaned processes
 * - Global state pollution (env vars, Python modules, Node globals)
 * Sandboxes exceeding this lifetime are discarded instead of being reused
 */
export const SCALEBOX_DEFAULT_MAX_LIFETIME_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Auto-pause delay for idle sandboxes
 * After release, sandbox stays running for this duration for quick reuse
 * If not reused within this time, automatically paused to save resources
 * Balances performance (fast reuse) and cost (resource usage)
 */
export const SCALEBOX_DEFAULT_AUTO_PAUSE_DELAY_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Lock TTL (Time-To-Live) Configuration
 * Controls how long a lock is held in Redis before automatic expiration
 * CRITICAL: TTL must be >= actual operation time to prevent premature release
 */
export const LOCK_TTL_CONFIG = {
  /**
   * Pool capacity lock TTL
   * Protects sandbox allocation to prevent exceeding maxSandboxes limit
   * Covers: Sandbox.create (~9.5s) + capacity check ≈ 10s
   * Set to 30s to provide safety margin for slow operations
   */
  POOL_CAPACITY_TTL_SEC: 30,

  /**
   * Canvas-level execution lock TTL
   * Covers: mount (~0.8s) + user code execution (unknown) + unmount (~0.3s)
   * Set to 5 minutes to allow for long-running user code
   */
  EXECUTE_TTL_SEC: 5 * 60,

  /**
   * Sandbox-level lock TTL (used for auto-pause)
   * Covers: reconnect (~0.5s) + pause (~1s) ≈ 1.5s
   * Set to 30s for safety margin
   */
  SANDBOX_TTL_SEC: 30,
} as const;

/**
 * Lock acquisition retry configuration
 * Controls polling behavior when waiting for locks
 * NOTE: TIMEOUT_MS should be > TTL_SEC to allow for lock queue processing
 */
export const LOCK_RETRY_CONFIG = {
  /** Pool capacity lock acquisition timeout (must wait for other sandbox allocations to finish) */
  POOL_CAPACITY_TIMEOUT_MS: 60 * 1000, // 60 seconds (2x TTL for queue tolerance)
  /** Canvas-level execution lock acquisition timeout (allow queued executions) */
  EXECUTE_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes (2x TTL for queue tolerance)
  /** Lock polling interval for retry attempts */
  POLL_INTERVAL_MS: 100, // 100ms
} as const;

/**
 * Maximum length for error messages (traceback, stderr, etc.)
 * Messages exceeding this length will be truncated with '[... more info]' suffix
 */
export const ERROR_MESSAGE_MAX_LENGTH = 1000;

/**
 * S3 Default Configuration
 */
export const S3_DEFAULT_CONFIG = {
  endPoint: 's3.us-east-1.amazonaws.com', // MinIO SDK uses 'endPoint' with capital P
  port: 443,
  useSSL: true,
  accessKey: '',
  secretKey: '',
  bucket: 'refly-devbox-private',
  region: 'us-east-1',
} as const;

/**
 * Drive mount point inside sandbox (read-write)
 * Contains user uploaded files and generated files
 */
export const SANDBOX_DRIVE_MOUNT_POINT = '/mnt/refly';

/**
 * Redis Keys for Sandbox Pool Storage
 * Used for metadata, queues, and concurrency control
 */
export const REDIS_KEYS = {
  /** Prefix for sandbox metadata */
  METADATA_PREFIX: 'scalebox:pool:meta',
  /** Idle sandbox queue (FIFO) */
  IDLE_QUEUE: 'scalebox:pool:idle',
  /** Active sandbox set (concurrency tracking) */
  ACTIVE_SET: 'scalebox:pool:active',
  /** Pool capacity lock - prevents exceeding maxSandboxes limit during allocation */
  LOCK_POOL_CAPACITY: 'scalebox:pool:capacity',
  /** Prefix for canvas-level execution locks */
  LOCK_EXECUTE_PREFIX: 'scalebox:execute:lock',
} as const;
