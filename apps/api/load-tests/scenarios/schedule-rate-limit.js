/**
 * Global Rate Limit Verification Test
 *
 * Purpose: Verify the global rate limit (100 requests/minute) is enforced
 * Expected behavior: Requests exceeding the limit should be delayed by BullMQ
 *
 * Test Pattern:
 * - Phase 1: Burst - Send requests faster than the limit allows
 * - Phase 2: Recovery - Reduce rate to observe system recovery
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import { config, getHeaders } from '../config.js';

// Custom metrics
const triggerDuration = new Trend('trigger_duration', true);
const successfulRequests = new Counter('successful_requests');
const rateLimitedRequests = new Counter('rate_limited_requests');
const failedRequests = new Counter('failed_requests');
const requestRate = new Gauge('request_rate_per_second');
const rateLimitSuccessRate = new Rate('rate_limit_success_rate');

// Test configuration with constant arrival rate
export const options = {
  scenarios: {
    // Phase 1: Burst - 200 req/s (way over 100/min limit)
    burst_phase: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
    // Phase 2: Recovery - 50 req/min (below limit)
    recovery_phase: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1m',
      duration: '1m',
      preAllocatedVUs: 10,
      maxVUs: 20,
      startTime: '35s',
    },
  },
  thresholds: {
    trigger_duration: ['p(95)<20000'], // Allow for delays
    // Note: We expect many requests to be delayed, not failed
  },
};

// Setup
export function setup() {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  RATE LIMIT VERIFICATION TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(
    `Expected rate limit: ${config.limits.rateLimitMax} requests per ${config.limits.rateLimitDurationMs / 1000}s`,
  );
  console.log('───────────────────────────────────────────────────────');

  // Get or create test schedule
  const listResponse = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({
      canvasId: config.testCanvasId,
      page: 1,
      pageSize: 100,
    }),
    { headers, timeout: config.timeout },
  );

  let scheduleId = null;

  try {
    const listBody = JSON.parse(listResponse.body);
    if (listBody.data?.items?.length > 0) {
      scheduleId = listBody.data.items[0].scheduleId;
      console.log(`Using existing schedule: ${scheduleId}`);
    }
  } catch (_e) {
    // ignore
  }

  if (!scheduleId) {
    const createResponse = http.post(
      `${baseUrl}/v1/schedule/create`,
      JSON.stringify({
        canvasId: config.testCanvasId,
        name: 'Rate Limit Test',
        cronExpression: '0 0 1 1 *',
        timezone: 'Asia/Shanghai',
        isEnabled: true,
      }),
      { headers, timeout: config.timeout },
    );

    try {
      const body = JSON.parse(createResponse.body);
      scheduleId = body.data?.scheduleId;
      console.log(`Created test schedule: ${scheduleId}`);
    } catch (_e) {
      console.error('Failed to create test schedule');
    }
  }

  console.log('');

  return {
    scheduleId,
    startTime: Date.now(),
  };
}

// Main test function
export default function (data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { scheduleId, startTime } = data;

  if (!scheduleId) {
    sleep(0.1);
    return;
  }

  // Calculate current request rate
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  requestRate.add(__ITER / elapsedSeconds);

  const reqStartTime = Date.now();

  const response = http.post(`${baseUrl}/v1/schedule/trigger`, JSON.stringify({ scheduleId }), {
    headers,
    timeout: '30s',
  });

  const duration = Date.now() - reqStartTime;
  triggerDuration.add(duration);

  // Analyze response
  if (response.status === 200) {
    successfulRequests.add(1);
    rateLimitSuccessRate.add(1);

    // Long duration indicates rate limiting delay
    if (duration > 5000) {
      rateLimitedRequests.add(1);
      // Log occasionally
      if (__ITER % 20 === 0) {
        console.log(`Request delayed by rate limiter: ${duration}ms`);
      }
    }
  } else if (response.status === 429) {
    // HTTP 429 Too Many Requests
    rateLimitedRequests.add(1);
    rateLimitSuccessRate.add(0);
  } else {
    failedRequests.add(1);
    rateLimitSuccessRate.add(0);
    console.log(`Request failed (${response.status}): ${response.body?.substring(0, 100)}`);
  }

  check(response, {
    'request processed': (r) => r.status === 200 || r.status === 429,
  });
}

// Summary report
export function handleSummary(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  RATE LIMIT TEST REPORT');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const successful = data.metrics.successful_requests?.values?.count || 0;
  const rateLimited = data.metrics.rate_limited_requests?.values?.count || 0;
  const failed = data.metrics.failed_requests?.values?.count || 0;
  const total = successful + rateLimited + failed;

  console.log('Request Statistics:');
  console.log(`  Successful:    ${successful}`);
  console.log(`  Rate Limited:  ${rateLimited}`);
  console.log(`  Failed:        ${failed}`);
  console.log(`  Total:         ${total}`);

  const httpReqs = data.metrics.http_reqs;
  if (httpReqs?.values) {
    console.log(`  Actual Rate:   ${httpReqs.values.rate?.toFixed(2)} req/s`);
  }

  const triggerMetric = data.metrics.trigger_duration;
  if (triggerMetric?.values) {
    console.log('');
    console.log('Response Time Distribution:');
    console.log(`  Min:  ${triggerMetric.values.min?.toFixed(0)}ms`);
    console.log(`  Avg:  ${triggerMetric.values.avg?.toFixed(0)}ms`);
    console.log(`  P50:  ${triggerMetric.values['p(50)']?.toFixed(0)}ms`);
    console.log(`  P95:  ${triggerMetric.values['p(95)']?.toFixed(0)}ms`);
    console.log(`  P99:  ${triggerMetric.values['p(99)']?.toFixed(0)}ms`);
    console.log(`  Max:  ${triggerMetric.values.max?.toFixed(0)}ms`);
  }

  console.log('');
  console.log('Rate Limit Verification:');
  console.log(
    `  Configured limit: ${config.limits.rateLimitMax} requests/${config.limits.rateLimitDurationMs / 1000}s`,
  );

  if (rateLimited > 0) {
    const limitRatio = ((rateLimited / total) * 100).toFixed(2);
    console.log(
      `  ✅ Rate limiting active: ${rateLimited} requests delayed/limited (${limitRatio}%)`,
    );
  } else {
    console.log('  ℹ️  No rate limiting observed - request rate may not have exceeded threshold');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  return {
    stdout: '',
    'results/schedule-rate-limit-report.json': JSON.stringify(data, null, 2),
  };
}
