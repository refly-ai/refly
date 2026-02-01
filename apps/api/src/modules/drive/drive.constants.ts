/**
 * Constants for CLI presigned upload feature
 */

// Presigned URL expiration time in seconds (default 10 minutes)
export const PRESIGNED_UPLOAD_EXPIRY = Number.parseInt(
  process.env.DRIVE_PRESIGN_EXPIRY || '600',
  10,
);

// Redis TTL for pending upload metadata (20 minutes)
export const PENDING_UPLOAD_REDIS_TTL = 20 * 60;

// Age threshold for cleaning up stale pending uploads (1 hour)
export const PENDING_UPLOAD_CLEANUP_AGE = 60 * 60 * 1000;

// Maximum file size for CLI uploads (50MB)
export const MAX_CLI_UPLOAD_SIZE = 50 * 1024 * 1024;

// Redis key prefix for pending uploads
export const PENDING_UPLOAD_REDIS_PREFIX = 'cli:drive:upload:';

/**
 * Check if a content type is allowed for CLI uploads
 * Note: All content types are now allowed (no restriction)
 */
export function isContentTypeAllowed(_contentType: string): boolean {
  return true;
}
