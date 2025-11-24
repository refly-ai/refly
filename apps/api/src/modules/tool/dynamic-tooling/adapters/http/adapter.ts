/**
 * HTTP adapter implementation
 * Handles HTTP-based API calls with optional async task polling
 */

import type {
  AdapterRequest,
  AdapterResponse,
  HttpAdapterConfig,
  PollingConfig,
} from '@refly/openapi-schema';
import axios, { AxiosResponse } from 'axios';
import { AdapterType, HttpMethod } from '../../../constant';
import { BaseAdapter } from '../../core/base';
import type { IHttpAdapter } from '../../core/interfaces';
import { AdapterError } from '../types';
import { HttpClient } from './client';

/**
 * HTTP adapter for making HTTP API calls with intelligent polling support
 */
export class HttpAdapter extends BaseAdapter implements IHttpAdapter {
  private readonly httpClient: HttpClient;
  private readonly pollingConfig?: PollingConfig;

  constructor(config: HttpAdapterConfig = {}) {
    super({
      maxRetries: config.maxRetries,
      initialDelay: config.retryDelay,
    });

    this.httpClient = new HttpClient({
      timeout: config.timeout,
      headers: config.defaultHeaders,
      proxy: config.proxy,
    });

    // Store polling configuration
    this.pollingConfig = config.polling;
  }

  /**
   * Get adapter type
   */
  getType(): typeof AdapterType.HTTP {
    return AdapterType.HTTP;
  }

  /**
   * Set default headers
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    for (const [key, value] of Object.entries(headers)) {
      this.httpClient.setHeader(key, value);
    }
  }

  /**
   * Get default headers
   */
  getDefaultHeaders(): Record<string, string> {
    return this.httpClient.getHeaders();
  }

  /**
   * Execute HTTP request with optional polling support
   */
  protected async executeInternal(request: AdapterRequest): Promise<AdapterResponse> {
    this.validateRequest(request);

    // Execute initial request
    const initialResponse = await this.executeHttpRequest(request);

    // If polling is not configured, return immediately
    if (!this.pollingConfig?.statusUrl) {
      return initialResponse;
    }

    // Auto-detect task ID from initial response
    const taskId = this.autoDetectTaskId(initialResponse.data);
    if (!taskId) {
      throw new AdapterError(
        'Polling configured but no task ID found in response',
        'POLLING_TASK_ID_NOT_FOUND',
      );
    }

    // Start polling
    this.logger.log(`Task ${taskId} created, starting polling...`);
    return await this.pollUntilComplete(taskId, request);
  }

  /**
   * Execute standard HTTP request (extracted from executeInternal)
   */
  private async executeHttpRequest(request: AdapterRequest): Promise<AdapterResponse> {
    try {
      // Prepare headers
      const headers = {
        ...this.httpClient.getHeaders(),
        ...request.headers,
      };

      // Add authentication headers from credentials
      if (request.credentials) {
        this.addAuthHeaders(headers, request.credentials);
      }
      // Prepare request data
      let requestData: unknown;
      const contentType = headers['Content-Type'] || headers['content-type'];

      if (request.useFormData) {
        // Use FormData for file uploads
        requestData = this.httpClient.createFormData(request.params);
        // Don't set Content-Type header for FormData, let axios set it with boundary
        headers['Content-Type'] = undefined;
        headers['content-type'] = undefined;
      } else {
        // Use request params directly
        requestData = request.params;
        // Only set Content-Type to JSON if:
        // 1. No Content-Type is specified
        // 2. Request has body data (params is not empty)
        // 3. Request method is not GET (GET requests typically don't have body)
        const hasBodyData =
          requestData && typeof requestData === 'object' && Object.keys(requestData).length > 0;
        const method = request.method?.toUpperCase() || 'POST';
        if (!contentType && hasBodyData && method !== 'GET') {
          headers['Content-Type'] = 'application/json';
        }
      }

      // Execute request based on HTTP method
      const method = request.method?.toUpperCase() || HttpMethod.POST;
      let response: AxiosResponse;

      switch (method) {
        case 'GET':
          response = await this.httpClient.get(request.endpoint, {
            params: request.params,
            headers,
            timeout: request.timeout,
            responseType: 'arraybuffer',
          });
          break;

        case 'POST':
          response = await this.httpClient.post(request.endpoint, requestData, {
            headers,
            timeout: request.timeout,
            responseType: 'arraybuffer',
          });
          break;

        case 'PUT':
          response = await this.httpClient.put(request.endpoint, requestData, {
            headers,
            timeout: request.timeout,
            responseType: 'arraybuffer',
          });
          break;

        case 'DELETE':
          response = await this.httpClient.delete(request.endpoint, {
            headers,
            timeout: request.timeout,
            data: requestData,
            responseType: 'arraybuffer',
          });
          break;

        case 'PATCH':
          response = await this.httpClient.patch(request.endpoint, requestData, {
            headers,
            timeout: request.timeout,
            responseType: 'arraybuffer',
          });
          break;

        default:
          throw new AdapterError(`Unsupported HTTP method: ${method}`, 'UNSUPPORTED_METHOD');
      }
      // Process response based on content type
      const responseContentType = response.headers['content-type'] || '';
      const processedData = this.processResponseData(response.data, responseContentType, response);

      // Return adapter response
      return {
        data: processedData,
        status: response.status,
        headers: response.headers as Record<string, string>,
        raw: response,
      };
    } catch (error) {
      // Re-throw AdapterError as-is
      if (error instanceof AdapterError) {
        throw error;
      }
      // Wrap other errors
      throw this.wrapError(error as Error);
    }
  }

  /**
   * Process response data based on content type
   * Automatically detects binary responses and converts them to buffer objects
   * Handles arraybuffer responses for both JSON and binary data
   */
  private processResponseData(
    data: unknown,
    contentType: string,
    response: AxiosResponse,
  ): unknown {
    // Check if response is binary (non-JSON)
    if (this.isBinaryResponse(contentType)) {
      return this.handleBinaryResponse(data, contentType, response);
    }

    // If data is ArrayBuffer or Buffer but content-type is JSON, parse it
    if (
      contentType.includes('application/json') ||
      contentType.includes('text/json') ||
      !contentType
    ) {
      if (data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
        try {
          const text = Buffer.from(data as ArrayBuffer).toString('utf-8');
          return JSON.parse(text);
        } catch (error) {
          this.logger.warn(
            `Failed to parse arraybuffer as JSON for content-type: ${contentType}`,
            error,
          );
          return data;
        }
      }
    }

    // Return data as-is for other content types
    return data;
  }

  /**
   * Check if content type indicates binary response
   */
  private isBinaryResponse(contentType: string): boolean {
    const binaryTypes = [
      'audio/',
      'video/',
      'image/',
      'application/octet-stream',
      'application/pdf',
    ];
    return binaryTypes.some((type) => contentType.includes(type));
  }

  private handleBinaryResponse(
    data: unknown,
    contentType: string,
    response: AxiosResponse,
  ): { buffer: Buffer; filename: string; mimetype: string } {
    const buffer = this.normalizeToBuffer(data);
    const filename = this.extractFilename(response) || this.generateFilename(contentType);

    return {
      buffer,
      filename,
      mimetype: contentType || 'application/octet-stream',
    };
  }

  private normalizeToBuffer(data: unknown): Buffer {
    if (Buffer.isBuffer(data)) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return Buffer.from(data);
    }
    if (data instanceof Uint8Array) {
      return Buffer.from(data);
    }
    if (Array.isArray(data)) {
      return Buffer.from(data);
    }
    if (typeof data === 'string') {
      throw new Error('Expected binary response but got string. Check axios responseType.');
    }

    throw new Error(`Unsupported binary data type: ${typeof data}`);
  }

  /**
   * Extract filename from Content-Disposition header or URL
   */
  private extractFilename(response: AxiosResponse): string | null {
    // Try Content-Disposition header first
    const disposition = response.headers['content-disposition'];
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match?.[1]) {
        return match[1].replace(/['"]/g, '');
      }
    }

    // Try to extract from URL
    try {
      const url = response.config?.url;
      if (url) {
        const pathname = new URL(url, 'http://dummy').pathname;
        const filename = pathname.split('/').pop();
        if (filename?.includes('.')) {
          return filename;
        }
      }
    } catch {
      // Ignore URL parsing errors
    }

    return null;
  }

  /**
   * Generate filename from MIME type
   */
  private generateFilename(contentType: string): string {
    const ext = this.getExtensionFromMimeType(contentType);
    return `file-${Date.now()}.${ext}`;
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimetype: string): string {
    const map: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'application/octet-stream': 'bin',
    };

    // Extract base type (remove charset, etc.)
    const baseType = mimetype.split(';')[0].trim().toLowerCase();
    return map[baseType] || 'bin';
  }

  /**
   * Add authentication headers based on credentials
   */
  private addAuthHeaders(
    headers: Record<string, string>,
    credentials: Record<string, unknown>,
  ): void {
    // API Key authentication (custom header takes precedence)
    if (credentials.apiKeyHeader && credentials.apiKey) {
      headers[credentials.apiKeyHeader as string] = credentials.apiKey as string;
    } else if (credentials.apiKey) {
      headers.Authorization = `Bearer ${credentials.apiKey}`;
    }

    // Basic authentication
    if (credentials.username && credentials.password) {
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString(
        'base64',
      );
      headers.Authorization = `Basic ${auth}`;
    }

    // OAuth token
    if (credentials.accessToken) {
      headers.Authorization = `Bearer ${credentials.accessToken}`;
    }

    // Custom API key header
    if (credentials.apiKeyHeader && credentials.apiKey) {
      headers[credentials.apiKeyHeader as string] = credentials.apiKey as string;
    }
  }

  /**
   * Auto-detect task ID from response
   */
  private autoDetectTaskId(data: any): string | null {
    const TASK_ID_FIELDS = [
      'id',
      'request_id',
      'requestId',
      'video_id',
      'videoId',
      'task_id',
      'taskId',
      'job_id',
      'jobId',
      'prediction_id',
      'predictionId',
      'data.id',
      'data.video_id',
      'data.task_id',
      'data.request_id',
      'data.job_id',
    ];

    for (const field of TASK_ID_FIELDS) {
      const value = this.getNestedValue(data, field);
      if (value && typeof value === 'string') {
        this.logger.log(`✅ Task ID detected: ${field} = ${value}`);
        return value;
      }
    }

    return null;
  }

  /**
   * Poll task status until complete, failed, or timeout
   */
  private async pollUntilComplete(
    taskId: string,
    request: AdapterRequest,
  ): Promise<AdapterResponse> {
    const config = this.pollingConfig!;
    const maxWaitSeconds = config.maxWaitSeconds || 300;
    const intervalSeconds = config.intervalSeconds || 5;

    const maxAttempts = Math.ceil(maxWaitSeconds / intervalSeconds);
    const pollInterval = intervalSeconds * 1000;

    const statusUrlTemplate = config.statusUrl;
    const isAbsolute = /^https?:\/\//i.test(statusUrlTemplate);
    if (!isAbsolute) {
      throw new AdapterError(
        `Polling statusUrl must be absolute: ${statusUrlTemplate}`,
        'INVALID_POLLING_URL',
      );
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Build status URL by replacing {id} placeholder
      const statusUrl = statusUrlTemplate.replace('{id}', taskId);

      this.logger.log(`Polling ${attempt}/${maxAttempts}: ${statusUrl}`);

      // Build headers for polling (reuse default/request headers + auth)
      const pollHeaders = {
        ...this.httpClient.getHeaders(),
        ...request.headers,
      };
      if (request.credentials) {
        this.addAuthHeaders(pollHeaders, request.credentials);
      }

      // Execute status check
      const response = await this.httpClient.get(statusUrl, {
        headers: pollHeaders,
        timeout: request.timeout,
      });
      const data = this.parseResponse(response);

      // Auto-detect status
      const status = this.autoDetectStatus(data);
      if (!status) {
        this.logger.warn('Cannot detect status field, assuming not ready');
        if (attempt < maxAttempts) {
          await this.sleep(pollInterval);
        }
        continue;
      }

      this.logger.log(`Task ${taskId} status: ${status}`);

      // Check if completed (case-insensitive)
      const COMPLETED_STATUSES = ['completed', 'success', 'succeeded', 'done'];
      if (COMPLETED_STATUSES.includes(status.toLowerCase())) {
        this.logger.log(`✅ Task ${taskId} completed`);

        // Auto-extract result data
        const resultData = this.autoExtractResult(data);

        // Auto-download file if URL found
        const finalData = await this.autoDownloadIfNeeded(resultData, taskId);

        return {
          data: finalData,
          status: response.status,
          headers: response.headers as Record<string, string>,
          raw: response,
        };
      }

      // Check if failed (case-insensitive)
      const FAILED_STATUSES = ['failed', 'error', 'cancelled', 'canceled'];
      if (FAILED_STATUSES.includes(status.toLowerCase())) {
        const errorMsg = this.autoDetectError(data);
        throw new AdapterError(
          errorMsg || `Task failed with status: ${status}`,
          'TASK_FAILED',
          response.status,
          { responseData: data },
        );
      }

      // Wait before next poll (skip on last attempt)
      if (attempt < maxAttempts) {
        await this.sleep(pollInterval);
      }
    }

    throw new AdapterError(
      `Polling timeout after ${maxWaitSeconds} seconds`,
      'POLLING_TIMEOUT',
      408,
    );
  }

  /**
   * Auto-detect status field from response
   */
  private autoDetectStatus(data: any): string | null {
    const STATUS_FIELDS = ['status', 'state', 'data.status', 'data.state', 'task.status'];

    for (const field of STATUS_FIELDS) {
      const value = this.getNestedValue(data, field);
      if (value && typeof value === 'string') {
        return value;
      }
    }

    return null;
  }

  /**
   * Auto-extract result data from response
   */
  private autoExtractResult(data: any): any {
    const RESULT_FIELDS = ['data', 'result', 'output'];

    // Try standard result fields
    for (const field of RESULT_FIELDS) {
      const value = this.getNestedValue(data, field);
      if (value && typeof value === 'object') {
        return value;
      }
    }

    // Default: return full data
    return data;
  }

  /**
   * Auto-detect error message from response
   */
  private autoDetectError(data: any): string | null {
    const ERROR_FIELDS = [
      'error',
      'error.message',
      'data.error',
      'data.error.message',
      'message',
      'error_message',
    ];

    for (const field of ERROR_FIELDS) {
      const value = this.getNestedValue(data, field);
      if (value && typeof value === 'string') {
        return value;
      }
    }

    return null;
  }

  /**
   * Auto-download file if response contains URL
   */
  private async autoDownloadIfNeeded(data: any, taskId: string): Promise<any> {
    // Recursively find all URLs
    const urls = this.findAllUrls(data);

    if (urls.length === 0) {
      return data;
    }

    // Download first URL (primary file)
    const primaryUrl = urls[0];
    this.logger.log(`🔽 Downloading from: ${primaryUrl.path} = ${primaryUrl.value}`);

    return await this.downloadFile(primaryUrl.value, data, taskId);
  }

  /**
   * Recursively find all HTTP(S) URLs in object
   */
  private findAllUrls(obj: any, prefix = ''): Array<{ path: string; value: string }> {
    const urls: Array<{ path: string; value: string }> = [];

    if (typeof obj === 'string' && obj.startsWith('http')) {
      return [{ path: prefix, value: obj }];
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        urls.push(...this.findAllUrls(item, `${prefix}[${index}]`));
      });
    } else if (obj && typeof obj === 'object') {
      // Priority fields (check first)
      const PRIORITY_FIELDS = [
        'video_url',
        'videoUrl',
        'audio_url',
        'audioUrl',
        'file_url',
        'fileUrl',
        'url',
        'download_url',
        'downloadUrl',
      ];

      for (const key of PRIORITY_FIELDS) {
        if (obj[key]) {
          const found = this.findAllUrls(obj[key], prefix ? `${prefix}.${key}` : key);
          if (found.length > 0) {
            urls.push(...found);
            return urls; // Found, stop searching
          }
        }
      }

      // Search other fields
      for (const [key, value] of Object.entries(obj)) {
        if (!PRIORITY_FIELDS.includes(key)) {
          urls.push(...this.findAllUrls(value, prefix ? `${prefix}.${key}` : key));
        }
      }
    }

    return urls;
  }

  /**
   * Download file from URL
   */
  private async downloadFile(url: string, originalData: any, taskId: string): Promise<any> {
    try {
      this.logger.log(`Downloading file from: ${url}`);

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 600000, // 10 minutes for large files
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || '';

      // Infer file extension
      const ext = this.guessExtension(contentType, url);
      const filename = `file-${taskId}.${ext}`;

      this.logger.log(`✅ Downloaded ${buffer.length} bytes as ${filename}`);

      return {
        ...originalData,
        buffer,
        filename,
        mimetype: contentType || 'application/octet-stream',
      };
    } catch (error) {
      this.logger.error(`Failed to download file: ${(error as Error).message}`);
      // Return original data on download failure (graceful degradation)
      return originalData;
    }
  }

  /**
   * Guess file extension from MIME type or URL
   */
  private guessExtension(contentType: string, url: string): string {
    // Try to extract from URL
    const urlMatch = url.match(/\.(\w+)(\?|$)/);
    if (urlMatch) return urlMatch[1];

    // Map MIME type to extension
    const mimeMap: Record<string, string> = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };

    const baseType = contentType.split(';')[0].trim().toLowerCase();
    return mimeMap[baseType] || 'bin';
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!path || !obj) return undefined;

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current?.[key] === undefined) return undefined;
      current = current[key];
    }

    return current;
  }

  /**
   * Parse response data (handle arraybuffer for JSON)
   */
  private parseResponse(response: AxiosResponse): any {
    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      if (Buffer.isBuffer(response.data) || response.data instanceof ArrayBuffer) {
        return JSON.parse(Buffer.from(response.data).toString('utf-8'));
      }
      return response.data;
    }

    return response.data;
  }

  /**
   * Check if adapter is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Just check if we can make a simple request
      // Subclasses can override for more specific health checks
      return true;
    } catch {
      return false;
    }
  }
}
