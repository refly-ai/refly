/**
 * E2E tests for bridge functionality
 */

import { describe, it, expect } from 'vitest';
import './setup';
import { RemoteService, RemoteMethod, remote, kubectlProxySingleton } from '../src';

describe('Bridge E2E Tests', () => {
  describe('Environment Configuration', () => {
    it('should read environment variables', () => {
      expect(process.env.BRIDGE_KUBECTL_PROXY_ENABLED).toBe('true');
      expect(process.env.BRIDGE_KUBECTL_PROXY_PORT).toBe('18001');
      expect(process.env.BRIDGE_K8S_NAMESPACE).toBe('test-env');
    });

    it('should have kubectl singleton instance', () => {
      const instance = kubectlProxySingleton;
      expect(instance).toBeDefined();
    });
  });

  describe('Decorator Tests', () => {
    interface ExecuteCodeRequest {
      code: string;
    }

    interface ExecuteCodeResponse {
      output: string;
    }

    @RemoteService({
      host: 'sandbox-service.test-env.svc.cluster.local',
      port: 3000,
    })
    class TestSandboxService {
      @RemoteMethod({ path: '/execute_code', method: 'POST' })
      executeCode(_req: ExecuteCodeRequest): Promise<ExecuteCodeResponse> {
        return remote();
      }

      @RemoteMethod({ path: '/health', method: 'GET' })
      health(): Promise<{ status: string }> {
        return remote();
      }
    }

    it('should create service class with decorators', () => {
      const service = new TestSandboxService();
      expect(service).toBeDefined();
      expect(typeof service.executeCode).toBe('function');
      expect(typeof service.health).toBe('function');
    });

    it('should generate correct proxy URL when kubectl proxy is enabled', () => {
      const url = kubectlProxySingleton.getProxyUrl(
        'sandbox-service.test-env.svc.cluster.local',
        3000,
        '/execute_code',
      );

      expect(url).toBe(
        'http://localhost:18001/api/v1/namespaces/test-env/services/sandbox-service:3000/proxy/execute_code',
      );
    });
  });

  describe('Direct Connection Mode', () => {
    @RemoteService({ host: 'example.com', port: 8080 })
    class DirectService {
      @RemoteMethod({ path: '/api/test', method: 'GET' })
      test(): Promise<any> {
        return remote();
      }
    }

    it('should support direct connection mode', () => {
      const service = new DirectService();
      expect(service).toBeDefined();
      expect(typeof service.test).toBe('function');
    });
  });

  describe('URL Construction', () => {
    it('should extract service name from FQDN', () => {
      const url = kubectlProxySingleton.getProxyUrl(
        'sandbox-service.test-env.svc.cluster.local',
        3000,
        '/api/test',
      );
      expect(url).toContain('services/sandbox-service:3000');
    });

    it('should extract service name from short name', () => {
      const url = kubectlProxySingleton.getProxyUrl('sandbox-service', 3000, '/api/test');
      expect(url).toContain('services/sandbox-service:3000');
    });

    it('should extract namespace from FQDN', () => {
      const url = kubectlProxySingleton.getProxyUrl(
        'sandbox-service.custom-ns.svc.cluster.local',
        3000,
        '/api/test',
      );
      expect(url).toContain('namespaces/custom-ns');
    });

    it('should use default namespace for short name', () => {
      const url = kubectlProxySingleton.getProxyUrl('sandbox-service', 3000, '/api/test');
      expect(url).toContain('namespaces/test-env');
    });
  });
});
