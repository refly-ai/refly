/**
 * Webhook module constants
 */

// Rate limiting
export const WEBHOOK_RATE_LIMIT_RPM = 100; // Requests per minute
export const WEBHOOK_RATE_LIMIT_DAILY = 10000; // Requests per day
export const WEBHOOK_RATE_LIMIT_RPM_TTL = 60; // 1 minute in seconds
export const WEBHOOK_RATE_LIMIT_DAILY_TTL = 86400; // 24 hours in seconds

// Debounce
export const WEBHOOK_DEBOUNCE_TTL = 1; // 1 second

// Cache
export const WEBHOOK_CONFIG_CACHE_TTL = 300; // 5 minutes

// Webhook ID prefix
export const WEBHOOK_ID_PREFIX = 'wh_';
export const WEBHOOK_ID_LENGTH = 32;

// API call record status
export enum ApiCallStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

// Redis key prefixes
export const REDIS_KEY_WEBHOOK_RATE_LIMIT_RPM = 'webhook_rate_limit:rpm';
export const REDIS_KEY_WEBHOOK_RATE_LIMIT_DAILY = 'webhook_rate_limit:daily';
export const REDIS_KEY_WEBHOOK_DEBOUNCE = 'webhook_debounce';
export const REDIS_KEY_WEBHOOK_CONFIG = 'webhook_config';
