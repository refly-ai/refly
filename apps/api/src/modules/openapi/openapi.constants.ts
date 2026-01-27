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

// Cache
export const OPENAPI_CONFIG_CACHE_TTL = 300; // 5 minutes

// Redis keys
export const REDIS_KEY_OPENAPI_RATE_LIMIT_RPM = 'openapi:rate_limit:rpm';
export const REDIS_KEY_OPENAPI_RATE_LIMIT_DAILY = 'openapi:rate_limit:daily';
export const REDIS_KEY_OPENAPI_DEBOUNCE = 'openapi:debounce';
export const REDIS_KEY_OPENAPI_CONFIG = 'openapi:config';

// File upload
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILES_PER_REQUEST = 10;
