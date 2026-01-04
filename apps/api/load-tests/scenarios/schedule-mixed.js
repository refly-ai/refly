/**
 * Schedule Mixed Scenario Load Test
 *
 * Purpose: Simulate real production environment load, comprehensive system performance evaluation
 * Scenario: Mixed workload - 70% Read + 20% Trigger + 10% CRUD
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import { config, getHeaders, defaultThresholds } from '../config.js';

// Custom metrics
const readDuration = new Trend('read_duration', true);
const triggerDuration = new Trend('trigger_duration', true);
const crudDuration = new Trend('crud_duration', true);
const overallSuccessRate = new Rate('overall_success_rate');
const operationCounter = new Counter('operation_counter');
const activeVUsGauge = new Gauge('active_vus');

// Test configuration - Simulate real production load
export const options = {
  scenarios: {
    // Gradual ramp-up, simulating daily traffic patterns
    mixed_workload: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 }, // Early morning low
        { duration: '2m', target: 30 }, // Morning growth
        { duration: '3m', target: 50 }, // Noon peak
        { duration: '2m', target: 40 }, // Afternoon decline
        { duration: '2m', target: 60 }, // Evening peak
        { duration: '2m', target: 30 }, // Night decrease
        { duration: '1m', target: 0 }, // Cool down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ...defaultThresholds,
    read_duration: ['p(95)<500'],
    trigger_duration: ['p(95)<3000'],
    crud_duration: ['p(95)<1000'],
    overall_success_rate: ['rate>0.95'],
  },
};

// Setup phase
export function setup() {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;

  console.log('📋 Setup: Preparing mixed workload test...');
  console.log('Workload distribution: 70% Read, 20% Trigger, 10% CRUD');

  // Get or create test schedules
  const schedules = [];

  const listResponse = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({
      canvasId: config.testCanvasId,
      page: 1,
      pageSize: 100,
    }),
    { headers, timeout: config.timeout },
  );

  try {
    const listBody = JSON.parse(listResponse.body);
    if (listBody.data?.items?.length > 0) {
      for (const s of listBody.data.items) {
        schedules.push(s.scheduleId);
      }
      console.log(`✅ Found ${schedules.length} existing schedules`);
    }
  } catch (_e) {
    // ignore
  }

  // Ensure at least one schedule exists
  if (schedules.length === 0) {
    const createResponse = http.post(
      `${baseUrl}/v1/schedule/create`,
      JSON.stringify({
        canvasId: config.testCanvasId,
        name: 'Mixed Test Schedule',
        cronExpression: '0 0 1 1 *',
        timezone: 'Asia/Shanghai',
        isEnabled: true,
      }),
      { headers, timeout: config.timeout },
    );

    try {
      const body = JSON.parse(createResponse.body);
      if (body.data?.scheduleId) {
        schedules.push(body.data.scheduleId);
        console.log(`✅ Created test schedule: ${body.data.scheduleId}`);
      }
    } catch (_e) {
      console.error('Failed to create test schedule');
    }
  }

  return {
    schedules,
    startTime: Date.now(),
  };
}

// Read operations - 70% weight
function performReadOperation(headers, baseUrl, scheduleIds) {
  const operations = [
    // List query
    () => {
      const response = http.post(
        `${baseUrl}/v1/schedule/list`,
        JSON.stringify({
          canvasId: config.testCanvasId,
          page: 1,
          pageSize: 20,
        }),
        { headers, timeout: config.timeout },
      );
      return { response, name: 'list' };
    },
    // Records list
    () => {
      const response = http.post(
        `${baseUrl}/v1/schedule/records/list`,
        JSON.stringify({ page: 1, pageSize: 20 }),
        { headers, timeout: config.timeout },
      );
      return { response, name: 'records_list' };
    },
    // Detail query
    () => {
      if (scheduleIds.length === 0) return null;
      const scheduleId = scheduleIds[Math.floor(Math.random() * scheduleIds.length)];
      const response = http.post(`${baseUrl}/v1/schedule/detail`, JSON.stringify({ scheduleId }), {
        headers,
        timeout: config.timeout,
      });
      return { response, name: 'detail' };
    },
    // Get available tools
    () => {
      const response = http.post(`${baseUrl}/v1/schedule/records/tools`, JSON.stringify({}), {
        headers,
        timeout: config.timeout,
      });
      return { response, name: 'tools' };
    },
  ];

  const op = operations[Math.floor(Math.random() * operations.length)]();
  return op;
}

// Trigger operations - 20% weight
function performTriggerOperation(headers, baseUrl, scheduleIds) {
  if (scheduleIds.length === 0) return null;

  const scheduleId = scheduleIds[Math.floor(Math.random() * scheduleIds.length)];
  const response = http.post(`${baseUrl}/v1/schedule/trigger`, JSON.stringify({ scheduleId }), {
    headers,
    timeout: '30s',
  });

  return { response, name: 'trigger' };
}

// CRUD operations - 10% weight
function performCrudOperation(headers, baseUrl) {
  const timestamp = Date.now();
  let scheduleId = null;

  // Create
  const createResponse = http.post(
    `${baseUrl}/v1/schedule/create`,
    JSON.stringify({
      canvasId: config.testCanvasId,
      name: `Mixed Test ${timestamp}`,
      cronExpression: '0 0 * * *',
      timezone: 'Asia/Shanghai',
      isEnabled: false,
    }),
    { headers, timeout: config.timeout },
  );

  try {
    const body = JSON.parse(createResponse.body);
    scheduleId = body.data?.scheduleId;
  } catch (_e) {
    return { response: createResponse, name: 'crud_create' };
  }

  if (!scheduleId) {
    return { response: createResponse, name: 'crud_create' };
  }

  // Update
  const _updateResponse = http.post(
    `${baseUrl}/v1/schedule/update`,
    JSON.stringify({
      scheduleId,
      name: `Updated ${timestamp}`,
    }),
    { headers, timeout: config.timeout },
  );

  // Delete (cleanup)
  const deleteResponse = http.post(
    `${baseUrl}/v1/schedule/delete`,
    JSON.stringify({ scheduleId }),
    { headers, timeout: config.timeout },
  );

  return { response: deleteResponse, name: 'crud_full' };
}

// Main test function
export default function (data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { schedules } = data;

  activeVUsGauge.add(__VU);

  // Select operation type based on weight
  const rand = Math.random() * 100;
  let result = null;
  let operationType = '';

  const startTime = Date.now();

  if (rand < 70) {
    // 70% read operations
    operationType = 'read';
    result = performReadOperation(headers, baseUrl, schedules);
  } else if (rand < 90) {
    // 20% trigger operations
    operationType = 'trigger';
    result = performTriggerOperation(headers, baseUrl, schedules);
  } else {
    // 10% CRUD operations
    operationType = 'crud';
    result = performCrudOperation(headers, baseUrl);
  }

  const duration = Date.now() - startTime;

  // Record metrics
  if (result) {
    operationCounter.add(1, { type: operationType, operation: result.name });

    const success = check(result.response, {
      'status is 200': (r) => r.status === 200 || r.status === 201,
    });

    overallSuccessRate.add(success ? 1 : 0);

    // Record latency by type
    switch (operationType) {
      case 'read':
        readDuration.add(duration);
        break;
      case 'trigger':
        triggerDuration.add(duration);
        break;
      case 'crud':
        crudDuration.add(duration);
        break;
    }
  }

  // Simulate real user think time
  sleep(0.5 + Math.random() * 2);
}

// Summary report at test end
export function handleSummary(data) {
  console.log('\n========== Mixed Scenario Load Test Report ==========\n');

  // Response times by type
  const metrics = [
    { name: 'Read Operations', key: 'read_duration' },
    { name: 'Trigger Operations', key: 'trigger_duration' },
    { name: 'CRUD Operations', key: 'crud_duration' },
  ];

  console.log('Response Times by Operation:');
  for (const m of metrics) {
    const metric = data.metrics[m.key];
    if (metric?.values) {
      console.log(`  ${m.name}:`);
      console.log(`    P50: ${metric.values['p(50)']?.toFixed(2)}ms`);
      console.log(`    P95: ${metric.values['p(95)']?.toFixed(2)}ms`);
      console.log(`    P99: ${metric.values['p(99)']?.toFixed(2)}ms`);
    }
  }

  // Success rate
  const successRate = data.metrics.overall_success_rate;
  if (successRate?.values) {
    console.log(`\nOverall Success Rate: ${(successRate.values.rate * 100).toFixed(2)}%`);
  }

  // HTTP request statistics
  const httpReqs = data.metrics.http_reqs;
  if (httpReqs?.values) {
    console.log('\nRequest Statistics:');
    console.log(`  Total Requests: ${httpReqs.values.count}`);
    console.log(`  Average TPS: ${httpReqs.values.rate?.toFixed(2)} req/s`);
  }

  // Max VUs
  const vus = data.metrics.vus;
  if (vus?.values) {
    console.log(`  Max VUs: ${vus.values.max}`);
  }

  // Error analysis
  const httpFailed = data.metrics.http_req_failed;
  if (httpFailed?.values) {
    console.log(`\nError Rate: ${(httpFailed.values.rate * 100).toFixed(2)}%`);
  }

  console.log('\n========================================\n');

  // Performance recommendations
  console.log('📊 Performance Recommendations:\n');

  const readP95 = data.metrics.read_duration?.values?.['p(95)'] || 0;
  const triggerP95 = data.metrics.trigger_duration?.values?.['p(95)'] || 0;
  const errorRate = data.metrics.http_req_failed?.values?.rate || 0;

  if (readP95 > 500) {
    console.log('⚠️ Read P95 > 500ms, consider:');
    console.log('   - Increase database connection pool');
    console.log('   - Add Redis caching');
    console.log('   - Optimize query indexes');
  }

  if (triggerP95 > 3000) {
    console.log('⚠️ Trigger P95 > 3s, consider:');
    console.log('   - Increase worker concurrency');
    console.log('   - Scale API instances horizontally');
    console.log('   - Check Redis connections');
  }

  if (errorRate > 0.05) {
    console.log('⚠️ Error rate > 5%, consider:');
    console.log('   - Check system resource usage');
    console.log('   - Review error logs');
    console.log('   - Adjust rate limit parameters');
  }

  console.log('\n');

  return {
    stdout: '',
    'results/schedule-mixed-summary.json': JSON.stringify(data, null, 2),
  };
}
