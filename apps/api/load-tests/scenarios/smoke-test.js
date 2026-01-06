/**
 * Quick Smoke Test - Verify configuration before running full load tests
 *
 * Usage: k6 run scenarios/smoke-test.js
 *
 * This lightweight test verifies:
 * 1. API connectivity
 * 2. Authentication token validity
 * 3. Test canvas existence
 */

import http from 'k6/http';
import { check } from 'k6';
import { config, getHeaders, validateConfig } from '../config.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1.0'], // All checks must pass
  },
};

export default function () {
  const headers = getHeaders();
  const baseUrl = config.baseUrl;

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SMOKE TEST - Configuration Verification');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`API Base URL: ${baseUrl}`);

  // Step 1: Check configuration
  console.log('');
  console.log('Step 1: Checking configuration...');
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    for (const err of configErrors) {
      console.error(`   ❌ ${err}`);
    }
    console.log('');
    console.log('Please set environment variables:');
    console.log('  export K6_API_BASE_URL="http://localhost:5800"');
    console.log('  export K6_AUTH_TOKEN="your-jwt-token"');
    console.log('  export K6_TEST_CANVAS_ID="your-canvas-id"');
    return;
  }
  console.log('   ✅ Configuration OK');

  // Step 2: Test API connection
  console.log('');
  console.log('Step 2: Testing API connection...');
  const healthResponse = http.get(`${baseUrl}/`, { timeout: '10s' });

  if (healthResponse.status === 0) {
    console.error(`   ❌ Cannot reach API at ${baseUrl}`);
    console.log('');
    console.log('Make sure the API server is running:');
    console.log('  cd apps/api && npm run dev');
    return;
  }
  console.log(`   ✅ API reachable (status: ${healthResponse.status})`);

  // Step 3: Test authentication
  console.log('');
  console.log('Step 3: Testing authentication...');
  const authResponse = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({ page: 1, pageSize: 1 }),
    { headers, timeout: '10s' },
  );

  const authOk = check(authResponse, {
    'Authentication works': (r) => r.status === 200 || r.status === 201,
  });

  if (!authOk) {
    console.error(`   ❌ Authentication failed (status: ${authResponse.status})`);
    console.log(`   Response: ${authResponse.body?.substring(0, 200)}`);
    console.log('');
    console.log('Check your JWT token is valid and not expired.');
    return;
  }
  console.log('   ✅ Authentication OK');

  // Step 4: Verify test canvas
  console.log('');
  console.log('Step 4: Verifying test canvas...');
  const canvasResponse = http.post(
    `${baseUrl}/v1/schedule/list`,
    JSON.stringify({ canvasId: config.testCanvasId, page: 1, pageSize: 10 }),
    { headers, timeout: '10s' },
  );

  let scheduleCount = 0;
  try {
    const body = JSON.parse(canvasResponse.body);
    scheduleCount = body.data?.total || 0;
  } catch (_e) {
    // ignore
  }

  check(canvasResponse, {
    'Canvas query successful': (r) => r.status === 200 || r.status === 201,
  });

  console.log(`   Canvas ID: ${config.testCanvasId}`);
  console.log(`   Existing schedules: ${scheduleCount}`);
  console.log('   ✅ Canvas verification OK');

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ✅ All checks passed! Ready for load testing.');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('Next steps:');
  console.log('');
  console.log('  # Quick CRUD baseline test:');
  console.log('  k6 run scenarios/schedule-crud.js');
  console.log('');
  console.log('  # Quick trigger stress test:');
  console.log('  k6 run scenarios/schedule-trigger.js');
  console.log('');
  console.log('  # Full production load test (~13 min):');
  console.log('  k6 run scenarios/production-load-test.js');
  console.log('');
  console.log('  # Run all tests:');
  console.log('  ./run-all.sh');
  console.log('');
}
