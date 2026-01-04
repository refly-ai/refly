/**
 * Schedule API Read Performance Test
 *
 * Purpose: Measure read API performance under load
 * Focus: List and Detail operations (most common production operations)
 *
 * This test avoids CRUD limitations (unique constraint per canvas)
 * by focusing on read operations which are the most common in production.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { config, getHeaders, productionThresholds } from '../config.js';

// Custom metrics
const listDuration = new Trend('schedule_list_duration', true);
const detailDuration = new Trend('schedule_detail_duration', true);
const recordsDuration = new Trend('schedule_records_duration', true);
const toolsDuration = new Trend('schedule_tools_duration', true);
const readErrors = new Counter('schedule_read_errors');
const readSuccessRate = new Rate('schedule_read_success_rate');

// Test configuration
export const options = {
  scenarios: {
    read_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 }, // Warmup
        { duration: '1m', target: 30 }, // Normal load
        { duration: '1m', target: 50 }, // Peak load
        { duration: '1m', target: 70 }, // Stress
        { duration: '30s', target: 30 }, // Recovery
        { duration: '30s', target: 0 }, // Cooldown
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    ...productionThresholds,
    schedule_list_duration: ['p(95)<300', 'p(99)<500'],
    schedule_detail_duration: ['p(95)<200', 'p(99)<400'],
    schedule_records_duration: ['p(95)<400', 'p(99)<800'],
    schedule_read_success_rate: ['rate>0.98'],
  },
};

// Setup - Find existing schedules to test with
export function setup() {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  READ PERFORMANCE TEST - Setup');
  console.log('═══════════════════════════════════════════════════════');

  // Get existing schedule
  const listResponse = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({ page: 1, pageSize: 100 }),
    { headers, timeout: config.timeout },
  );

  let scheduleId = null;

  try {
    const body = JSON.parse(listResponse.body);
    if (body.data?.items?.length > 0) {
      scheduleId = body.data.items[0].scheduleId;
      console.log(`Using existing schedule: ${scheduleId}`);
      console.log(`Total schedules found: ${body.data.total}`);
    } else {
      console.log('No existing schedules - will test list and records APIs only');
    }
  } catch (_e) {
    console.log('Failed to parse list response');
  }

  console.log('───────────────────────────────────────────────────────');
  console.log('');

  return {
    scheduleId,
    canvasId: config.testCanvasId,
  };
}

// Main test function - Read operations
export default function (data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { scheduleId } = data;

  // Random read operation distribution
  const rand = Math.random() * 100;

  if (rand < 40) {
    // 40% - List schedules
    group('List Schedules', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/v1/schedule/list`,
        JSON.stringify({
          page: 1,
          pageSize: 20,
        }),
        { headers, timeout: config.timeout },
      );

      listDuration.add(Date.now() - startTime);
      recordResult(response);
    });
  } else if (rand < 70) {
    // 30% - List records
    group('List Records', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/v1/schedule/records/list`,
        JSON.stringify({
          page: 1,
          pageSize: 20,
        }),
        { headers, timeout: config.timeout },
      );

      recordsDuration.add(Date.now() - startTime);
      recordResult(response);
    });
  } else if (rand < 90 && scheduleId) {
    // 20% - Get schedule detail (only if we have a schedule)
    group('Get Detail', () => {
      const startTime = Date.now();

      const response = http.post(`${baseUrl}/v1/schedule/detail`, JSON.stringify({ scheduleId }), {
        headers,
        timeout: config.timeout,
      });

      detailDuration.add(Date.now() - startTime);
      recordResult(response);
    });
  } else {
    // 10% - Get tools
    group('Get Tools', () => {
      const startTime = Date.now();

      const response = http.post(`${baseUrl}/v1/schedule/records/tools`, JSON.stringify({}), {
        headers,
        timeout: config.timeout,
      });

      toolsDuration.add(Date.now() - startTime);
      recordResult(response);
    });
  }

  // Short think time
  sleep(0.1 + Math.random() * 0.3);
}

// Helper to record result
function recordResult(response) {
  const success = check(response, {
    'status is success': (r) => r.status === 200 || r.status === 201,
    'response has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    readSuccessRate.add(1);
  } else {
    readErrors.add(1);
    readSuccessRate.add(0);
  }
}

// Summary report
export function handleSummary(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  READ PERFORMANCE TEST REPORT');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const metrics = [
    { name: 'List', key: 'schedule_list_duration' },
    { name: 'Detail', key: 'schedule_detail_duration' },
    { name: 'Records', key: 'schedule_records_duration' },
    { name: 'Tools', key: 'schedule_tools_duration' },
  ];

  console.log('Read Latencies (ms):');
  console.log('─────────────────────────────────────────────────────────');

  for (const m of metrics) {
    const metric = data.metrics[m.key];
    if (metric?.values) {
      const avg = metric.values.avg?.toFixed(0) || '-';
      const p50 = metric.values['p(50)']?.toFixed(0) || '-';
      const p95 = metric.values['p(95)']?.toFixed(0) || '-';
      const p99 = metric.values['p(99)']?.toFixed(0) || '-';
      console.log(
        `  ${m.name.padEnd(8)} Avg: ${avg.padStart(5)}  P50: ${p50.padStart(5)}  P95: ${p95.padStart(5)}  P99: ${p99.padStart(5)}`,
      );
    }
  }

  const successRate = data.metrics.schedule_read_success_rate;
  if (successRate) {
    console.log('');
    console.log(`Success Rate: ${(successRate.values.rate * 100).toFixed(2)}%`);
  }

  const httpReqs = data.metrics.http_reqs;
  if (httpReqs?.values) {
    console.log(`Throughput: ${httpReqs.values.rate?.toFixed(2)} req/s`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  return {
    stdout: '',
    'results/schedule-read-report.json': JSON.stringify(data, null, 2),
  };
}
