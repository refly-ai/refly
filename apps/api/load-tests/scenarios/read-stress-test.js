/**
 * Pure Read Stress Test - Database Performance Only
 *
 * Purpose: Test maximum read throughput to identify:
 * - List API bottlenecks
 * - Database connection pool limits
 * - Index performance under high load
 *
 * This test only performs READ operations to avoid unique constraint issues.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { config, getHeaders } from '../config.js';

// Metrics
const listLatency = new Trend('list_latency', true);
const listByCanvasLatency = new Trend('list_by_canvas_latency', true);
const recordsLatency = new Trend('records_latency', true);
const toolsLatency = new Trend('tools_latency', true);
const _detailLatency = new Trend('detail_latency', true);

const slowQueries = new Counter('slow_queries_500ms');
const verySlowQueries = new Counter('very_slow_queries_1000ms');
const successRate = new Rate('success_rate');
const errors = new Counter('errors');

// High load configuration - 5 minutes of sustained high load
export const options = {
  scenarios: {
    high_read_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 }, // Warmup
        { duration: '1m', target: 100 }, // Ramp
        { duration: '2m', target: 150 }, // High load
        { duration: '1m', target: 200 }, // Peak
        { duration: '30s', target: 50 }, // Cooldown
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    list_latency: ['p(95)<300', 'p(99)<1000'],
    records_latency: ['p(95)<500', 'p(99)<1500'],
    success_rate: ['rate>0.99'],
  },
};

export function setup() {
  const canvasIds = config.testCanvasIds.length > 0 ? config.testCanvasIds : [config.testCanvasId];

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     PURE READ STRESS TEST - Database Performance          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Canvas IDs:', canvasIds.join(', '));
  console.log('Max VUs: 200');
  console.log('Duration: 5 minutes');
  console.log('');

  return { canvasIds };
}

export default function (data) {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;
  const { canvasIds } = data;

  // Weighted distribution of read operations
  const rand = Math.random() * 100;

  if (rand < 35) {
    // 35% - List all schedules
    testListAll(headers, baseUrl);
  } else if (rand < 60) {
    // 25% - List by canvas
    testListByCanvas(headers, baseUrl, canvasIds);
  } else if (rand < 85) {
    // 25% - List records
    testListRecords(headers, baseUrl);
  } else {
    // 15% - Get tools
    testGetTools(headers, baseUrl);
  }

  // Minimal think time for max pressure
  sleep(0.02 + Math.random() * 0.05);
}

function testListAll(headers, baseUrl) {
  const start = Date.now();
  const response = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({ page: 1, pageSize: 50 }),
    { headers, timeout: '30s' },
  );

  const duration = Date.now() - start;
  listLatency.add(duration);
  trackQuery(duration, response);
}

function testListByCanvas(headers, baseUrl, canvasIds) {
  const canvasId = canvasIds[Math.floor(Math.random() * canvasIds.length)];
  const start = Date.now();

  const response = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({ canvasId, page: 1, pageSize: 50 }),
    { headers, timeout: '30s' },
  );

  const duration = Date.now() - start;
  listByCanvasLatency.add(duration);
  trackQuery(duration, response);
}

function testListRecords(headers, baseUrl) {
  const start = Date.now();
  const response = http.post(
    `${baseUrl}/v1/schedule/records/list`,
    JSON.stringify({ page: 1, pageSize: 50 }),
    { headers, timeout: '30s' },
  );

  const duration = Date.now() - start;
  recordsLatency.add(duration);
  trackQuery(duration, response);
}

function testGetTools(headers, baseUrl) {
  const start = Date.now();
  const response = http.post(`${baseUrl}/v1/schedule/records/tools`, JSON.stringify({}), {
    headers,
    timeout: '30s',
  });

  const duration = Date.now() - start;
  toolsLatency.add(duration);
  trackQuery(duration, response);
}

function trackQuery(duration, response) {
  if (duration > 1000) {
    verySlowQueries.add(1);
  } else if (duration > 500) {
    slowQueries.add(1);
  }

  const success = check(response, {
    'status 200': (r) => r.status === 200 || r.status === 201,
  });

  successRate.add(success ? 1 : 0);
  if (!success) {
    errors.add(1);
  }
}

export function handleSummary(data) {
  const duration = data.state.testRunDurationMs / 1000;
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       PURE READ STRESS TEST - RESULTS                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ OVERVIEW                                                    │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ Duration:        ${duration.toFixed(1)}s`);
  console.log(`│ Total Requests:  ${totalReqs}`);
  console.log(`│ Throughput:      ${data.metrics.http_reqs?.values?.rate?.toFixed(2)} req/s`);
  console.log(
    `│ Success Rate:    ${((data.metrics.success_rate?.values?.rate || 0) * 100).toFixed(2)}%`,
  );
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ LATENCY BY OPERATION (ms)                                   │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Operation       Avg     P50     P95     P99     Max         │');
  console.log('│ ──────────────────────────────────────────────────────────  │');

  const ops = [
    { name: 'List All', key: 'list_latency' },
    { name: 'List Canvas', key: 'list_by_canvas_latency' },
    { name: 'Records', key: 'records_latency' },
    { name: 'Tools', key: 'tools_latency' },
  ];

  for (const op of ops) {
    const m = data.metrics[op.key];
    if (m?.values) {
      const avg = m.values.avg?.toFixed(0) || '-';
      const p50 = m.values['p(50)']?.toFixed(0) || '-';
      const p95 = m.values['p(95)']?.toFixed(0) || '-';
      const p99 = m.values['p(99)']?.toFixed(0) || '-';
      const max = m.values.max?.toFixed(0) || '-';
      const flag = Number.parseFloat(p95) > 500 ? '⚠️' : '  ';
      console.log(
        `│ ${flag}${op.name.padEnd(12)} ${avg.padStart(6)} ${p50.padStart(7)} ${p95.padStart(7)} ${p99.padStart(7)} ${max.padStart(7)}     │`,
      );
    }
  }
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ SLOW QUERY DETECTION                                        │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  const slow500 = data.metrics.slow_queries_500ms?.values?.count || 0;
  const slow1000 = data.metrics.very_slow_queries_1000ms?.values?.count || 0;
  console.log(`│ Queries > 500ms:   ${slow500} (${((slow500 / totalReqs) * 100).toFixed(3)}%)`);
  console.log(`│ Queries > 1000ms:  ${slow1000} (${((slow1000 / totalReqs) * 100).toFixed(3)}%)`);

  if (slow1000 > 0) {
    console.log('│');
    console.log('│ ⚠️ Found queries over 1 second - check database indexes');
  } else if (slow500 < totalReqs * 0.01) {
    console.log('│');
    console.log('│ ✅ Excellent: <1% slow queries');
  }
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  // Database index assessment
  const listP95 = data.metrics.list_latency?.values?.['p(95)'] || 0;
  const recordsP95 = data.metrics.records_latency?.values?.['p(95)'] || 0;

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ DATABASE INDEX ASSESSMENT                                   │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  if (listP95 > 500) {
    console.log('│ ⚠️ workflow_schedules LIST is slow (P95 > 500ms)');
    console.log('│    Recommendation: Check index on (uid, is_enabled, deleted_at)');
  } else {
    console.log('│ ✅ workflow_schedules LIST performance OK');
  }

  if (recordsP95 > 1000) {
    console.log('│ ⚠️ workflow_schedule_records LIST is slow (P95 > 1s)');
    console.log('│    Recommendation: Check index on (uid, status, created_at)');
  } else {
    console.log('│ ✅ workflow_schedule_records LIST performance OK');
  }

  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  return {
    stdout: '',
    'results/read-stress-report.json': JSON.stringify(data, null, 2),
  };
}
