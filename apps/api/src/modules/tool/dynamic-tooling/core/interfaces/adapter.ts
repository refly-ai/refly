/**
 * Adapter interface definitions
 */

import type { AdapterRequest, AdapterResponse } from '@refly/openapi-schema';
import type { AdapterTypeValue } from '../../../constant';
import { AdapterType } from '../../../constant';

/**
 * Base adapter interface
 * Abstracts HTTP/SDK API calls
 */
export interface IAdapter {
  /**
   * Execute an API call
   * @param request - Adapter request
   * @returns Promise resolving to adapter response
   */
  execute(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Get adapter type
   * @returns Adapter type identifier
   */
  getType(): AdapterTypeValue;

  /**
   * Check if the adapter is healthy
   * @returns true if adapter is ready to use
   */
  isHealthy(): Promise<boolean>;
}

/**
 * HTTP-specific adapter interface
 */
export interface IHttpAdapter extends IAdapter {
  /**
   * Get adapter type (always 'http')
   */
  getType(): typeof AdapterType.HTTP;

  /**
   * Set default headers for all requests
   * @param headers - Headers to set
   */
  setDefaultHeaders(headers: Record<string, string>): void;

  /**
   * Get current default headers
   * @returns Default headers
   */
  getDefaultHeaders(): Record<string, string>;
}

/**
 * SDK-specific adapter interface
 */
export interface ISdkAdapter extends IAdapter {
  /**
   * Get adapter type (always 'sdk')
   */
  getType(): typeof AdapterType.SDK;

  /**
   * Get SDK client instance
   * @returns SDK client
   */
  getClient(): unknown;

  /**
   * Reload SDK client with new credentials
   * @param credentials - New credentials
   */
  reloadClient(credentials: Record<string, unknown>): Promise<void>;
}
