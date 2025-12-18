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
import { supportedMimeTypes } from 'file-type';
import { AdapterType, HttpMethod, AdapterError } from '../../constant/constant';
import { BaseAdapter, type IHttpAdapter } from '../core/adapter';
import { HttpClient } from './http-client';
import { getToolName, getToolsetKey } from '../../tool-context';
import { isVolcengineAuth, VolcenginePollingHelper, applyVolcengineSigning } from './volcengine';

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

    // If polling is not configured, process and return immediately
    if (!this.pollingConfig?.statusUrl) {
      return initialResponse;
    }

    // Handle async polling and process final response
    return await this.handleAsyncPolling(initialResponse, request);
  }

  /**
   * Handle async polling - detect task ID and poll until complete
   */
  private async handleAsyncPolling(
    initialResponse: AdapterResponse,
    request: AdapterRequest,
  ): Promise<AdapterResponse> {
    const toolsetKey = getToolsetKey() || '';
    // Use Volcengine-specific polling for Volcengine toolsets
    // This handles task_id extraction from data.task_id (not request_id)
    if (toolsetKey.startsWith('volcengine')) {
      const volcengineHelper = new VolcenginePollingHelper();
      return await volcengineHelper.handleVolcenginePolling(initialResponse, {
        httpClient: this.httpClient,
        pollingConfig: this.pollingConfig!,
        credentials: request.credentials || {},
        params: (request.params as Record<string, unknown>) || {},
        headers: request.headers,
        timeout: request.timeout,
        toolName: getToolName() || undefined,
      });
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
   * Returns raw response data, binary processing is deferred to final response handling
   */
  private async executeHttpRequest(request: AdapterRequest): Promise<AdapterResponse> {
    try {
      // Extract file_name_title from params before sending request
      let params = request.params;
      if (params && typeof params === 'object' && 'file_name_title' in params) {
        const { file_name_title, ...restParams } = params as Record<string, unknown>;
        params = restParams;
      }

      // Prepare headers
      const headers = {
        ...this.httpClient.getHeaders(),
        ...request.headers,
      };

      // Prepare request data
      let requestData: unknown;
      const contentType = headers['Content-Type'] || headers['content-type'];

      if (request.useFormData) {
        // Use FormData for file uploads
        requestData = this.httpClient.createFormData(params);
        // Don't set Content-Type header for FormData, let axios set it with boundary
        headers['Content-Type'] = undefined;
        headers['content-type'] = undefined;
      } else {
        // Use request params directly
        requestData = params;
        const hasBodyData =
          requestData && typeof requestData === 'object' && Object.keys(requestData).length > 0;
        const method = request.method?.toUpperCase() || 'POST';
        if (!contentType && hasBodyData && method !== 'GET') {
          headers['Content-Type'] = 'application/json';
        }
      }

      // Add authentication headers from credentials
      // Skip addAuthHeaders for Volcengine auth since it has its own signing
      const skipAuth =
        getToolsetKey().startsWith('volcengine') ||
        (request.credentials && isVolcengineAuth(request.credentials as Record<string, unknown>));

      if (request.credentials && !skipAuth) {
        this.addAuthHeaders(headers, request.credentials);
      }

      // Apply Volcengine HMAC-SHA256 signing for initial request
      const method = request.method?.toUpperCase() || HttpMethod.POST;
      let finalEndpoint = request.endpoint;

      if (skipAuth && request.credentials) {
        const signResult = applyVolcengineSigning({
          credentials: request.credentials as Record<string, unknown>,
          params: (params as Record<string, unknown>) || {},
          endpoint: request.endpoint,
          method,
          requestData,
          headers,
        });

        if (signResult.signed) {
          // Apply signed headers
          for (const [key, value] of Object.entries(signResult.headers)) {
            if (value !== undefined) {
              headers[key] = value;
            }
          }
          // Use the signed URL (includes Action, Version, and proper query string)
          finalEndpoint = signResult.endpoint;
        }
      }
      const response = await this.sendHttpRequest(
        method,
        finalEndpoint,
        params,
        requestData,
        headers,
        request.timeout,
      );

      // Parse JSON response if needed, but don't process binary here
      const responseContentType = response.headers['content-type'] || '';
      const data = this.parseResponseData(response.data, responseContentType);

      // Return adapter response with raw data
      return {
        data,
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
   * Parse response data - only handles JSON parsing, binary processing is deferred
   */
  private parseResponseData(data: unknown, contentType: string): unknown {
    // If JSON content type, parse arraybuffer to JSON
    if (
      contentType.includes('application/json') ||
      contentType.includes('text/json') ||
      !contentType
    ) {
      if (data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
        try {
          const text = Buffer.from(data as ArrayBuffer).toString('utf-8');
          return JSON.parse(text);
        } catch {
          // Not valid JSON, return as-is
          return data;
        }
      }
    }
    return data;
  }

  /**
   * Send HTTP request based on method type
   * Extracted for better code organization
   */
  private async sendHttpRequest(
    method: string,
    endpoint: string,
    params: Record<string, unknown>,
    requestData: unknown,
    headers: Record<string, string | undefined>,
    timeout?: number,
  ): Promise<AxiosResponse> {
    switch (method) {
      case 'GET':
        return await this.httpClient.get(endpoint, {
          params,
          headers,
          timeout,
          responseType: 'arraybuffer',
        });

      case 'POST':
        return await this.httpClient.post(endpoint, requestData, {
          headers,
          timeout,
          responseType: 'arraybuffer',
        });

      case 'PUT':
        return await this.httpClient.put(endpoint, requestData, {
          headers,
          timeout,
          responseType: 'arraybuffer',
        });

      case 'DELETE':
        return await this.httpClient.delete(endpoint, {
          headers,
          timeout,
          data: requestData,
          responseType: 'arraybuffer',
        });

      case 'PATCH':
        return await this.httpClient.patch(endpoint, requestData, {
          headers,
          timeout,
          responseType: 'arraybuffer',
        });

      default:
        throw new AdapterError(`Unsupported HTTP method: ${method}`, 'UNSUPPORTED_METHOD');
    }
  }

  /**
   * Check if content type indicates binary response
   * Uses file-type's supportedMimeTypes for known binary types
   */
  private isBinaryResponse(contentType: string): boolean {
    if (!contentType) return false;
    const baseType = contentType.split(';')[0].trim().toLowerCase();
    // Check file-type's supported types, plus generic binary stream
    return supportedMimeTypes.has(baseType as any) || baseType === 'application/octet-stream';
  }

  /**
   * Add authentication headers based on credentials
   * Supports template variable ${apiKey} in Authorization header from adapter_config
   * Priority:
   * 1. Template variable ${apiKey} in existing Authorization header (e.g., "Key ${apiKey}")
   * 2. Custom apiKeyHeader (e.g., X-API-Key)
   * 3. Default: Bearer ${apiKey}
   */
  private addAuthHeaders(
    headers: Record<string, string>,
    credentials: Record<string, unknown>,
  ): void {
    const authHeader = headers.Authorization || headers.authorization;

    // 1. Check if Authorization header contains ${apiKey} template variable
    // e.g., "Key ${apiKey}" from adapter_config.headers
    if (authHeader?.includes('${apiKey}') && credentials.apiKey) {
      const resolvedAuth = authHeader.replace('${apiKey}', credentials.apiKey as string);
      if (headers.Authorization) {
        headers.Authorization = resolvedAuth;
      } else {
        headers.authorization = resolvedAuth;
      }
      return; // Template resolved, skip other auth methods
    }

    // 2. API Key with custom header name (e.g., X-API-Key)
    if (credentials.apiKeyHeader && credentials.apiKey) {
      headers[credentials.apiKeyHeader as string] = credentials.apiKey as string;
      return;
    }

    // 3. Default fallback: use Bearer format if only apiKey is provided
    if (credentials.apiKey && !authHeader) {
      headers.Authorization = `Bearer ${credentials.apiKey}`;
      return;
    }
    // Basic authentication
    if (credentials.username && credentials.password && !authHeader) {
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString(
        'base64',
      );
      headers.Authorization = `Basic ${auth}`;
    }

    // OAuth token
    if (credentials.accessToken && !authHeader) {
      headers.Authorization = `Bearer ${credentials.accessToken}`;
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
    this.logger.error('No task ID found in response for polling, data is', JSON.stringify(data));
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
        // Auto-extract result data (may fetch from response_url)
        const resultData = await this.autoExtractResult(data, request);
        return {
          data: resultData,
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
   * If response contains response_url, fetch data from that URL with original headers
   */
  private async autoExtractResult(data: any, request: AdapterRequest): Promise<any> {
    // Check for response_url field (e.g., fal.ai async responses)
    const responseUrl = this.getNestedValue(data, 'response_url');
    if (responseUrl && typeof responseUrl === 'string') {
      this.logger.log(`Fetching result from response_url: ${responseUrl}`);

      // Build headers (reuse default/request headers + auth)
      const headers = {
        ...this.httpClient.getHeaders(),
        ...request.headers,
      };
      if (request.credentials) {
        this.addAuthHeaders(headers, request.credentials);
      }

      const response = await this.httpClient.get(responseUrl, {
        headers,
        timeout: request.timeout,
      });

      return this.parseResponse(response);
    }

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
   * Check if URL points to downloadable binary content using HEAD request
   */
  private async isDownloadableUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, { timeout: 10000 });
      const contentType = response.headers['content-type'] || '';
      return this.isBinaryResponse(contentType);
    } catch {
      // If HEAD fails, try to infer from URL extension
      const binaryExtensions = [
        '.mp3',
        '.mp4',
        '.wav',
        '.ogg',
        '.webm',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.pdf',
      ];
      return binaryExtensions.some((ext) => url.toLowerCase().includes(ext));
    }
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
        timeout: 600000, // 10 minutes for  large files
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
      if (Buffer.isBuffer(response.data)) {
        return JSON.parse(response.data.toString('utf-8'));
      }
      if (response.data instanceof ArrayBuffer) {
        return JSON.parse(Buffer.from(new Uint8Array(response.data)).toString('utf-8'));
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
