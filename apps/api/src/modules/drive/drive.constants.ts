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

// Default allowed content types for CLI uploads
const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'text/markdown',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/json',
  'text/html',
  'text/xml',
  'application/xml',
];

/**
 * Get allowed content types for CLI uploads from environment or defaults
 */
function getAllowedContentTypes(): string[] {
  const env = process.env.CLI_UPLOAD_ALLOWED_CONTENT_TYPES;
  return env ? env.split(',').map((s) => s.trim()) : DEFAULT_ALLOWED_CONTENT_TYPES;
}

/**
 * Check if a content type is allowed for CLI uploads
 */
export function isContentTypeAllowed(contentType: string): boolean {
  const allowed = getAllowedContentTypes();
  return allowed.includes(contentType);
}
