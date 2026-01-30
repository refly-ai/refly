/**
 * OpenAPI constants
 */

// Rate limiting
export const OPENAPI_RATE_LIMIT_RPM = 100; // Requests per minute
export const OPENAPI_RATE_LIMIT_DAILY = 10000; // Requests per day
export const OPENAPI_RATE_LIMIT_RPM_TTL = 60; // 1 minute in seconds
export const OPENAPI_RATE_LIMIT_DAILY_TTL = 86400; // 24 hours in seconds

// Debounce
export const OPENAPI_DEBOUNCE_TTL = 1; // 1 second

// Temporary file retention (seconds)
export const OPENAPI_UPLOAD_TTL_SECONDS = 24 * 60 * 60; // 24 hours

// Redis keys
export const REDIS_KEY_OPENAPI_RATE_LIMIT_RPM = 'openapi:rate_limit:rpm';
export const REDIS_KEY_OPENAPI_RATE_LIMIT_DAILY = 'openapi:rate_limit:daily';
export const REDIS_KEY_OPENAPI_DEBOUNCE = 'openapi:debounce';

// File upload
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILES_PER_REQUEST = 10;
