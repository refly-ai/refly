/**
 * Scalebox Default Configuration (flat structure)
 */
export const SCALEBOX_DEFAULTS = {
  // Sandbox
  SANDBOX_TIMEOUT_MS: 60 * 60 * 1000, // 1 hour

  // Pool
  MAX_SANDBOXES: 5,
  LOCAL_CONCURRENCY: 2,
  MAX_QUEUE_SIZE: 100,
  AUTO_PAUSE_DELAY_MS: 2 * 60 * 1000, // 2 minutes

  // Lock
  RUN_CODE_TIMEOUT_SEC: 5 * 60, // 5 minutes
  FILE_BUFFER_SEC: 30,
  DRIVE_BUFFER_SEC: 30,
  QUEUE_DEPTH: 2,
  LOCK_POLL_INTERVAL_MS: 100,
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
  ACTIVE_SET: 'scalebox:pool:active',
  LOCK_EXECUTE_PREFIX: 'scalebox:execute:lock',
  LOCK_SANDBOX_PREFIX: 'scalebox:sandbox:lock',
} as const;
