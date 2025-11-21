/**
 * Default configuration values for Scalebox
 */
export const SCALEBOX_DEFAULT_TIMEOUT = 60000;

/**
 * Default configuration values for Sandbox Pool
 */
export const SCALEBOX_DEFAULT_MAX_SANDBOXES = 10;
export const SCALEBOX_DEFAULT_MIN_REMAINING_MS = 2 * 60 * 1000; // 2 minutes
export const SCALEBOX_DEFAULT_EXTEND_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

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
 * Canvas-level execution lock configuration
 * Controls concurrent execution timeout for the same canvas
 */
export const SCALEBOX_DEFAULT_LOCK_WAIT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const SCALEBOX_DEFAULT_LOCK_POLL_INTERVAL_MS = 100; // 100ms

/**
 * Maximum length for error messages (traceback, stderr, etc.)
 * Messages exceeding this length will be truncated with '[... more info]' suffix
 */
export const ERROR_MESSAGE_MAX_LENGTH = 1000;

/**
 * Mount verification polling configuration
 * Actively poll to verify mount readiness instead of fixed wait
 */
export const SANDBOX_MOUNT_VERIFICATION_TIMEOUT_MS = 5000;
export const SANDBOX_MOUNT_VERIFICATION_MAX_DELAY_MS = 500;

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
