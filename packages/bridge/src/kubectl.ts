import { spawn, ChildProcess } from 'node:child_process';
import { createLogger } from './lib/logger';
import { ensure } from './lib/ensure';
import { KubectlProxyError } from './lib/exceptions';

const logger = createLogger({ component: 'kubectl-proxy' });

export class KubectlProxyManager {
  private process: ChildProcess | null = null;

  constructor(private readonly port: number) {}

  async isRunning(): Promise<boolean> {
    try {
      const axios = (await import('axios')).default;
      await axios.get(`http://localhost:${this.port}/api`, { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  async start(): Promise<void> {
    logger.info({ port: this.port }, 'Starting kubectl proxy');

    this.process = spawn('kubectl', ['proxy', '--port', String(this.port)], {
      detached: false,
      stdio: 'ignore',
    });

    this.process.on('error', (err) => {
      logger.error({ error: err.message }, 'kubectl proxy error');
    });

    for (let i = 0; i < 30; i++) {
      if (await this.isRunning()) {
        logger.info({ port: this.port }, 'kubectl proxy started successfully');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    ensure(false).orThrow(
      () =>
        new KubectlProxyError('kubectl proxy failed to start within 3 seconds', {
          port: this.port,
          timeout: 3000,
        }),
    );
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      logger.info({ port: this.port }, 'kubectl proxy stopped');
    }
  }
}

export class KubectlProxySingleton {
  private static instance: KubectlProxySingleton | null = null;
  private proxy: KubectlProxyManager | null = null;
  private cleanupRegistered = false;

  private constructor() {}

  static getInstance(): KubectlProxySingleton {
    if (!KubectlProxySingleton.instance) {
      KubectlProxySingleton.instance = new KubectlProxySingleton();
    }
    return KubectlProxySingleton.instance;
  }

  private getConfig() {
    return {
      enabled: process.env.BRIDGE_KUBECTL_PROXY_ENABLED === 'true',
      port: Number.parseInt(process.env.BRIDGE_KUBECTL_PROXY_PORT || '8001', 10),
      namespace: process.env.BRIDGE_K8S_NAMESPACE || 'default',
    };
  }

  async ensureRunning(): Promise<void> {
    const config = this.getConfig();

    if (!config.enabled) {
      return;
    }

    if (!this.cleanupRegistered) {
      this.registerCleanup();
      this.cleanupRegistered = true;
    }

    if (!this.proxy) {
      this.proxy = new KubectlProxyManager(config.port);
    }

    if (!(await this.proxy.isRunning())) {
      await this.proxy.start();
    }
  }

  getProxyUrl(host: string, port: number, path: string): string {
    const config = this.getConfig();

    if (!config.enabled) {
      return `http://${host}:${port}${path}`;
    }

    const serviceName = this.extractServiceName(host);
    const namespace = this.extractNamespace(host) || config.namespace;

    return `http://localhost:${config.port}/api/v1/namespaces/${namespace}/services/${serviceName}:${port}/proxy${path}`;
  }

  private extractServiceName(host: string): string {
    return host.split('.')[0];
  }

  private extractNamespace(host: string): string | null {
    const parts = host.split('.');
    return parts.length > 1 ? parts[1] : null;
  }

  private registerCleanup(): void {
    const cleanup = () => {
      if (this.proxy) {
        this.proxy.stop();
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

export const kubectlProxySingleton = KubectlProxySingleton.getInstance();
