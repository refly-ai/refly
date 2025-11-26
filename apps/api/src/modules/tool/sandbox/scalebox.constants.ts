/**
 * Scalebox Default Configuration (flat structure)
 *
 * Note: These values serve as defaults for runtime-configurable options.
 * LOCAL_CONCURRENCY is compile-time only (used directly in @Processor decorator).
 */
export const SCALEBOX_DEFAULTS = {
  // Sandbox
  SANDBOX_TIMEOUT_MS: 60 * 60 * 1000, // 1 hour

  // Pool
  MAX_SANDBOXES: 10,
  LOCAL_CONCURRENCY: 5, // Compile-time constant, not env-configurable
  MAX_QUEUE_SIZE: 100,
  AUTO_PAUSE_DELAY_MS: 2 * 60 * 1000, // 2 minutes

  // Lock
  RUN_CODE_TIMEOUT_SEC: 5 * 60, // 5 minutes
  LOCK_WAIT_TIMEOUT_SEC: 60, // Max time to wait for lock acquisition
  LOCK_POLL_INTERVAL_MS: 100,
  LOCK_INITIAL_TTL_SEC: 10, // Short initial TTL, renewed periodically
  LOCK_RENEWAL_INTERVAL_MS: 3000, // Renew every 3s (should be < TTL/2)

  // Retry (for transient gRPC errors like UNAVAILABLE)
  COMMAND_RETRY_MAX_ATTEMPTS: 4, // 4 attempts = 3 retries
  COMMAND_RETRY_DELAY_MS: 500, // Fixed interval
} as const;

// gRPC error codes from @connectrpc/connect
export const GRPC_CODE = {
  UNAVAILABLE: 14, // Service temporarily unavailable, safe to retry
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
