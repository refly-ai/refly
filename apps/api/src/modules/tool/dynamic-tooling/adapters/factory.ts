/**
 * Adapter factory
 * Creates appropriate adapter instances based on configuration
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IAdapter } from '../core/adapter';
import { HttpAdapter } from './http-adapter';
import { SdkAdapter } from './sdk-adapter';
import type {
  HttpAdapterConfig,
  ParsedMethodConfig,
  SdkAdapterConfig,
} from '@refly/openapi-schema';

/**
 * Adapter factory service
 * Creates HTTP or SDK adapters based on tool configuration
 */
@Injectable()
export class AdapterFactory {
  private readonly logger = new Logger(AdapterFactory.name);

  /**
   * Create an adapter for a tool method
   */
  async createAdapter(
    methodConfig: ParsedMethodConfig,
    credentials: Record<string, unknown>,
  ): Promise<IAdapter> {
    // Check if method uses SDK
    if (methodConfig.useSdk && methodConfig.sdkPackage) {
      return this.createSdkAdapter(methodConfig, credentials);
    }
    // Default to HTTP adapter
    return this.createHttpAdapter(methodConfig, credentials);
  }

  /**
   * Create HTTP adapter
   */
  private createHttpAdapter(
    methodConfig: ParsedMethodConfig & {
      polling?: Record<string, unknown>;
      defaultHeaders?: Record<string, string>;
    },
    _credentials: Record<string, unknown>,
  ): HttpAdapter {
    const config: HttpAdapterConfig = {
      defaultHeaders: methodConfig.defaultHeaders,
      timeout: methodConfig.timeout || 30000,
      maxRetries: methodConfig.maxRetries || 3,
      retryDelay: 1000,
      polling: methodConfig.polling as HttpAdapterConfig['polling'],
    };
    const adapter = new HttpAdapter(config);
    return adapter;
  }

  /**
   * Create SDK adapter
   */
  private async createSdkAdapter(
    methodConfig: ParsedMethodConfig,
    credentials: Record<string, unknown>,
  ): Promise<SdkAdapter> {
    if (!methodConfig.sdkPackage) {
      throw new Error(`SDK package not specified for method: ${methodConfig.name}`);
    }

    const config: SdkAdapterConfig = {
      packageName: methodConfig.sdkPackage,
      methodPath: methodConfig.sdkMethod || 'execute',
    };

    const adapter = new SdkAdapter(config);

    // Initialize SDK with credentials
    await adapter.initialize(credentials);

    this.logger.log(
      `Created SDK adapter for method: ${methodConfig.name} (${methodConfig.sdkPackage})`,
    );
    return adapter;
  }
}
