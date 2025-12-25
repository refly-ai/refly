import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { RemoteService, RemoteMethod, remote, kubectlProxySingleton } from '../src';

describe('K8s E2E Integration', () => {
  const namespace = 'default';
  const deploymentName = 'bridge-e2e-test';
  const serviceName = 'bridge-e2e-test-svc';
  const manifestPath = path.join(__dirname, 'fixtures/test-deployment.yaml');

  beforeAll(async () => {
    process.env.BRIDGE_KUBECTL_PROXY_ENABLED = 'true';
    process.env.BRIDGE_KUBECTL_PROXY_PORT = '18001';
    process.env.BRIDGE_K8S_NAMESPACE = namespace;
    process.env.BRIDGE_SVC_SUFFIX = `.${namespace}.svc.cluster.local`;

    console.log('Deploying test resources...');
    execSync(`kubectl apply -f ${manifestPath}`, { stdio: 'inherit' });

    console.log('Waiting for pod to be ready...');
    execSync(
      `kubectl wait --for=condition=ready pod -l app=${deploymentName} -n ${namespace} --timeout=120s`,
      { stdio: 'inherit' },
    );

    await new Promise((resolve) => setTimeout(resolve, 5000));
  });

  afterAll(async () => {
    console.log('Cleaning up test resources...');
    execSync(`kubectl delete -f ${manifestPath}`, { stdio: 'inherit' });
  });

  describe('Deployment Verification', () => {
    it('should deploy test container successfully', () => {
      const pods = execSync(`kubectl get pods -l app=${deploymentName} -n ${namespace} -o json`, {
        encoding: 'utf8',
      });
      const podList = JSON.parse(pods);
      expect(podList.items.length).toBeGreaterThan(0);
      expect(podList.items[0].status.phase).toBe('Running');
    });

    it('should verify kubectl proxy is running', () => {
      expect(kubectlProxySingleton).toBeDefined();
      expect(typeof kubectlProxySingleton.getProxyUrl).toBe('function');
    });
  });

  describe('HTTP Methods via kubectl proxy', () => {
    interface HttpBinResponse {
      args?: Record<string, string>;
      headers?: Record<string, string>;
      json?: any;
      data?: string;
      url?: string;
      method?: string;
    }

    @RemoteService({
      serviceName: serviceName,
      port: 80,
    })
    class HttpBinClient {
      @RemoteMethod({ path: '/get', method: 'GET' })
      get(): Promise<HttpBinResponse> {
        return remote();
      }

      @RemoteMethod({ path: '/post', method: 'POST' })
      post(_data: any): Promise<HttpBinResponse> {
        return remote();
      }

      @RemoteMethod({ path: '/put', method: 'PUT' })
      put(_data: any): Promise<HttpBinResponse> {
        return remote();
      }

      @RemoteMethod({ path: '/delete', method: 'DELETE' })
      delete(): Promise<HttpBinResponse> {
        return remote();
      }

      @RemoteMethod({ path: '/patch', method: 'PATCH' })
      patch(_data: any): Promise<HttpBinResponse> {
        return remote();
      }

      @RemoteMethod({ path: '/status/200', method: 'GET' })
      status200(): Promise<string> {
        return remote();
      }

      @RemoteMethod({ path: '/headers', method: 'GET' })
      headers(): Promise<HttpBinResponse> {
        return remote();
      }
    }

    const client = new HttpBinClient();

    it('should handle GET requests', async () => {
      const response = await client.get();
      expect(response).toBeDefined();
      expect(response.url).toContain('/get');
      expect(response.headers).toBeDefined();
    });

    it('should handle POST requests with JSON body', async () => {
      const testData = {
        message: 'test-post',
        timestamp: Date.now(),
      };

      const response = await client.post(testData);
      expect(response).toBeDefined();
      expect(response.json).toEqual(testData);
      expect(response.url).toContain('/post');
    });

    it('should handle PUT requests with JSON body', async () => {
      const testData = {
        message: 'test-put',
        id: 123,
      };

      const response = await client.put(testData);
      expect(response).toBeDefined();
      expect(response.json).toEqual(testData);
      expect(response.url).toContain('/put');
    });

    it('should handle DELETE requests', async () => {
      const response = await client.delete();
      expect(response).toBeDefined();
      expect(response.url).toContain('/delete');
    });

    it('should handle PATCH requests with JSON body', async () => {
      const testData = {
        message: 'test-patch',
        partial: true,
      };

      const response = await client.patch(testData);
      expect(response).toBeDefined();
      expect(response.json).toEqual(testData);
      expect(response.url).toContain('/patch');
    });

    it('should handle status code endpoints', async () => {
      const response = await client.status200();
      expect(response).toBeDefined();
    });

    it('should forward headers correctly', async () => {
      const response = await client.headers();
      expect(response).toBeDefined();
      expect(response.headers).toBeDefined();
      expect(response.headers?.Host).toBeDefined();
    });
  });

  describe('Configuration Override Tests', () => {
    @RemoteService({
      serviceName: serviceName,
      port: 80,
      proxy: true,
    })
    class ConfigTestClient {
      @RemoteMethod({ path: '/get', method: 'GET' })
      normalGet(): Promise<any> {
        return remote();
      }

      @RemoteMethod({ path: '/get', method: 'GET', proxy: true })
      forceProxyGet(): Promise<any> {
        return remote();
      }

      @RemoteMethod({
        path: '/post',
        method: 'POST',
        host: `${serviceName}.${namespace}.svc.cluster.local`,
      })
      overrideHostPost(_data: any): Promise<any> {
        return remote();
      }
    }

    const client = new ConfigTestClient();

    it('should use service-level proxy configuration', async () => {
      const response = await client.normalGet();
      expect(response).toBeDefined();
      expect(response.url).toContain('/get');
    });

    it('should use method-level proxy override', async () => {
      const response = await client.forceProxyGet();
      expect(response).toBeDefined();
      expect(response.url).toContain('/get');
    });

    it('should use method-level host override', async () => {
      const testData = { test: 'override-host' };
      const response = await client.overrideHostPost(testData);
      expect(response).toBeDefined();
      expect(response.json).toEqual(testData);
    });
  });

  describe('Error Handling', () => {
    @RemoteService({
      serviceName: serviceName,
      port: 80,
    })
    class ErrorTestClient {
      @RemoteMethod({ path: '/status/404', method: 'GET' })
      status404(): Promise<any> {
        return remote();
      }

      @RemoteMethod({ path: '/status/500', method: 'GET' })
      status500(): Promise<any> {
        return remote();
      }
    }

    const client = new ErrorTestClient();

    it('should handle 404 errors', async () => {
      await expect(client.status404()).rejects.toThrow();
    });

    it('should handle 500 errors', async () => {
      await expect(client.status500()).rejects.toThrow();
    });
  });
});
