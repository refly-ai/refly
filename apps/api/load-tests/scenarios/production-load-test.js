/**
 * Production-Grade Load Test for Schedule Module
 *
 * Purpose: Comprehensive stress test simulating real production load patterns
 * Duration: ~15 minutes for full test cycle
 *
 * Test Phases:
 * 1. Warmup - Gradual ramp to baseline
 * 2. Normal Load - Sustained moderate traffic
 * 3. Peak Load - High traffic simulation
 * 4. Spike Test - Sudden traffic burst
 * 5. Stress Test - Push system limits
 * 6. Recovery - Verify system recovers
 * 7. Cooldown - Graceful wind down
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import { config, getHeaders, productionThresholds } from '../config.js';

// ============================================================================
// Custom Metrics
// ============================================================================
const listLatency = new Trend('schedule_list_latency', true);
const detailLatency = new Trend('schedule_detail_latency', true);
const recordsLatency = new Trend('schedule_records_latency', true);
const triggerLatency = new Trend('schedule_trigger_latency', true);
const crudLatency = new Trend('schedule_crud_latency', true);

const successfulOps = new Counter('successful_operations');
const failedOps = new Counter('failed_operations');
const rateLimitedOps = new Counter('rate_limited_operations');
const timeoutOps = new Counter('timeout_operations');

const overallSuccessRate = new Rate('overall_success_rate');
const readSuccessRate = new Rate('read_success_rate');
const writeSuccessRate = new Rate('write_success_rate');

const activeUsers = new Gauge('active_virtual_users');
const queueDepth = new Gauge('estimated_queue_depth');

// ============================================================================
// Test Configuration
// ============================================================================
export const options = {
  scenarios: {
    // Phase 1: Warmup (1 min)
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '30s', target: 10 },
      ],
      gracefulRampDown: '10s',
      exec: 'readOnlyWorkload',
    },

    // Phase 2: Normal Load (3 min)
    normal_load: {
      executor: 'constant-vus',
      vus: 15,
      duration: '3m',
      startTime: '1m',
      exec: 'mixedWorkload',
    },

    // Phase 3: Peak Load (3 min)
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 15,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '1m', target: 40 },
        { duration: '1m', target: 30 },
      ],
      startTime: '4m',
      exec: 'mixedWorkload',
    },

    // Phase 4: Spike Test (1 min)
    spike: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '10s', target: 60 },
        { duration: '30s', target: 60 },
        { duration: '20s', target: 20 },
      ],
      startTime: '7m',
      exec: 'heavyTriggerWorkload',
    },

    // Phase 5: Stress Test (2 min)
    stress: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 70 },
        { duration: '30s', target: 50 },
      ],
      startTime: '8m',
      exec: 'mixedWorkload',
    },

    // Phase 6: Recovery (2 min)
    recovery: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      startTime: '10m',
      exec: 'readOnlyWorkload',
    },

    // Phase 7: Cooldown (1 min)
    cooldown: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [{ duration: '1m', target: 0 }],
      startTime: '12m',
      exec: 'readOnlyWorkload',
    },
  },

  thresholds: {
    ...productionThresholds,
    schedule_list_latency: ['p(95)<400', 'p(99)<800'],
    schedule_detail_latency: ['p(95)<300', 'p(99)<600'],
    schedule_records_latency: ['p(95)<500', 'p(99)<1000'],
    schedule_trigger_latency: ['p(95)<3000', 'p(99)<5000'],
    schedule_crud_latency: ['p(95)<800', 'p(99)<1500'],
    overall_success_rate: ['rate>0.95'],
    read_success_rate: ['rate>0.98'],
    write_success_rate: ['rate>0.90'],
  },
};

// ============================================================================
// Setup - Prepare test data
// ============================================================================
export function setup() {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  PRODUCTION-GRADE LOAD TEST - Schedule Module');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Start Time: ${new Date().toISOString()}`);
  console.log(`API Base URL: ${baseUrl}`);
  console.log(`Test Canvas ID: ${config.testCanvasId}`);
  console.log('');

  // Verify API connectivity
  const healthCheck = http.get(`${baseUrl}/`, { timeout: '10s' });
  if (healthCheck.status === 0) {
    console.error('ERROR: Cannot reach API server');
    return { error: 'API unreachable' };
  }

  // Verify authentication
  const authCheck = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({ page: 1, pageSize: 1 }),
    { headers, timeout: '10s' },
  );

  if (authCheck.status !== 200) {
    console.error(`ERROR: Authentication failed (${authCheck.status})`);
    return { error: 'Auth failed' };
  }

  // Get or create test schedules
  const scheduleIds = [];

  const listResp = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({ canvasId: config.testCanvasId, page: 1, pageSize: 100 }),
    { headers, timeout: '15s' },
  );

  try {
    const body = JSON.parse(listResp.body);
    if (body.data?.items?.length > 0) {
      for (const s of body.data.items) {
        scheduleIds.push(s.scheduleId);
      }
    }
  } catch (_e) {
    // ignore parse errors
  }

  // Create test schedule if none exists
  if (scheduleIds.length === 0) {
    const createResp = http.post(
      `${baseUrl}/v1/schedule/create`,
      JSON.stringify({
        canvasId: config.testCanvasId,
        name: 'Load Test Schedule',
        cronExpression: '0 0 1 1 *', // Jan 1st only, won't auto-trigger
        timezone: 'Asia/Shanghai',
        isEnabled: true,
      }),
      { headers, timeout: '15s' },
    );

    try {
      const body = JSON.parse(createResp.body);
      if (body.data?.scheduleId) {
        scheduleIds.push(body.data.scheduleId);
      }
    } catch (_e) {
      // ignore
    }
  }

  console.log(`Found/Created ${scheduleIds.length} test schedule(s)`);
  console.log('───────────────────────────────────────────────────────');
  console.log('');

  return {
    scheduleIds,
    startTime: Date.now(),
  };
}

// ============================================================================
// Read-Only Workload (for warmup/recovery)
// ============================================================================
export function readOnlyWorkload(data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { scheduleIds } = data;

  activeUsers.add(__VU);

  // Random read operation
  const ops = ['list', 'records', 'detail'];
  const op = ops[Math.floor(Math.random() * ops.length)];

  group(`read_${op}`, () => {
    performReadOperation(headers, baseUrl, scheduleIds, op);
  });

  sleep(0.5 + Math.random() * 1.5);
}

// ============================================================================
// Mixed Workload (normal production pattern)
// Distribution: 70% Read, 20% Trigger, 10% CRUD
// ============================================================================
export function mixedWorkload(data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { scheduleIds } = data;

  activeUsers.add(__VU);

  const rand = Math.random() * 100;

  if (rand < 70) {
    // 70% Read operations
    const ops = ['list', 'records', 'detail', 'tools'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    group(`read_${op}`, () => {
      performReadOperation(headers, baseUrl, scheduleIds, op);
    });
  } else if (rand < 90) {
    // 20% Trigger operations
    group('trigger', () => {
      performTriggerOperation(headers, baseUrl, scheduleIds);
    });
  } else {
    // 10% CRUD operations
    group('crud', () => {
      performCrudOperation(headers, baseUrl);
    });
  }

  // Realistic user think time
  sleep(0.3 + Math.random() * 1.2);
}

// ============================================================================
// Heavy Trigger Workload (for spike testing)
// Distribution: 30% Read, 60% Trigger, 10% CRUD
// ============================================================================
export function heavyTriggerWorkload(data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { scheduleIds } = data;

  activeUsers.add(__VU);

  const rand = Math.random() * 100;

  if (rand < 30) {
    const ops = ['list', 'records'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    group(`read_${op}`, () => {
      performReadOperation(headers, baseUrl, scheduleIds, op);
    });
  } else if (rand < 90) {
    group('trigger', () => {
      performTriggerOperation(headers, baseUrl, scheduleIds);
    });
  } else {
    group('crud', () => {
      performCrudOperation(headers, baseUrl);
    });
  }

  // Shorter think time during spike
  sleep(0.1 + Math.random() * 0.5);
}

// ============================================================================
// Operation Implementations
// ============================================================================

function performReadOperation(headers, baseUrl, scheduleIds, opType) {
  const start = Date.now();
  let response;
  let success = false;

  switch (opType) {
    case 'list':
      response = http.post(
        `${baseUrl}/v1/schedule/list`,
        JSON.stringify({
          canvasId: config.testCanvasId,
          page: 1,
          pageSize: 20,
        }),
        { headers, timeout: config.timeout },
      );
      listLatency.add(Date.now() - start);
      break;

    case 'records':
      response = http.post(
        `${baseUrl}/v1/schedule/records/list`,
        JSON.stringify({ page: 1, pageSize: 20 }),
        { headers, timeout: config.timeout },
      );
      recordsLatency.add(Date.now() - start);
      break;

    case 'detail': {
      if (scheduleIds.length === 0) return;
      const scheduleId = scheduleIds[Math.floor(Math.random() * scheduleIds.length)];
      response = http.post(`${baseUrl}/v1/schedule/detail`, JSON.stringify({ scheduleId }), {
        headers,
        timeout: config.timeout,
      });
      detailLatency.add(Date.now() - start);
      break;
    }

    case 'tools':
      response = http.post(`${baseUrl}/v1/schedule/records/tools`, JSON.stringify({}), {
        headers,
        timeout: config.timeout,
      });
      break;

    default:
      return;
  }

  if (response) {
    success = check(response, {
      'status is 200': (r) => r.status === 200 || r.status === 201,
    });

    if (success) {
      successfulOps.add(1);
      readSuccessRate.add(1);
      overallSuccessRate.add(1);
    } else {
      handleFailure(response);
      readSuccessRate.add(0);
      overallSuccessRate.add(0);
    }
  }
}

function performTriggerOperation(headers, baseUrl, scheduleIds) {
  if (scheduleIds.length === 0) return;

  const scheduleId = scheduleIds[Math.floor(Math.random() * scheduleIds.length)];
  const start = Date.now();

  const response = http.post(`${baseUrl}/v1/schedule/trigger`, JSON.stringify({ scheduleId }), {
    headers,
    timeout: '30s',
  });

  triggerLatency.add(Date.now() - start);

  const success = check(response, {
    'trigger status is 200': (r) => r.status === 200 || r.status === 201,
    'returns scheduleRecordId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !!body.data?.scheduleRecordId;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    successfulOps.add(1);
    writeSuccessRate.add(1);
    overallSuccessRate.add(1);

    // Track estimated queue depth
    const duration = Date.now() - start;
    if (duration > 2000) {
      queueDepth.add(Math.floor(duration / 500));
    }
  } else {
    handleFailure(response);
    writeSuccessRate.add(0);
    overallSuccessRate.add(0);
  }
}

function performCrudOperation(headers, baseUrl) {
  const timestamp = Date.now();
  const start = Date.now();

  // Create
  const createResp = http.post(
    `${baseUrl}/v1/schedule/create`,
    JSON.stringify({
      canvasId: config.testCanvasId,
      name: `LoadTest_${__VU}_${timestamp}`,
      cronExpression: '0 0 * * *',
      timezone: 'Asia/Shanghai',
      isEnabled: false, // Don't enable to avoid actual execution
    }),
    { headers, timeout: config.timeout },
  );

  let scheduleId = null;
  try {
    const body = JSON.parse(createResp.body);
    scheduleId = body.data?.scheduleId;
  } catch (_e) {
    // ignore
  }

  if (!scheduleId) {
    handleFailure(createResp);
    writeSuccessRate.add(0);
    overallSuccessRate.add(0);
    return;
  }

  // Update
  http.post(
    `${baseUrl}/v1/schedule/update`,
    JSON.stringify({
      scheduleId,
      name: `Updated_${timestamp}`,
    }),
    { headers, timeout: config.timeout },
  );

  // Delete (cleanup)
  const deleteResp = http.post(`${baseUrl}/v1/schedule/delete`, JSON.stringify({ scheduleId }), {
    headers,
    timeout: config.timeout,
  });

  crudLatency.add(Date.now() - start);

  const success = check(deleteResp, {
    'crud cycle successful': (r) => r.status === 200 || r.status === 201,
  });

  if (success) {
    successfulOps.add(1);
    writeSuccessRate.add(1);
    overallSuccessRate.add(1);
  } else {
    handleFailure(deleteResp);
    writeSuccessRate.add(0);
    overallSuccessRate.add(0);
  }
}

function handleFailure(response) {
  failedOps.add(1);

  if (response.status === 429) {
    rateLimitedOps.add(1);
  } else if (response.status === 0 || response.timings.duration > 25000) {
    timeoutOps.add(1);
  }
}

// ============================================================================
// Generate Summary Report
// ============================================================================
export function handleSummary(data) {
  const testDuration = data.state.testRunDurationMs / 1000;

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         PRODUCTION LOAD TEST - FINAL REPORT               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Test Overview
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ TEST OVERVIEW                                           │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│ Duration:        ${testDuration.toFixed(1)}s`);
  console.log(`│ Total Requests:  ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`│ Avg TPS:         ${data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0} req/s`);
  console.log(`│ Max VUs:         ${data.metrics.vus?.values?.max || 0}`);
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');

  // Latency Metrics
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ LATENCY METRICS (ms)                                    │');
  console.log('├─────────────────────────────────────────────────────────┤');

  const latencyMetrics = [
    { name: 'List', key: 'schedule_list_latency' },
    { name: 'Detail', key: 'schedule_detail_latency' },
    { name: 'Records', key: 'schedule_records_latency' },
    { name: 'Trigger', key: 'schedule_trigger_latency' },
    { name: 'CRUD', key: 'schedule_crud_latency' },
  ];

  for (const m of latencyMetrics) {
    const metric = data.metrics[m.key];
    if (metric?.values) {
      const p50 = metric.values['p(50)']?.toFixed(0) || '-';
      const p95 = metric.values['p(95)']?.toFixed(0) || '-';
      const p99 = metric.values['p(99)']?.toFixed(0) || '-';
      const max = metric.values.max?.toFixed(0) || '-';
      console.log(
        `│ ${m.name.padEnd(10)} P50: ${p50.padStart(6)}  P95: ${p95.padStart(6)}  P99: ${p99.padStart(6)}  Max: ${max.padStart(6)} │`,
      );
    }
  }
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');

  // Success Rates
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ SUCCESS RATES                                           │');
  console.log('├─────────────────────────────────────────────────────────┤');

  const overall = ((data.metrics.overall_success_rate?.values?.rate || 0) * 100).toFixed(2);
  const read = ((data.metrics.read_success_rate?.values?.rate || 0) * 100).toFixed(2);
  const write = ((data.metrics.write_success_rate?.values?.rate || 0) * 100).toFixed(2);

  console.log(`│ Overall:         ${overall}%`);
  console.log(`│ Read Ops:        ${read}%`);
  console.log(`│ Write Ops:       ${write}%`);
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');

  // Error Analysis
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ ERROR ANALYSIS                                          │');
  console.log('├─────────────────────────────────────────────────────────┤');

  const successful = data.metrics.successful_operations?.values?.count || 0;
  const failed = data.metrics.failed_operations?.values?.count || 0;
  const rateLimited = data.metrics.rate_limited_operations?.values?.count || 0;
  const timeouts = data.metrics.timeout_operations?.values?.count || 0;

  console.log(`│ Successful:      ${successful}`);
  console.log(`│ Failed:          ${failed}`);
  console.log(`│ Rate Limited:    ${rateLimited}`);
  console.log(`│ Timeouts:        ${timeouts}`);
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');

  // Threshold Status
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ THRESHOLD STATUS                                        │');
  console.log('├─────────────────────────────────────────────────────────┤');

  let passedCount = 0;
  let failedCount = 0;

  if (data.thresholds) {
    for (const [name, threshold] of Object.entries(data.thresholds)) {
      if (threshold.ok) {
        passedCount++;
      } else {
        failedCount++;
        console.log(`│ ❌ ${name}: FAILED`);
      }
    }
  }

  if (failedCount === 0) {
    console.log(`│ ✅ All ${passedCount} thresholds passed!`);
  } else {
    console.log(`│ Passed: ${passedCount}, Failed: ${failedCount}`);
  }
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');

  // Recommendations
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ RECOMMENDATIONS                                         │');
  console.log('├─────────────────────────────────────────────────────────┤');

  const triggerP95 = data.metrics.schedule_trigger_latency?.values?.['p(95)'] || 0;
  const errorRate = (data.metrics.http_req_failed?.values?.rate || 0) * 100;

  if (triggerP95 > 3000) {
    console.log('│ ⚠️  Trigger P95 > 3s - Consider:');
    console.log('│    - Increase globalMaxConcurrent');
    console.log('│    - Add more API instances (replicas)');
    console.log('│    - Optimize Redis connection pool');
  }

  if (errorRate > 5) {
    console.log('│ ⚠️  Error rate > 5% - Consider:');
    console.log('│    - Check system resources (CPU, Memory)');
    console.log('│    - Review rate limit settings');
    console.log('│    - Check database connection pool');
  }

  if (rateLimited > successful * 0.1) {
    console.log('│ ⚠️  High rate limiting - Consider:');
    console.log('│    - Increase rateLimitMax');
    console.log('│    - Adjust userMaxConcurrent');
  }

  if (triggerP95 < 1000 && errorRate < 2 && rateLimited < successful * 0.05) {
    console.log('│ ✅ System performing well under load');
    console.log('│    Current config can handle the tested load');
  }

  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`Report generated at: ${new Date().toISOString()}`);
  console.log('');

  return {
    stdout: '',
    'results/production-load-test-report.json': JSON.stringify(data, null, 2),
  };
}
