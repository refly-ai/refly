/**
 * Extreme Stress Test - Find Performance Limits
 *
 * Purpose: Push the system to its limits to discover:
 * - Slow queries in workflow_schedules
 * - Index bottlenecks
 * - Database connection pool exhaustion
 * - API response degradation patterns
 *
 * Test Profile:
 * - Ramp up to 200 VUs
 * - Sustained high load for 5 minutes
 * - Multiple canvas IDs for distributed CRUD
 * - Heavy write operations to stress the database
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import { config, getHeaders, stressThresholds } from '../config.js';

// ============================================================================
// Custom Metrics - Detailed Latency Tracking
// ============================================================================

// Read operations
const listLatency = new Trend('list_latency', true);
const listByCanvasLatency = new Trend('list_by_canvas_latency', true);
const _detailLatency = new Trend('detail_latency', true);
const recordsListLatency = new Trend('records_list_latency', true);

// Write operations
const createLatency = new Trend('create_latency', true);
const updateLatency = new Trend('update_latency', true);
const deleteLatency = new Trend('delete_latency', true);
const triggerLatency = new Trend('trigger_latency', true);

// Error tracking
const dbErrors = new Counter('database_errors');
const timeoutErrors = new Counter('timeout_errors');
const rateLimitErrors = new Counter('rate_limit_errors');
const validationErrors = new Counter('validation_errors');
const unknownErrors = new Counter('unknown_errors');

// Success tracking
const totalSuccess = new Counter('total_success');
const totalFailure = new Counter('total_failure');
const successRate = new Rate('success_rate');

// Latency thresholds detection
const slowQueries = new Counter('slow_queries_over_500ms');
const verySlowQueries = new Counter('very_slow_queries_over_2000ms');
const criticalQueries = new Counter('critical_queries_over_5000ms');

// System metrics
const activeVUs = new Gauge('active_vus');
const _errorRate = new Gauge('current_error_rate');

// ============================================================================
// Test Configuration - Extreme Stress
// ============================================================================
export const options = {
  scenarios: {
    // Phase 1: Warmup (1 min)
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '30s', target: 40 },
      ],
      exec: 'mixedWorkload',
    },

    // Phase 2: Ramp to High Load (2 min)
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 40,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '1m', target: 150 },
      ],
      startTime: '1m',
      exec: 'mixedWorkload',
    },

    // Phase 3: Sustained Extreme Load (5 min)
    extreme_load: {
      executor: 'constant-vus',
      vus: 150,
      duration: '5m',
      startTime: '3m',
      exec: 'heavyWriteWorkload',
    },

    // Phase 4: Spike to Max (1 min)
    spike: {
      executor: 'ramping-vus',
      startVUs: 150,
      stages: [
        { duration: '20s', target: 200 },
        { duration: '30s', target: 200 },
        { duration: '10s', target: 150 },
      ],
      startTime: '8m',
      exec: 'heavyWriteWorkload',
    },

    // Phase 5: Recovery (1 min)
    recovery: {
      executor: 'ramping-vus',
      startVUs: 150,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 0 },
      ],
      startTime: '9m',
      exec: 'mixedWorkload',
    },
  },

  thresholds: {
    ...stressThresholds,
    list_latency: ['p(95)<1000', 'p(99)<3000'],
    list_by_canvas_latency: ['p(95)<1000', 'p(99)<3000'],
    records_list_latency: ['p(95)<1500', 'p(99)<5000'],
    create_latency: ['p(95)<2000', 'p(99)<5000'],
    trigger_latency: ['p(95)<5000', 'p(99)<10000'],
    success_rate: ['rate>0.7'], // Expect some failures under extreme load
  },
};

// ============================================================================
// Setup - Prepare test data
// ============================================================================
export function setup() {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const canvasIds = config.testCanvasIds.length > 0 ? config.testCanvasIds : [config.testCanvasId];

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     EXTREME STRESS TEST - Finding Performance Limits      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Start Time: ${new Date().toISOString()}`);
  console.log(`API Base URL: ${baseUrl}`);
  console.log(`Canvas IDs: ${canvasIds.join(', ')}`);
  console.log('Max VUs: 200');
  console.log('Test Duration: ~10 minutes');
  console.log('');
  console.log('Test Phases:');
  console.log('  [0-1m]   Warmup: 0 → 40 VUs');
  console.log('  [1-3m]   Ramp: 40 → 150 VUs');
  console.log('  [3-8m]   Sustained: 150 VUs (heavy writes)');
  console.log('  [8-9m]   Spike: 150 → 200 VUs');
  console.log('  [9-10m]  Recovery: 150 → 0 VUs');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Verify API connectivity
  const healthCheck = http.get(`${baseUrl}/`, { timeout: '10s' });
  if (healthCheck.status === 0) {
    console.error('ERROR: Cannot reach API server');
    return { error: 'API unreachable', canvasIds: [] };
  }

  // Get existing schedules for each canvas
  const schedulesByCanvas = {};

  for (const canvasId of canvasIds) {
    const listResp = http.post(
      `${baseUrl}/v1/schedule/list`,
      JSON.stringify({ canvasId, page: 1, pageSize: 100 }),
      { headers, timeout: '15s' },
    );

    try {
      const body = JSON.parse(listResp.body);
      if (body.data?.items?.length > 0) {
        schedulesByCanvas[canvasId] = body.data.items.map((s) => s.scheduleId);
        console.log(`Canvas ${canvasId}: ${body.data.items.length} existing schedule(s)`);
      } else {
        schedulesByCanvas[canvasId] = [];
        console.log(`Canvas ${canvasId}: No existing schedules`);
      }
    } catch (_e) {
      schedulesByCanvas[canvasId] = [];
    }
  }

  console.log('');

  return {
    canvasIds,
    schedulesByCanvas,
    startTime: Date.now(),
  };
}

// ============================================================================
// Mixed Workload (70% Read, 30% Write)
// ============================================================================
export function mixedWorkload(data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { canvasIds, schedulesByCanvas } = data;

  activeVUs.add(__VU);

  const rand = Math.random() * 100;

  if (rand < 35) {
    performListAll(headers, baseUrl);
  } else if (rand < 55) {
    performListByCanvas(headers, baseUrl, canvasIds);
  } else if (rand < 70) {
    performRecordsList(headers, baseUrl);
  } else if (rand < 85) {
    performCrudCycle(headers, baseUrl, canvasIds, schedulesByCanvas);
  } else {
    performTrigger(headers, baseUrl, schedulesByCanvas);
  }

  sleep(0.1 + Math.random() * 0.3);
}

// ============================================================================
// Heavy Write Workload (30% Read, 70% Write) - For stress testing DB
// ============================================================================
export function heavyWriteWorkload(data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { canvasIds, schedulesByCanvas } = data;

  activeVUs.add(__VU);

  const rand = Math.random() * 100;

  if (rand < 15) {
    performListAll(headers, baseUrl);
  } else if (rand < 30) {
    performRecordsList(headers, baseUrl);
  } else if (rand < 60) {
    performCrudCycle(headers, baseUrl, canvasIds, schedulesByCanvas);
  } else {
    performTrigger(headers, baseUrl, schedulesByCanvas);
  }

  // Shorter sleep for higher pressure
  sleep(0.05 + Math.random() * 0.15);
}

// ============================================================================
// Operation Implementations
// ============================================================================

function performListAll(headers, baseUrl) {
  const start = Date.now();

  const response = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({ page: 1, pageSize: 50 }),
    { headers, timeout: config.timeout },
  );

  const duration = Date.now() - start;
  listLatency.add(duration);
  trackSlowQuery(duration);
  recordResult(response, 'list');
}

function performListByCanvas(headers, baseUrl, canvasIds) {
  const canvasId = canvasIds[Math.floor(Math.random() * canvasIds.length)];
  const start = Date.now();

  const response = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({ canvasId, page: 1, pageSize: 50 }),
    { headers, timeout: config.timeout },
  );

  const duration = Date.now() - start;
  listByCanvasLatency.add(duration);
  trackSlowQuery(duration);
  recordResult(response, 'list_by_canvas');
}

function performRecordsList(headers, baseUrl) {
  const start = Date.now();

  const response = http.post(
    `${baseUrl}/v1/schedule/records/list`,
    JSON.stringify({ page: 1, pageSize: 50 }),
    { headers, timeout: config.timeout },
  );

  const duration = Date.now() - start;
  recordsListLatency.add(duration);
  trackSlowQuery(duration);
  recordResult(response, 'records_list');
}

function performCrudCycle(headers, baseUrl, canvasIds, _schedulesByCanvas) {
  const canvasId = canvasIds[Math.floor(Math.random() * canvasIds.length)];
  const timestamp = Date.now();
  const vuId = __VU;

  // CREATE
  const createStart = Date.now();
  const createResp = http.post(
    `${baseUrl}/v1/schedule/create`,
    JSON.stringify({
      canvasId,
      name: `StressTest_${vuId}_${timestamp}`,
      cronExpression: '0 0 * * *',
      timezone: 'Asia/Shanghai',
      isEnabled: false,
      scheduleConfig: JSON.stringify({ type: 'daily', time: '00:00' }),
    }),
    { headers, timeout: config.timeout },
  );

  const createDuration = Date.now() - createStart;
  createLatency.add(createDuration);
  trackSlowQuery(createDuration);

  let scheduleId = null;
  let createSuccess = false;

  if (createResp.status === 200 || createResp.status === 201) {
    try {
      const body = JSON.parse(createResp.body);
      scheduleId = body.data?.scheduleId;
      createSuccess = !!scheduleId;
    } catch (_e) {}
  }

  if (!createSuccess) {
    recordFailure(createResp, 'create');
    return;
  }

  totalSuccess.add(1);
  successRate.add(1);

  // UPDATE
  sleep(0.05);
  const updateStart = Date.now();
  const updateResp = http.post(
    `${baseUrl}/v1/schedule/update`,
    JSON.stringify({
      scheduleId,
      name: `Updated_${timestamp}`,
    }),
    { headers, timeout: config.timeout },
  );

  const updateDuration = Date.now() - updateStart;
  updateLatency.add(updateDuration);
  trackSlowQuery(updateDuration);
  recordResult(updateResp, 'update');

  // DELETE (cleanup)
  sleep(0.05);
  const deleteStart = Date.now();
  const deleteResp = http.post(`${baseUrl}/v1/schedule/delete`, JSON.stringify({ scheduleId }), {
    headers,
    timeout: config.timeout,
  });

  const deleteDuration = Date.now() - deleteStart;
  deleteLatency.add(deleteDuration);
  trackSlowQuery(deleteDuration);
  recordResult(deleteResp, 'delete');
}

function performTrigger(headers, baseUrl, schedulesByCanvas) {
  // Find any available schedule to trigger
  let scheduleId = null;
  for (const canvasId in schedulesByCanvas) {
    if (schedulesByCanvas[canvasId].length > 0) {
      const schedules = schedulesByCanvas[canvasId];
      scheduleId = schedules[Math.floor(Math.random() * schedules.length)];
      break;
    }
  }

  if (!scheduleId) {
    // No schedules available, do a list instead
    performListAll(headers, baseUrl);
    return;
  }

  const start = Date.now();
  const response = http.post(`${baseUrl}/v1/schedule/trigger`, JSON.stringify({ scheduleId }), {
    headers,
    timeout: '30s',
  });

  const duration = Date.now() - start;
  triggerLatency.add(duration);
  trackSlowQuery(duration);
  recordResult(response, 'trigger');
}

// ============================================================================
// Result Tracking
// ============================================================================

function trackSlowQuery(duration) {
  if (duration > 5000) {
    criticalQueries.add(1);
    console.log(`⚠️ CRITICAL: Query took ${duration}ms`);
  } else if (duration > 2000) {
    verySlowQueries.add(1);
  } else if (duration > 500) {
    slowQueries.add(1);
  }
}

function recordResult(response, operation) {
  const success = check(response, {
    'status is success': (r) => r.status === 200 || r.status === 201,
  });

  if (success) {
    totalSuccess.add(1);
    successRate.add(1);
  } else {
    recordFailure(response, operation);
  }
}

function recordFailure(response, operation) {
  totalFailure.add(1);
  successRate.add(0);

  // Categorize error
  if (response.status === 0 || response.timings.duration > 50000) {
    timeoutErrors.add(1);
  } else if (response.status === 429) {
    rateLimitErrors.add(1);
  } else if (response.status === 400) {
    validationErrors.add(1);
  } else if (response.status >= 500) {
    dbErrors.add(1);
    // Log server errors for investigation
    if (__ITER % 10 === 0) {
      console.log(`[${operation}] Server Error: ${response.body?.substring(0, 200)}`);
    }
  } else {
    unknownErrors.add(1);
  }
}

// ============================================================================
// Summary Report
// ============================================================================
export function handleSummary(data) {
  const testDuration = data.state.testRunDurationMs / 1000;

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       EXTREME STRESS TEST - FINAL REPORT                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Overview
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST OVERVIEW                                               │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ Duration:        ${testDuration.toFixed(1)}s`);
  console.log(`│ Total Requests:  ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`│ Avg Throughput:  ${data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0} req/s`);
  console.log(`│ Max VUs:         ${data.metrics.vus?.values?.max || 0}`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  // Latency Analysis - CRITICAL FOR FINDING SLOW QUERIES
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ LATENCY ANALYSIS (ms) - Check for Slow Queries              │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  const latencyMetrics = [
    { name: 'List All', key: 'list_latency' },
    { name: 'List Canvas', key: 'list_by_canvas_latency' },
    { name: 'Records List', key: 'records_list_latency' },
    { name: 'Create', key: 'create_latency' },
    { name: 'Update', key: 'update_latency' },
    { name: 'Delete', key: 'delete_latency' },
    { name: 'Trigger', key: 'trigger_latency' },
  ];

  console.log('│ Operation      Avg     P50     P95     P99     Max        │');
  console.log('│ ─────────────────────────────────────────────────────────  │');

  for (const m of latencyMetrics) {
    const metric = data.metrics[m.key];
    if (metric?.values && metric.values.count > 0) {
      const avg = metric.values.avg?.toFixed(0) || '-';
      const p50 = metric.values['p(50)']?.toFixed(0) || '-';
      const p95 = metric.values['p(95)']?.toFixed(0) || '-';
      const p99 = metric.values['p(99)']?.toFixed(0) || '-';
      const max = metric.values.max?.toFixed(0) || '-';

      // Flag slow operations
      const flag = Number.parseFloat(p95) > 1000 ? '⚠️' : '  ';
      console.log(
        `│ ${flag}${m.name.padEnd(12)} ${avg.padStart(6)} ${p50.padStart(7)} ${p95.padStart(7)} ${p99.padStart(7)} ${max.padStart(7)}    │`,
      );
    }
  }
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  // Slow Query Analysis
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ SLOW QUERY DETECTION                                        │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  const slow500 = data.metrics.slow_queries_over_500ms?.values?.count || 0;
  const slow2000 = data.metrics.very_slow_queries_over_2000ms?.values?.count || 0;
  const slow5000 = data.metrics.critical_queries_over_5000ms?.values?.count || 0;
  const totalReqs = data.metrics.http_reqs?.values?.count || 1;

  console.log(`│ Queries > 500ms:   ${slow500} (${((slow500 / totalReqs) * 100).toFixed(2)}%)`);
  console.log(`│ Queries > 2000ms:  ${slow2000} (${((slow2000 / totalReqs) * 100).toFixed(2)}%)`);
  console.log(
    `│ Queries > 5000ms:  ${slow5000} (${((slow5000 / totalReqs) * 100).toFixed(2)}%) ⚠️ CRITICAL`,
  );

  if (slow5000 > 0) {
    console.log('│');
    console.log('│ ❌ CRITICAL: Found queries taking > 5 seconds!');
    console.log('│    Check database indexes and query plans.');
  } else if (slow2000 > 0) {
    console.log('│');
    console.log('│ ⚠️ WARNING: Found queries taking > 2 seconds');
    console.log('│    Consider optimizing database queries.');
  } else if (slow500 < totalReqs * 0.01) {
    console.log('│');
    console.log('│ ✅ Good: Less than 1% slow queries (>500ms)');
  }
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  // Error Analysis
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ERROR ANALYSIS                                              │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  const success = data.metrics.total_success?.values?.count || 0;
  const failed = data.metrics.total_failure?.values?.count || 0;
  const timeouts = data.metrics.timeout_errors?.values?.count || 0;
  const rateLimits = data.metrics.rate_limit_errors?.values?.count || 0;
  const dbErrs = data.metrics.database_errors?.values?.count || 0;
  const validationErrs = data.metrics.validation_errors?.values?.count || 0;
  const unknownErrs = data.metrics.unknown_errors?.values?.count || 0;

  console.log(`│ Successful:       ${success}`);
  console.log(`│ Failed:           ${failed}`);
  console.log(`│ Success Rate:     ${((success / (success + failed)) * 100).toFixed(2)}%`);
  console.log('│');
  console.log('│ Error Breakdown:');
  console.log(`│   Timeouts:       ${timeouts}`);
  console.log(`│   Rate Limited:   ${rateLimits}`);
  console.log(`│   DB/Server:      ${dbErrs}`);
  console.log(`│   Validation:     ${validationErrs}`);
  console.log(`│   Unknown:        ${unknownErrs}`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  // Database Index Recommendations
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ DATABASE INDEX RECOMMENDATIONS                              │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  const listP95 = data.metrics.list_latency?.values?.['p(95)'] || 0;
  const listCanvasP95 = data.metrics.list_by_canvas_latency?.values?.['p(95)'] || 0;
  const recordsP95 = data.metrics.records_list_latency?.values?.['p(95)'] || 0;
  const createP95 = data.metrics.create_latency?.values?.['p(95)'] || 0;

  if (listP95 > 500) {
    console.log('│ ⚠️ List operation slow (P95 > 500ms)');
    console.log('│    Check index: workflow_schedules(uid, is_enabled, deleted_at)');
  }

  if (listCanvasP95 > 500) {
    console.log('│ ⚠️ List by Canvas slow (P95 > 500ms)');
    console.log('│    Check index: workflow_schedules(canvas_id, deleted_at)');
  }

  if (recordsP95 > 1000) {
    console.log('│ ⚠️ Records List slow (P95 > 1s)');
    console.log('│    Check index: workflow_schedule_records(uid, status, created_at)');
    console.log('│    Check index: workflow_schedule_records(schedule_id, scheduled_at)');
  }

  if (createP95 > 1000) {
    console.log('│ ⚠️ Create operation slow (P95 > 1s)');
    console.log('│    Check unique constraint: workflow_schedules(canvas_id, uid)');
  }

  if (listP95 < 500 && listCanvasP95 < 500 && recordsP95 < 1000 && createP95 < 1000) {
    console.log('│ ✅ All operations within acceptable latency thresholds');
    console.log('│    Database indexes appear to be working correctly');
  }

  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  // Scaling Recommendations
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ SCALING RECOMMENDATIONS                                     │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  const avgThroughput = data.metrics.http_reqs?.values?.rate || 0;
  const maxVUs = data.metrics.vus?.values?.max || 0;

  if (avgThroughput < 50) {
    console.log('│ ⚠️ Low throughput detected');
    console.log('│    - Check database connection pool size');
    console.log('│    - Consider increasing API worker processes');
  }

  if (timeouts > totalReqs * 0.05) {
    console.log('│ ⚠️ High timeout rate (>5%)');
    console.log('│    - Increase database connection pool');
    console.log('│    - Add database read replicas');
    console.log('│    - Consider caching frequently accessed data');
  }

  if (rateLimits > totalReqs * 0.1) {
    console.log('│ ⚠️ High rate limiting (>10%)');
    console.log('│    - Increase rateLimitMax from 100 to 200');
    console.log('│    - Consider per-operation rate limits');
  }

  if (dbErrs > 0) {
    console.log('│ ❌ Database errors detected');
    console.log('│    - Check PostgreSQL logs for details');
    console.log('│    - Monitor connection pool exhaustion');
    console.log('│    - Check for deadlocks or lock contention');
  }

  if (timeouts === 0 && rateLimits < totalReqs * 0.01 && dbErrs === 0) {
    console.log('│ ✅ System handling load well');
    console.log(`│    Sustained ${maxVUs} concurrent users`);
    console.log(`│    Achieved ${avgThroughput.toFixed(2)} req/s throughput`);
  }

  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`Report generated at: ${new Date().toISOString()}`);
  console.log('');

  return {
    stdout: '',
    'results/extreme-stress-report.json': JSON.stringify(data, null, 2),
  };
}
