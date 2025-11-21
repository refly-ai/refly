/**
 * SDK adapter implementation
 * Handles SDK-based API calls with dynamic loading
 */

import type { ISdkAdapter } from '../../core/interfaces';
import { BaseAdapter } from '../../core/base';
import type { AdapterRequest, AdapterResponse, SdkAdapterConfig } from '@refly/openapi-schema';
import { AdapterError } from '../types';
import { AdapterType } from '../../constant';

/**
 * SDK adapter for making SDK-based API calls
 * Uses dynamic imports to load SDKs at runtime
 */
export class SdkAdapter extends BaseAdapter implements ISdkAdapter {
  private sdkClient: unknown;
  private readonly config: SdkAdapterConfig;

  constructor(config: SdkAdapterConfig) {
    super();
    this.config = config;
  }

  /**
   * Get adapter type
   */
  getType(): typeof AdapterType.SDK {
    return AdapterType.SDK;
  }

  /**
   * Get SDK client instance
   */
  getClient(): unknown {
    if (!this.sdkClient) {
      throw new AdapterError('SDK client not initialized', 'SDK_NOT_INITIALIZED');
    }
    return this.sdkClient;
  }

  /**
   * Initialize SDK client
   */
  async initialize(credentials: Record<string, unknown>): Promise<void> {
    try {
      if (this.config.clientFactory) {
        // Use provided factory function
        const factory = this.config.clientFactory as (creds: Record<string, unknown>) => unknown;
        this.sdkClient = factory(credentials);
      } else {
        // Dynamic import of SDK package
        const sdkModule = await import(this.config.packageName);

        // Try common patterns for SDK client initialization
        const ClientClass = sdkModule.default || sdkModule[this.getClientClassName()];

        if (!ClientClass) {
          throw new AdapterError(
            `Could not find client class in SDK package: ${this.config.packageName}`,
            'SDK_CLIENT_NOT_FOUND',
          );
        }

        this.sdkClient = new ClientClass(credentials);
      }

      this.logger.log(`SDK client initialized: ${this.config.packageName}`);
    } catch (error) {
      this.logger.error(`Failed to initialize SDK client: ${(error as Error).message}`);
      throw new AdapterError(
        `Failed to initialize SDK: ${(error as Error).message}`,
        'SDK_INITIALIZATION_FAILED',
      );
    }
  }

  /**
   * Reload SDK client with new credentials
   */
  async reloadClient(credentials: Record<string, unknown>): Promise<void> {
    this.sdkClient = undefined;
    await this.initialize(credentials);
  }

  /**
   * Execute SDK method call
   */
  protected async executeInternal(request: AdapterRequest): Promise<AdapterResponse> {
    this.validateRequest(request);

    if (!this.sdkClient) {
      throw new AdapterError('SDK client not initialized', 'SDK_NOT_INITIALIZED');
    }

    try {
      // Parse method path (e.g., 'client.textToSpeech.convert')
      const methodPath = request.endpoint || this.config.methodPath;
      const method = this.resolveMethod(this.sdkClient, methodPath);

      if (typeof method !== 'function') {
        throw new AdapterError(`Method not found: ${methodPath}`, 'METHOD_NOT_FOUND');
      }

      // Transform parameters if transformer is provided
      const params = this.config.paramTransformer
        ? (this.config.paramTransformer as (params: unknown) => unknown)(request.params)
        : request.params;

      // Execute the SDK method
      const result = await method(params);

      return {
        data: result,
        raw: result,
      };
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }

      throw this.wrapError(error as Error);
    }
  }

  /**
   * Resolve method from object by path
   */
  private resolveMethod(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (!current || typeof current !== 'object') {
        throw new AdapterError(`Invalid method path: ${path}`, 'INVALID_METHOD_PATH');
      }

      current = (current as Record<string, unknown>)[part];

      if (current === undefined) {
        throw new AdapterError(`Method not found: ${path}`, 'METHOD_NOT_FOUND');
      }
    }

    return current;
  }

  /**
   * Get client class name from package name
   */
  private getClientClassName(): string {
    // Convert package name to class name
    // e.g., 'fish-audio-sdk' -> 'FishAudioClient'
    const parts = this.config.packageName.split('-').filter((p) => p !== 'sdk');
    return `${parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')}Client`;
  }

  /**
   * Check if adapter is healthy
   */
  async isHealthy(): Promise<boolean> {
    return this.sdkClient !== undefined;
  }
}
