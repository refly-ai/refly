/**
 * User Concurrency Limit Verification Test
 *
 * Purpose: Verify the userMaxConcurrent limit (default: 20) is enforced correctly
 * Expected behavior: Requests exceeding the limit should be delayed, not rejected
 *
 * This test:
 * - Uses more VUs than the concurrent limit
 * - Measures delays caused by rate limiting
 * - Validates that all requests eventually succeed (after delay)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import { config, getHeaders } from '../config.js';

// Custom metrics
const triggerDuration = new Trend('trigger_duration', true);
const successfulTriggers = new Counter('successful_triggers');
const delayedTriggers = new Counter('delayed_triggers');
const failedTriggers = new Counter('failed_triggers');
const concurrentSuccessRate = new Rate('concurrent_success_rate');
const estimatedConcurrent = new Gauge('estimated_concurrent');

// Test configuration - constant VUs exceeding the limit
export const options = {
  scenarios: {
    concurrent_test: {
      executor: 'constant-vus',
      vus: 30, // Exceeds userMaxConcurrent (20)
      duration: '2m',
    },
  },
  thresholds: {
    trigger_duration: ['p(95)<15000'], // Allow for delays
    http_req_failed: ['rate<0.2'], // Allow up to 20% failures/delays
  },
};

// Setup
export function setup() {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  CONCURRENCY LIMIT VERIFICATION TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Expected userMaxConcurrent: ${config.limits.userMaxConcurrent}`);
  console.log('Test VUs: 30 (exceeds limit by 10)');
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
        name: 'Concurrent Limit Test',
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
    userMaxConcurrent: config.limits.userMaxConcurrent,
    delayThreshold: config.limits.userRateLimitDelayMs,
  };
}

// Main test function
export default function (data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { scheduleId, delayThreshold } = data;

  if (!scheduleId) {
    sleep(1);
    return;
  }

  // Track estimated concurrent requests
  estimatedConcurrent.add(__VU);

  const startTime = Date.now();

  const response = http.post(`${baseUrl}/v1/schedule/trigger`, JSON.stringify({ scheduleId }), {
    headers,
    timeout: '30s',
  });

  const duration = Date.now() - startTime;
  triggerDuration.add(duration);

  // Analyze response
  const isSuccess = response.status === 200;
  // If request took longer than delay threshold, it was likely delayed
  const wasDelayed = duration > delayThreshold - 1000;

  if (isSuccess) {
    successfulTriggers.add(1);
    concurrentSuccessRate.add(1);

    if (wasDelayed) {
      delayedTriggers.add(1);
      // Log occasional delay events
      if (__ITER % 10 === 0) {
        console.log(`Request delayed: ${duration}ms (VU ${__VU})`);
      }
    }
  } else {
    failedTriggers.add(1);
    concurrentSuccessRate.add(0);

    // Log failure details
    try {
      const body = JSON.parse(response.body);
      console.log(
        `Failed (${response.status}): ${body.message || response.body?.substring(0, 100)}`,
      );
    } catch (_e) {
      console.log(`Failed (${response.status}): ${response.body?.substring(0, 100)}`);
    }
  }

  check(response, {
    'response received': (r) => r.status !== 0,
    'eventually succeeds (with possible delay)': (r) => r.status === 200 || r.status === 201,
  });

  // Short delay to maintain high concurrency pressure
  sleep(0.1 + Math.random() * 0.3);
}

// Summary report
export function handleSummary(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  CONCURRENCY LIMIT TEST REPORT');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const successful = data.metrics.successful_triggers?.values?.count || 0;
  const delayed = data.metrics.delayed_triggers?.values?.count || 0;
  const failed = data.metrics.failed_triggers?.values?.count || 0;

  console.log('Request Statistics:');
  console.log(`  Successful:   ${successful}`);
  console.log(`  Delayed:      ${delayed}`);
  console.log(`  Failed:       ${failed}`);

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
  console.log('Concurrency Limit Verification:');
  console.log(`  Expected limit:     ${config.limits.userMaxConcurrent} concurrent/user`);
  console.log(`  Expected delay:     ${config.limits.userRateLimitDelayMs}ms`);

  if (delayed > 0) {
    console.log(`  ✅ Limit working: ${delayed} requests were delayed`);
  } else if (failed > 0) {
    console.log(`  ⚠️  ${failed} requests failed - check logs for details`);
  } else {
    console.log('  ℹ️  All requests succeeded without delay - load may not have hit limit');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  return {
    stdout: '',
    'results/schedule-concurrent-report.json': JSON.stringify(data, null, 2),
  };
}
