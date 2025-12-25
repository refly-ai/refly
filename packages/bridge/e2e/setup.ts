/**
 * E2E test setup and utilities
 */

import { beforeAll, afterAll } from 'vitest';
import { kubectlProxySingleton } from '../src/kubectl';

/**
 * Setup environment for E2E tests
 */
export async function setupBridge() {
  process.env.BRIDGE_KUBECTL_PROXY_ENABLED = 'true';
  process.env.BRIDGE_KUBECTL_PROXY_PORT = '18001';
  process.env.BRIDGE_K8S_NAMESPACE = 'test-env';
  process.env.BRIDGE_SVC_SUFFIX = '.test-env.svc.cluster.local';
}

/**
 * Teardown after tests
 */
export async function teardownBridge() {
  const instance = kubectlProxySingleton;
  if (instance) {
    // Cleanup is handled by process exit handlers
  }
}

/**
 * Global setup for all E2E tests
 */
beforeAll(async () => {
  await setupBridge();
}, 30000);

/**
 * Global teardown for all E2E tests
 */
afterAll(async () => {
  await teardownBridge();
}, 10000);
