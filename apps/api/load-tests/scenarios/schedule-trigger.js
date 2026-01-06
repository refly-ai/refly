/**
 * Schedule Manual Trigger Stress Test
 *
 * Purpose: Test system behavior under heavy trigger load with sudden traffic spikes
 * Pattern: Spike test - rapid increase to peak, sustained load, gradual decrease
 *
 * This test validates:
 * - Queue processing capacity under load
 * - Rate limiting effectiveness
 * - System recovery after spike
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import { config, getHeaders, relaxedThresholds } from '../config.js';

// Custom metrics
const triggerDuration = new Trend('schedule_trigger_duration', true);
const triggerErrors = new Counter('schedule_trigger_errors');
const triggerSuccess = new Counter('schedule_trigger_success');
const triggerSuccessRate = new Rate('schedule_trigger_success_rate');
const activeVUs = new Gauge('active_virtual_users');

// Spike test configuration
export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 }, // Quick warmup
        { duration: '20s', target: 50 }, // Rapid spike
        { duration: '30s', target: 50 }, // Hold peak
        { duration: '20s', target: 10 }, // Quick drop
        { duration: '20s', target: 10 }, // Stabilize
        { duration: '10s', target: 0 }, // Cooldown
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    ...relaxedThresholds,
    schedule_trigger_duration: ['p(95)<5000', 'p(99)<10000'],
    schedule_trigger_success_rate: ['rate>0.90'], // Allow 10% failures during stress
  },
};

// Setup - Create test schedule for triggering
export function setup() {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  TRIGGER STRESS TEST - Setup');
  console.log('═══════════════════════════════════════════════════════');

  // Find existing schedule or create new one
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
      // Use first existing schedule
      scheduleId = listBody.data.items[0].scheduleId;
      console.log(`Using existing schedule: ${scheduleId}`);
    }
  } catch (_e) {
    console.log('No existing schedule found, creating new one...');
  }

  // Create new schedule if none exists
  if (!scheduleId) {
    const createResponse = http.post(
      `${baseUrl}/v1/schedule/create`,
      JSON.stringify({
        canvasId: config.testCanvasId,
        name: 'Trigger Stress Test Schedule',
        cronExpression: '0 0 1 1 *', // Once a year (won't auto-trigger)
        timezone: 'Asia/Shanghai',
        isEnabled: true, // Must be enabled for triggering
      }),
      { headers, timeout: config.timeout },
    );

    try {
      const body = JSON.parse(createResponse.body);
      scheduleId = body.data?.scheduleId;
      console.log(`Created new schedule: ${scheduleId}`);
    } catch (_e) {
      console.error('Failed to create test schedule');
    }
  }

  console.log('───────────────────────────────────────────────────────');
  console.log('');

  return { scheduleId };
}

// Main test function - Trigger operations
export default function (data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { scheduleId } = data;

  activeVUs.add(__VU);

  if (!scheduleId) {
    console.error('No scheduleId available, skipping test');
    sleep(1);
    return;
  }

  group('Trigger Schedule', () => {
    const startTime = Date.now();

    const response = http.post(`${baseUrl}/v1/schedule/trigger`, JSON.stringify({ scheduleId }), {
      headers,
      timeout: '30s',
    });

    const duration = Date.now() - startTime;
    triggerDuration.add(duration);

    const success = check(response, {
      'trigger returns 200': (r) => r.status === 200 || r.status === 201,
      'trigger returns scheduleRecordId': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!body.data?.scheduleRecordId;
        } catch {
          return false;
        }
      },
    });

    if (success) {
      triggerSuccess.add(1);
      triggerSuccessRate.add(1);
    } else {
      triggerErrors.add(1);
      triggerSuccessRate.add(0);

      // Log failure reason
      if (response.status === 429) {
        console.log(`Rate limited - VU ${__VU}`);
      } else if (response.status >= 400) {
        console.log(`Error ${response.status}: ${response.body?.substring(0, 100)}`);
      }
    }
  });

  // Randomized think time to simulate real users
  sleep(0.5 + Math.random() * 1.5);
}

// Cleanup
export function teardown(_data) {
  console.log('');
  console.log('Teardown: Test schedule records preserved for analysis.');
  console.log('Clean up manually if needed.');
}

// Summary report
export function handleSummary(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TRIGGER STRESS TEST REPORT');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const triggerMetric = data.metrics.schedule_trigger_duration;
  if (triggerMetric?.values) {
    console.log('Trigger Response Time:');
    console.log(`  Min:  ${triggerMetric.values.min?.toFixed(0)}ms`);
    console.log(`  Avg:  ${triggerMetric.values.avg?.toFixed(0)}ms`);
    console.log(`  P50:  ${triggerMetric.values['p(50)']?.toFixed(0)}ms`);
    console.log(`  P95:  ${triggerMetric.values['p(95)']?.toFixed(0)}ms`);
    console.log(`  P99:  ${triggerMetric.values['p(99)']?.toFixed(0)}ms`);
    console.log(`  Max:  ${triggerMetric.values.max?.toFixed(0)}ms`);
  }

  const successCount = data.metrics.schedule_trigger_success?.values?.count || 0;
  const errorCount = data.metrics.schedule_trigger_errors?.values?.count || 0;
  const total = successCount + errorCount;

  console.log('');
  console.log('Request Statistics:');
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed:     ${errorCount}`);
  console.log(`  Total:      ${total}`);
  console.log(`  Success Rate: ${total > 0 ? ((successCount / total) * 100).toFixed(2) : 0}%`);

  const httpReqs = data.metrics.http_reqs;
  if (httpReqs?.values) {
    console.log(`  Throughput: ${httpReqs.values.rate?.toFixed(2)} req/s`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  return {
    stdout: '',
    'results/schedule-trigger-report.json': JSON.stringify(data, null, 2),
  };
}
