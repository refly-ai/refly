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
 * Maximum length for error messages (traceback, stderr, etc.)
 * Messages exceeding this length will be truncated with '[... more info]' suffix
 */
export const ERROR_MESSAGE_MAX_LENGTH = 1000;

/**
 * Sandbox ready state check configuration
 */
export const SANDBOX_MOUNT_WAIT_MS = 2000;

/**
 * S3 mount retry configuration
 * Retry on network failures or transient S3 service issues
 */
export const SANDBOX_MOUNT_MAX_RETRIES = 3;
export const SANDBOX_MOUNT_RETRY_DELAY_MS = 2000;

/**
 * Unmount verification polling configuration
 * Poll to verify FUSE lazy unmount completion
 */
export const SANDBOX_UNMOUNT_POLL_MAX_ATTEMPTS = 10;
export const SANDBOX_UNMOUNT_POLL_INTERVAL_MS = 200;

/**
 * Unmount stabilization delay
 * Additional wait time after unmount to allow kernel FUSE cleanup
 */
export const SANDBOX_UNMOUNT_STABILIZE_DELAY_MS = 500;

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
