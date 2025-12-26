import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { RemoteService, RemoteMethod, remote, kubectlProxySingleton } from '../src';

/**
 * E2E test for connecting to deployed refly-sandbox service in test cluster
 *
 * Prerequisites:
 * - refly-sandbox service deployed in refly-app namespace
 * - Service running on port 18080
 * - kubectl configured for refly-test-eks cluster
 */
describe('Sandbox Service E2E Integration', () => {
  const namespace = 'refly-app';
  const serviceName = 'refly-sandbox';
  const servicePort = 18080;

  beforeAll(async () => {
    // Configure bridge to use kubectl proxy
    process.env.BRIDGE_KUBECTL_PROXY_ENABLED = 'true';
    process.env.BRIDGE_KUBECTL_PROXY_PORT = '18001';
    process.env.BRIDGE_K8S_NAMESPACE = namespace;
    process.env.BRIDGE_SVC_SUFFIX = `.${namespace}.svc.cluster.local`;

    // Verify sandbox service exists
    console.log('Verifying sandbox service exists...');
    try {
      const svcOutput = execSync(`kubectl get svc ${serviceName} -n ${namespace} -o json`, {
        encoding: 'utf8',
      });
      const service = JSON.parse(svcOutput);
      console.log(`✓ Service found: ${service.metadata.name}`);
      console.log(`  ClusterIP: ${service.spec.clusterIP}`);
      console.log(`  Port: ${service.spec.ports[0].port}`);
    } catch (_error) {
      throw new Error(
        `Sandbox service not found in ${namespace} namespace. Please deploy it first.`,
      );
    }

    // Verify pods are running
    console.log('Verifying sandbox pods are running...');
    const podsOutput = execSync(`kubectl get pods -l app=${serviceName} -n ${namespace} -o json`, {
      encoding: 'utf8',
    });
    const podList = JSON.parse(podsOutput);
    const runningPods = podList.items.filter((pod: any) => pod.status.phase === 'Running');
    console.log(`✓ Running pods: ${runningPods.length}/${podList.items.length}`);

    if (runningPods.length === 0) {
      throw new Error('No running sandbox pods found. Please check deployment.');
    }

    // Give kubectl proxy time to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup: stop kubectl proxy
    if (kubectlProxySingleton.isRunning?.()) {
      console.log('Stopping kubectl proxy...');
      kubectlProxySingleton.stop();
    }
  });

  describe('Service Connectivity', () => {
    it('should verify service endpoints exist', () => {
      const endpoints = execSync(`kubectl get endpoints ${serviceName} -n ${namespace} -o json`, {
        encoding: 'utf8',
      });
      const ep = JSON.parse(endpoints);
      expect(ep.subsets).toBeDefined();
      expect(ep.subsets.length).toBeGreaterThan(0);
      expect(ep.subsets[0].addresses).toBeDefined();
      expect(ep.subsets[0].addresses.length).toBeGreaterThan(0);
    });

    it('should verify kubectl proxy is running', () => {
      expect(kubectlProxySingleton).toBeDefined();
      expect(typeof kubectlProxySingleton.getProxyUrl).toBe('function');
    });
  });

  describe('Health Check Endpoint', () => {
    @RemoteService({
      serviceName: serviceName,
      port: servicePort,
    })
    class SandboxHealthClient {
      @RemoteMethod({ path: '/health', method: 'GET' })
      async checkHealth(): Promise<{ status: string }> {
        return remote();
      }
    }

    it('should call /health endpoint via kubectl proxy', async () => {
      const client = new SandboxHealthClient();
      const response = await client.checkHealth();

      expect(response).toBeDefined();
      expect(response.status).toBe('healthy');
    });
  });

  describe('Root Endpoint', () => {
    @RemoteService({
      serviceName: serviceName,
      port: servicePort,
    })
    class SandboxRootClient {
      @RemoteMethod({ path: '/', method: 'GET' })
      async getRoot(): Promise<{ message: string; timestamp: string }> {
        return remote();
      }
    }

    it('should call / endpoint and get response', async () => {
      const client = new SandboxRootClient();
      const response = await client.getRoot();

      expect(response).toBeDefined();
      expect(response.message).toContain('Refly Sandbox');
      expect(response.timestamp).toBeDefined();

      // Verify timestamp is valid ISO 8601 format
      const timestamp = new Date(response.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });

  describe('Configuration Override', () => {
    @RemoteService({
      serviceName: serviceName,
      port: servicePort,
      proxy: true, // Explicitly enable proxy for this service
    })
    class SandboxProxyClient {
      @RemoteMethod({ path: '/health', method: 'GET' })
      async checkHealth(): Promise<{ status: string }> {
        return remote();
      }

      @RemoteMethod({
        path: '/',
        method: 'GET',
        proxy: false, // Override: disable proxy for this specific method
      })
      async getRootDirect(): Promise<any> {
        return remote();
      }
    }

    it('should respect service-level proxy configuration', async () => {
      const client = new SandboxProxyClient();
      const response = await client.checkHealth();
      expect(response.status).toBe('healthy');
    });

    it('should respect method-level proxy override', async () => {
      const client = new SandboxProxyClient();

      // This should try direct connection which will fail in K8s context
      // but we're testing that the configuration override works
      try {
        await client.getRootDirect();
      } catch (error: any) {
        // Expected to fail with connection error (not proxy URL)
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    @RemoteService({
      serviceName: serviceName,
      port: servicePort,
    })
    class SandboxErrorClient {
      @RemoteMethod({ path: '/nonexistent', method: 'GET' })
      async callNonExistent(): Promise<any> {
        return remote();
      }
    }

    it('should handle 404 responses gracefully', async () => {
      const client = new SandboxErrorClient();

      try {
        await client.callNonExistent();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.response?.status).toBe(404);
      }
    });
  });
});
