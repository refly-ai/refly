import { DEFAULT_LOCK_BASE_CONFIG } from './scalebox.lock';

/**
 * Scalebox Default Configuration
 * Centralized configuration for sandbox, pool, and lock management
 */
export const SCALEBOX_DEFAULT_CONFIG = {
  /** Sandbox instance configuration */
  sandbox: {
    /** Sandbox timeout in milliseconds (passed to Scalebox provider on creation) */
    timeoutMs: 60 * 60 * 1000, // 1 hour
  },

  /** Pool management configuration */
  pool: {
    /** Maximum concurrent sandboxes per worker instance (local limit) */
    localConcurrentMaxSize: 2,
    /** Maximum queue size across all instances (global limit, 0 = no limit) */
    globalMaxQueueSize: 100,
    /** Maximum total sandboxes (idle + active) per instance (resource limit) */
    maxSandboxes: 5,
    /**
     * Auto-pause delay for idle sandboxes in milliseconds
     * After release, sandbox stays running for this duration for quick reuse
     * If not reused within this time, automatically paused to save resources
     * Balances performance (fast reuse) and cost (resource usage)
     */
    autoPauseDelayMs: 2 * 60 * 1000, // 2 minutes
  },

  /**
   * Base lock configuration (input parameters)
   * All lock TTL and timeout values are calculated from these base parameters
   * See calculateLockConfig() for derivation formulas
   */
  lockBase: DEFAULT_LOCK_BASE_CONFIG,
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
  /** Prefix for canvas-level execution locks */
  LOCK_EXECUTE_PREFIX: 'scalebox:execute:lock',
  /** Prefix for sandbox-level locks */
  LOCK_SANDBOX_PREFIX: 'scalebox:sandbox:lock',
} as const;
