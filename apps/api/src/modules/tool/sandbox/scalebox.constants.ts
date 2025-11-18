/**
 * Scalebox execution queue (internal queue, not exposed externally)
 */
export const SCALEBOX_EXECUTION_QUEUE = 'scaleboxExecution';

/**
 * Default configuration values for Scalebox
 */
export const SCALEBOX_DEFAULT_TIMEOUT = 30000;
export const SCALEBOX_DEFAULT_MAX_QUEUE_SIZE = 50;
export const SCALEBOX_DEFAULT_CONCURRENCY = 10;

/**
 * Default configuration values for Sandbox Pool
 */
export const SCALEBOX_DEFAULT_MAX_SANDBOXES = 10;
export const SCALEBOX_DEFAULT_MIN_REMAINING_MS = 2 * 60 * 1000; // 2 minutes
export const SCALEBOX_DEFAULT_EXTEND_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Maximum length for error messages (traceback, stderr, etc.)
 * Messages exceeding this length will be truncated with '[... more info]' suffix
 */
export const ERROR_MESSAGE_MAX_LENGTH = 1000;

/**
 * Sandbox ready state check configuration
 */
export const SANDBOX_MOUNT_WAIT_MS = 2000;

/**
 * S3 Default Configuration
 */
export const S3_DEFAULT_CONFIG = {
  endpoint: 's3.us-east-1.amazonaws.com',
  port: 443,
  useSSL: true,
  accessKey: '',
  secretKey: '',
  bucket: 'refly-devbox-private',
  region: 'us-east-1',
} as const;

/**
 * Fixed mount point inside sandbox
 * Canvas and sandbox have 1:1 mapping, no need to include canvasId in path
 */
export const SANDBOX_MOUNT_POINT = '/mnt/refly/canvas';

/**
 * Temporary S3 path prefix for development testing
 * Can be safely deleted after validation: aws s3 rm s3://bucket/tmp/perish/ --recursive
 */
export const S3_DEV_PATH_PREFIX = 'tmp/perish';
