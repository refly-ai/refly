import { Langfuse } from 'langfuse';

export interface LangfuseConfig {
  secretKey?: string;
  publicKey?: string;
  baseUrl?: string;
  enabled?: boolean;
  flushAt?: number;
  flushInterval?: number;
  requestTimeout?: number;
}

export interface SecurityFilterConfig {
  sensitiveKeys?: string[];
  maxStringLength?: number;
  enableDataMasking?: boolean;
}

/**
 * Security filter to remove sensitive information from data
 */
export class SecurityFilter {
  private sensitiveKeys: Set<string>;
  private maxStringLength: number;
  private enableDataMasking: boolean;

  constructor(config: SecurityFilterConfig = {}) {
    this.sensitiveKeys = new Set([
      'password',
      'token',
      'key',
      'secret',
      'auth',
      'credential',
      'api_key',
      'apikey',
      'authorization',
      'bearer',
      ...(config.sensitiveKeys || []),
    ]);
    this.maxStringLength = config.maxStringLength || 10000;
    this.enableDataMasking = config.enableDataMasking ?? true;
  }

  /**
   * Filter sensitive data from an object
   */
  filterSensitiveData(data: any): any {
    if (!this.enableDataMasking) {
      return data;
    }

    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.truncateString(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.filterSensitiveData(item));
    }

    if (typeof data === 'object') {
      const filtered: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveKey(key)) {
          filtered[key] = '[REDACTED]';
        } else {
          filtered[key] = this.filterSensitiveData(value);
        }
      }
      return filtered;
    }

    return data;
  }

  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return Array.from(this.sensitiveKeys).some((sensitiveKey) => lowerKey.includes(sensitiveKey));
  }

  private truncateString(str: string): string {
    if (str.length <= this.maxStringLength) {
      return str;
    }
    return str.substring(0, this.maxStringLength) + '... [TRUNCATED]';
  }
}

/**
 * Langfuse client manager with security filtering
 */
export class LangfuseClientManager {
  private static instance: LangfuseClientManager;
  private client: Langfuse | null = null;
  private securityFilter: SecurityFilter;
  private config: LangfuseConfig;
  private isEnabled = false;

  private constructor() {
    this.securityFilter = new SecurityFilter();
    this.config = {};
  }

  static getInstance(): LangfuseClientManager {
    if (!LangfuseClientManager.instance) {
      LangfuseClientManager.instance = new LangfuseClientManager();
    }
    return LangfuseClientManager.instance;
  }

  /**
   * Initialize Langfuse client with configuration
   */
  initialize(config: LangfuseConfig, securityConfig?: SecurityFilterConfig): void {
    this.config = config;
    this.isEnabled = config.enabled ?? false;

    if (securityConfig) {
      this.securityFilter = new SecurityFilter(securityConfig);
    }

    if (!this.isEnabled) {
      console.log('[Langfuse] Monitoring is disabled');
      return;
    }

    if (!config.secretKey || !config.publicKey) {
      console.warn('[Langfuse] Missing required keys, monitoring will be disabled');
      this.isEnabled = false;
      return;
    }

    try {
      this.client = new Langfuse({
        secretKey: config.secretKey,
        publicKey: config.publicKey,
        baseUrl: config.baseUrl,
        flushAt: config.flushAt || 15,
        flushInterval: config.flushInterval || 1000,
        requestTimeout: config.requestTimeout || 10000,
      });

      console.log('[Langfuse] Client initialized successfully');
    } catch (error) {
      console.error('[Langfuse] Failed to initialize client:', error);
      this.isEnabled = false;
      this.client = null;
    }
  }

  /**
   * Get the Langfuse client instance
   */
  getClient(): Langfuse | null {
    return this.isEnabled ? this.client : null;
  }

  /**
   * Check if Langfuse monitoring is enabled
   */
  isMonitoringEnabled(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Filter sensitive data using security filter
   */
  filterData(data: any): any {
    return this.securityFilter.filterSensitiveData(data);
  }

  /**
   * Shutdown the client and flush pending data
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.shutdownAsync();
        console.log('[Langfuse] Client shutdown completed');
      } catch (error) {
        console.error('[Langfuse] Error during shutdown:', error);
      }
    }
  }

  /**
   * Flush pending data immediately
   */
  async flush(): Promise<void> {
    if (this.client) {
      try {
        await this.client.flushAsync();
      } catch (error) {
        console.error('[Langfuse] Error during flush:', error);
      }
    }
  }
}
