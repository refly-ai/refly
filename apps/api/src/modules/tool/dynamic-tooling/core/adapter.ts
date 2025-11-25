/**
 * Adapter interfaces and base implementation
 * Combines interface definitions with base adapter class
 */

import { Logger } from '@nestjs/common';
import { DEFAULT_RETRYABLE_ERROR_CODES, AdapterError } from '../../constant/constant';
import type { AdapterRequest, AdapterResponse, RetryConfig } from '@refly/openapi-schema';
import type { AdapterTypeValue } from '../../constant';
import { AdapterType } from '../../constant';

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

/**
 * Base adapter implementation with retry logic and error handling
 */
export abstract class BaseAdapter implements IAdapter {
  protected readonly logger: Logger;
  protected readonly retryConfig: RetryConfig;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.logger = new Logger(this.constructor.name);
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? 3,
      initialDelay: retryConfig?.initialDelay ?? 1000,
      maxDelay: retryConfig?.maxDelay ?? 10000,
      backoffMultiplier: retryConfig?.backoffMultiplier ?? 2,
      retryableStatusCodes: retryConfig?.retryableStatusCodes ?? [429, 500, 502, 503, 504],
      retryableErrorCodes:
        retryConfig?.retryableErrorCodes ?? Array.from(DEFAULT_RETRYABLE_ERROR_CODES),
    };
  }

  /**
   * Execute request with retry logic
   */
  async execute(request: AdapterRequest): Promise<AdapterResponse> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        // Execute the actual request (implemented by subclasses)
        const response = await this.executeInternal(request);
        return response;
      } catch (error) {
        lastError = error as Error;
        attempt++;
        // Check if we should retry
        if (attempt > this.retryConfig.maxRetries || !this.shouldRetry(error as AdapterError)) {
          throw this.wrapError(error as Error);
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // Should never reach here, but just in case
    throw this.wrapError(lastError || new Error('Request failed after maximum retries'));
  }

  /**
   * Execute the actual request (implemented by subclasses)
   */
  protected abstract executeInternal(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Get adapter type
   */
  abstract getType(): 'http' | 'sdk';

  /**
   * Check if adapter is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Subclasses can override this for specific health checks
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Determine if an error should trigger a retry
   */
  protected shouldRetry(error: AdapterError): boolean {
    // Retry on network errors
    if (error.code && this.retryConfig.retryableErrorCodes?.includes(error.code)) {
      return true;
    }

    // Retry on specific status codes
    if (error.statusCode && this.retryConfig.retryableStatusCodes?.includes(error.statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  protected calculateDelay(attempt: number): number {
    const delay =
      this.retryConfig.initialDelay * this.retryConfig.backoffMultiplier ** (attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wrap error into AdapterError
   */
  protected wrapError(error: Error): AdapterError {
    if (error instanceof AdapterError) {
      return error;
    }

    const errorWithStatus = error as { code?: string; statusCode?: number };
    return new AdapterError(
      error.message,
      errorWithStatus.code || 'ADAPTER_ERROR',
      errorWithStatus.statusCode,
      { originalError: error.name },
    );
  }

  /**
   * Validate request before execution
   */
  protected validateRequest(request: AdapterRequest): void {
    if (!request.endpoint) {
      throw new AdapterError('Endpoint is required', 'INVALID_REQUEST');
    }

    if (!request.params || typeof request.params !== 'object') {
      throw new AdapterError('Params must be an object', 'INVALID_REQUEST');
    }
  }
}
