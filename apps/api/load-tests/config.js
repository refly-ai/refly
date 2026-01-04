/**
 * Shared configuration for load tests
 *
 * Required environment variables:
 * - K6_API_BASE_URL: API base URL (default: http://localhost:5800)
 * - K6_AUTH_TOKEN: Valid JWT authentication token
 * - K6_TEST_CANVAS_IDS: Comma-separated canvas IDs for testing
 */

// Read configuration from environment variables
export const config = {
  // API configuration
  baseUrl: __ENV.K6_API_BASE_URL || 'http://localhost:5800',
  authToken: __ENV.K6_AUTH_TOKEN || '',

  // Multiple test canvas IDs (comma-separated)
  testCanvasIds: (__ENV.K6_TEST_CANVAS_IDS || '').split(',').filter((id) => id.trim()),

  // Legacy single canvas ID support
  testCanvasId: __ENV.K6_TEST_CANVAS_ID || '',

  // Request timeout
  timeout: '60s', // Increased for stress tests

  // System limits (should match schedule.constants.ts)
  limits: {
    globalMaxConcurrent: 50,
    rateLimitMax: 100,
    rateLimitDurationMs: 60 * 1000,
    userMaxConcurrent: 20,
    userRateLimitDelayMs: 10 * 1000,
  },

  // High load test configuration
  highLoad: {
    maxVUs: 200,
    duration: '10m',
    rampUpTime: '2m',
    sustainTime: '5m',
    rampDownTime: '1m',
  },
};

// Get random canvas ID for distributed load
export function getRandomCanvasId() {
  const ids = config.testCanvasIds.length > 0 ? config.testCanvasIds : [config.testCanvasId];
  return ids[Math.floor(Math.random() * ids.length)];
}

// Common request headers
export function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.authToken}`,
  };
}

// Validate required configuration
export function validateConfig() {
  const errors = [];

  if (!config.authToken) {
    errors.push('K6_AUTH_TOKEN is required');
  }

  if (config.testCanvasIds.length === 0 && !config.testCanvasId) {
    errors.push('K6_TEST_CANVAS_IDS or K6_TEST_CANVAS_ID is required');
  }

  return errors;
}

// Default thresholds for all tests
export const defaultThresholds = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
  iteration_duration: ['avg<2000'],
};

// Strict thresholds for baseline tests
export const strictThresholds = {
  http_req_duration: ['p(50)<100', 'p(95)<300', 'p(99)<500'],
  http_req_failed: ['rate<0.001'],
};

// Relaxed thresholds for stress tests
export const relaxedThresholds = {
  http_req_duration: ['p(95)<3000', 'p(99)<10000'],
  http_req_failed: ['rate<0.2'],
};

// Production thresholds
export const productionThresholds = {
  http_req_duration: ['p(50)<200', 'p(95)<800', 'p(99)<2000'],
  http_req_failed: ['rate<0.02'],
  http_reqs: ['rate>10'],
};

// Extreme stress thresholds (for finding breaking points)
export const stressThresholds = {
  http_req_duration: ['p(95)<5000', 'p(99)<15000'],
  http_req_failed: ['rate<0.3'], // Allow up to 30% failures to find limits
};
