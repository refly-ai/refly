/**
 * Adapter factory
 * Creates HTTP adapter instances based on configuration
 */

import { Injectable } from '@nestjs/common';
import type { IAdapter } from './adapter';
import { HttpAdapter } from './http-adapter';
import type { HttpAdapterConfig, ParsedMethodConfig } from '@refly/openapi-schema';

/**
 * Adapter factory service
 * Creates HTTP adapters for tool methods
 */
@Injectable()
export class AdapterFactory {
  /**
   * Create an adapter for a tool method
   */
  async createAdapter(
    methodConfig: ParsedMethodConfig,
    credentials: Record<string, unknown>,
  ): Promise<IAdapter> {
    // Create HTTP adapter
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
}
