/**
 * Schedule CRUD Operations Baseline Test
 *
 * Purpose: Measure baseline performance of CRUD operations under normal load
 * Test Pattern: Stepped ramp-up to identify performance degradation thresholds
 *
 * Metrics collected:
 * - Response time percentiles (P50, P95, P99) for each operation
 * - Success rate per operation type
 * - Throughput (requests/second)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { config, getHeaders, defaultThresholds } from '../config.js';

// Custom metrics per operation type
const createDuration = new Trend('schedule_create_duration', true);
const listDuration = new Trend('schedule_list_duration', true);
const detailDuration = new Trend('schedule_detail_duration', true);
const updateDuration = new Trend('schedule_update_duration', true);
const deleteDuration = new Trend('schedule_delete_duration', true);
const crudErrors = new Counter('schedule_crud_errors');
const crudSuccessRate = new Rate('schedule_crud_success_rate');

// Test configuration with stepped ramp-up
export const options = {
  scenarios: {
    crud_baseline: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 }, // Warmup
        { duration: '1m', target: 10 }, // Light load
        { duration: '2m', target: 20 }, // Normal load
        { duration: '1m', target: 30 }, // Peak load
        { duration: '30s', target: 0 }, // Cooldown
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    ...defaultThresholds,
    schedule_create_duration: ['p(95)<1000'],
    schedule_list_duration: ['p(95)<500'],
    schedule_detail_duration: ['p(95)<300'],
    schedule_update_duration: ['p(95)<800'],
    schedule_delete_duration: ['p(95)<500'],
    schedule_crud_success_rate: ['rate>0.95'],
  },
};

// Generate unique schedule data per VU
function generateScheduleData(vuId) {
  const timestamp = Date.now();
  return {
    canvasId: config.testCanvasId,
    name: `LoadTest_${vuId}_${timestamp}`,
    cronExpression: '0 0 * * *', // Daily at midnight
    timezone: 'Asia/Shanghai',
    isEnabled: false, // Keep disabled to prevent actual execution
  };
}

// Main test function - Full CRUD cycle
export default function () {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const vuId = __VU;

  let createdScheduleId = null;

  // CREATE operation
  group('Create Schedule', () => {
    const data = generateScheduleData(vuId);
    const startTime = Date.now();

    const response = http.post(`${baseUrl}/v1/schedule/create`, JSON.stringify(data), {
      headers,
      timeout: config.timeout,
    });

    const duration = Date.now() - startTime;
    createDuration.add(duration);

    const success = check(response, {
      'create returns 200': (r) => r.status === 200 || r.status === 201,
      'create returns scheduleId': (r) => {
        try {
          const body = JSON.parse(r.body);
          createdScheduleId = body.data?.scheduleId;
          return !!createdScheduleId;
        } catch {
          return false;
        }
      },
    });

    recordResult(success);
  });

  sleep(0.5);

  // LIST operation
  group('List Schedules', () => {
    const startTime = Date.now();

    const response = http.post(
      `${baseUrl}/v1/schedule/list`,
      JSON.stringify({
        canvasId: config.testCanvasId,
        page: 1,
        pageSize: 10,
      }),
      { headers, timeout: config.timeout },
    );

    const duration = Date.now() - startTime;
    listDuration.add(duration);

    const success = check(response, {
      'list returns 200': (r) => r.status === 200 || r.status === 201,
      'list returns items array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data?.items);
        } catch {
          return false;
        }
      },
    });

    recordResult(success);
  });

  sleep(0.3);

  // DETAIL operation (only if create succeeded)
  if (createdScheduleId) {
    group('Get Schedule Detail', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/v1/schedule/detail`,
        JSON.stringify({ scheduleId: createdScheduleId }),
        { headers, timeout: config.timeout },
      );

      const duration = Date.now() - startTime;
      detailDuration.add(duration);

      const success = check(response, {
        'detail returns 200': (r) => r.status === 200 || r.status === 201,
        'detail returns correct scheduleId': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.data?.scheduleId === createdScheduleId;
          } catch {
            return false;
          }
        },
      });

      recordResult(success);
    });

    sleep(0.3);

    // UPDATE operation
    group('Update Schedule', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/v1/schedule/update`,
        JSON.stringify({
          scheduleId: createdScheduleId,
          name: `Updated_${Date.now()}`,
          cronExpression: '0 6 * * *', // Changed to 6 AM
        }),
        { headers, timeout: config.timeout },
      );

      const duration = Date.now() - startTime;
      updateDuration.add(duration);

      const success = check(response, {
        'update returns 200': (r) => r.status === 200 || r.status === 201,
      });

      recordResult(success);
    });

    sleep(0.3);

    // DELETE operation (cleanup)
    group('Delete Schedule', () => {
      const startTime = Date.now();

      const response = http.post(
        `${baseUrl}/v1/schedule/delete`,
        JSON.stringify({ scheduleId: createdScheduleId }),
        { headers, timeout: config.timeout },
      );

      const duration = Date.now() - startTime;
      deleteDuration.add(duration);

      const success = check(response, {
        'delete returns 200': (r) => r.status === 200 || r.status === 201,
      });

      recordResult(success);
    });
  }

  sleep(1);
}

// Helper to record success/failure
function recordResult(success) {
  if (success) {
    crudSuccessRate.add(1);
  } else {
    crudErrors.add(1);
    crudSuccessRate.add(0);
  }
}

// Generate summary report
export function handleSummary(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  CRUD BASELINE TEST REPORT');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const metrics = [
    { name: 'Create', key: 'schedule_create_duration' },
    { name: 'List', key: 'schedule_list_duration' },
    { name: 'Detail', key: 'schedule_detail_duration' },
    { name: 'Update', key: 'schedule_update_duration' },
    { name: 'Delete', key: 'schedule_delete_duration' },
  ];

  console.log('Operation Latencies (ms):');
  console.log('─────────────────────────────────────────────────────────');

  for (const m of metrics) {
    const metric = data.metrics[m.key];
    if (metric?.values) {
      const p50 = metric.values['p(50)']?.toFixed(0) || '-';
      const p95 = metric.values['p(95)']?.toFixed(0) || '-';
      const p99 = metric.values['p(99)']?.toFixed(0) || '-';
      console.log(
        `  ${m.name.padEnd(8)} P50: ${p50.padStart(6)}  P95: ${p95.padStart(6)}  P99: ${p99.padStart(6)}`,
      );
    }
  }

  const successRate = data.metrics.schedule_crud_success_rate;
  if (successRate) {
    console.log('');
    console.log(`Success Rate: ${(successRate.values.rate * 100).toFixed(2)}%`);
  }

  const errors = data.metrics.schedule_crud_errors;
  if (errors) {
    console.log(`Total Errors: ${errors.values.count}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  return {
    stdout: '',
    'results/schedule-crud-report.json': JSON.stringify(data, null, 2),
  };
}
