/**
 * HTTP client wrapper
 * Provides a unified interface for HTTP requests with proper error handling
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { Logger } from '@nestjs/common';
import { AdapterError } from '../../constant/constant';
import type { FormData } from 'formdata-node';

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  /** Base URL for all requests */
  baseURL?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Default headers */
  headers?: Record<string, string>;
  /** HTTP proxy URL */
  proxy?: string;
}

/**
 * HTTP client wrapper class
 */
export class HttpClient {
  private readonly logger = new Logger(HttpClient.name);
  private readonly axiosInstance: AxiosInstance;

  constructor(config: HttpClientConfig = {}) {
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: config.headers || {},
      ...(config.proxy && {
        proxy: this.parseProxyUrl(config.proxy),
      }),
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        throw this.transformError(error);
      },
    );
  }

  /**
   * Perform GET request
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  /**
   * Perform POST request
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  /**
   * Perform PUT request
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  /**
   * Perform DELETE request
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }

  /**
   * Perform PATCH request
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.patch<T>(url, data, config);
  }

  /**
   * Perform request with full control
   */
  async request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.request<T>(config);
  }

  /**
   * Set default header
   */
  setHeader(name: string, value: string): void {
    this.axiosInstance.defaults.headers.common[name] = value;
  }

  /**
   * Remove default header
   */
  removeHeader(name: string): void {
    delete this.axiosInstance.defaults.headers.common[name];
  }

  /**
   * Get all default headers
   */
  getHeaders(): Record<string, string> {
    return { ...this.axiosInstance.defaults.headers.common } as Record<string, string>;
  }

  /**
   * Create FormData from object
   */
  createFormData(data: Record<string, unknown>): FormData {
    const FormDataConstructor = globalThis.FormData || require('formdata-node').FormData;
    const formData = new FormDataConstructor();

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (value instanceof Buffer) {
        // Handle Buffer as File
        const blob = new Blob([value]);
        formData.append(key, blob, `${key}.bin`);
      } else if (
        value instanceof Blob ||
        (value as { constructor?: { name?: string } })?.constructor?.name === 'File'
      ) {
        // Handle Blob/File
        formData.append(key, value as Blob);
      } else if (Array.isArray(value)) {
        // Handle arrays
        value.forEach((item, index) => {
          formData.append(`${key}[${index}]`, String(item));
        });
      } else if (typeof value === 'object') {
        // Handle nested objects as JSON
        formData.append(key, JSON.stringify(value));
      } else {
        // Handle primitive values
        formData.append(key, String(value));
      }
    }

    return formData;
  }

  /**
   * Parse proxy URL into axios proxy config
   */
  private parseProxyUrl(proxyUrl: string): { host: string; port: number; protocol?: string } {
    try {
      const url = new URL(proxyUrl);
      return {
        host: url.hostname,
        port: Number.parseInt(url.port, 10),
        protocol: url.protocol.replace(':', ''),
      };
    } catch {
      throw new AdapterError(`Invalid proxy URL: ${proxyUrl}`, 'INVALID_PROXY_URL');
    }
  }

  /**
   * Transform axios error into AdapterError
   */
  private transformError(error: unknown): AdapterError {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;

      // Determine error code based on status
      let code = 'HTTP_ERROR';
      if (statusCode === 400) {
        code = 'BAD_REQUEST';
      } else if (statusCode === 401) {
        code = 'UNAUTHORIZED';
      } else if (statusCode === 403) {
        code = 'FORBIDDEN';
      } else if (statusCode === 404) {
        code = 'NOT_FOUND';
      } else if (statusCode === 429) {
        code = 'RATE_LIMIT_ERROR';
      } else if (statusCode && statusCode >= 500) {
        code = 'SERVER_ERROR';
      } else if (error.code === 'ECONNABORTED') {
        code = 'TIMEOUT';
      } else if (error.code) {
        code = error.code;
      }

      return new AdapterError(message, code, statusCode, {
        responseData: error.response?.data,
        headers: error.response?.headers,
      });
    }

    // Unknown error
    return new AdapterError((error as Error).message || 'Unknown error', 'UNKNOWN_ERROR');
  }
}
