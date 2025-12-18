/**
 * Volcengine API Signing and Polling Utility
 * Implements HMAC-SHA256 signing for Volcengine API authentication
 * and POST-based polling for async task status
 * Based on Volcengine's official signing algorithm
 */

import * as crypto from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { AxiosResponse } from 'axios';
import type { AdapterResponse, PollingConfig } from '@refly/openapi-schema';
import { AdapterError } from '../../constant/constant';
import { HttpClient } from './http-client';

/**
 * Configuration for Volcengine API signing
 */
export interface VolcengineAuthConfig {
  /** Access Key ID */
  accessKeyId: string;
  /** Secret Access Key */
  secretAccessKey: string;
  /** Service name (e.g., 'cv' for visual services) */
  service: string;
  /** Region (e.g., 'cn-north-1') */
  region: string;
  /** API Action name */
  action: string;
  /** API Version */
  version: string;
}

/**
 * Request parameters for signing
 */
export interface VolcengineSignRequest {
  /** HTTP method */
  method: string;
  /** Request host (e.g., 'visual.volcengineapi.com') */
  host: string;
  /** Request path (default: '/') */
  path?: string;
  /** Query parameters */
  query?: Record<string, string>;
  /** Request body */
  body?: string | Buffer;
  /** Content type */
  contentType?: string;
}

/**
 * Signed headers result
 */
export interface VolcengineSignedHeaders {
  /** All headers to include in the request */
  headers: Record<string, string>;
  /** Full URL with query parameters */
  url: string;
}

/**
 * Headers to ignore during signing process
 */
const HEADER_KEYS_TO_IGNORE = new Set([
  'authorization',
  'content-type',
  'content-length',
  'user-agent',
  'presigned-expires',
  'expect',
]);

/**
 * HMAC-SHA256 hash
 */
function hmac(secret: string | Buffer, s: string): Buffer {
  return crypto.createHmac('sha256', secret).update(s, 'utf8').digest();
}

/**
 * SHA256 hash
 */
function hash(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * URI escape following Volcengine's implementation
 */
function uriEscape(str: string): string {
  try {
    return encodeURIComponent(str)
      .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
      .replace(/[*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  } catch {
    return '';
  }
}

/**
 * Convert query params to sorted query string
 */
function queryParamsToString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const val = params[key];
      if (typeof val === 'undefined' || val === null) {
        return undefined;
      }
      const escapedKey = uriEscape(key);
      if (!escapedKey) {
        return undefined;
      }
      return `${escapedKey}=${uriEscape(val)}`;
    })
    .filter((v) => v)
    .join('&');
}

/**
 * Get signed headers and canonical headers
 */
function getSignHeaders(
  originHeaders: Record<string, string>,
  needSignHeaders?: string[],
): [string, string] {
  function trimHeaderValue(header: string): string {
    return header?.toString?.().trim().replace(/\s+/g, ' ') ?? '';
  }

  let h = Object.keys(originHeaders);

  // Filter by needSignHeaders if provided
  if (Array.isArray(needSignHeaders) && needSignHeaders.length > 0) {
    const needSignSet = new Set([...needSignHeaders, 'x-date', 'host'].map((k) => k.toLowerCase()));
    h = h.filter((k) => needSignSet.has(k.toLowerCase()));
  }

  // Filter out ignored headers
  h = h.filter((k) => !HEADER_KEYS_TO_IGNORE.has(k.toLowerCase()));

  const signedHeaderKeys = h
    .slice()
    .map((k) => k.toLowerCase())
    .sort()
    .join(';');

  const canonicalHeaders = h
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .map((k) => `${k.toLowerCase()}:${trimHeaderValue(originHeaders[k])}`)
    .join('\n');

  return [signedHeaderKeys, canonicalHeaders];
}

/**
 * Get current datetime in Volcengine format
 */
function getDateTimeNow(): string {
  const now = new Date();
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

/**
 * Get body SHA256 hash
 */
function getBodySha(body?: string | Buffer): string {
  const hashObj = crypto.createHash('sha256');
  if (typeof body === 'string') {
    hashObj.update(body);
  } else if (Buffer.isBuffer(body)) {
    hashObj.update(body);
  }
  return hashObj.digest('hex');
}

/**
 * Sign parameters interface
 */
interface SignParams {
  headers: Record<string, string>;
  query: Record<string, string>;
  region: string;
  serviceName: string;
  method: string;
  pathName: string;
  accessKeyId: string;
  secretAccessKey: string;
  needSignHeaderKeys?: string[];
  bodySha?: string;
}

/**
 * Generate authorization header
 */
function sign(params: SignParams): string {
  const {
    headers = {},
    query = {},
    region = '',
    serviceName = '',
    method = '',
    pathName = '/',
    accessKeyId = '',
    secretAccessKey = '',
    needSignHeaderKeys = [],
    bodySha,
  } = params;

  const datetime = headers['X-Date'];
  const date = datetime.substring(0, 8); // YYYYMMDD

  // Create canonical request
  const [signedHeaders, canonicalHeaders] = getSignHeaders(headers, needSignHeaderKeys);
  const canonicalRequest = [
    method.toUpperCase(),
    pathName,
    queryParamsToString(query) || '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    bodySha || hash(''),
  ].join('\n');

  const credentialScope = [date, region, serviceName, 'request'].join('/');

  // Create string to sign
  const stringToSign = ['HMAC-SHA256', datetime, credentialScope, hash(canonicalRequest)].join(
    '\n',
  );

  // Calculate signature
  const kDate = hmac(secretAccessKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, serviceName);
  const kSigning = hmac(kService, 'request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  return [
    'HMAC-SHA256',
    `Credential=${accessKeyId}/${credentialScope},`,
    `SignedHeaders=${signedHeaders},`,
    `Signature=${signature}`,
  ].join(' ');
}

/**
 * Sign a request for Volcengine API
 * Returns headers and URL to use for the request
 */
export function signVolcengineRequest(
  config: VolcengineAuthConfig,
  request: VolcengineSignRequest,
): VolcengineSignedHeaders {
  const { accessKeyId, secretAccessKey, service, region, action, version } = config;
  const { method, host, path = '/', query = {}, body, contentType } = request;

  // Build query params with Action and Version
  const queryParams: Record<string, string> = {
    ...query,
    Action: action,
    Version: version,
  };

  // Normalize query params - prevent undefined values
  for (const [key, val] of Object.entries(queryParams)) {
    if (val === undefined || val === null) {
      queryParams[key] = '';
    }
  }

  // Build request body string
  const bodyContent = body ? (typeof body === 'string' ? body : body.toString('utf-8')) : '';
  const bodySha = bodyContent ? getBodySha(bodyContent) : undefined;

  // Build headers for signing
  const headers: Record<string, string> = {
    'X-Date': getDateTimeNow(),
    Host: host,
  };

  // Sign the request
  const authorization = sign({
    headers,
    query: queryParams,
    region,
    serviceName: service,
    method: method.toUpperCase(),
    pathName: path,
    accessKeyId,
    secretAccessKey,
    bodySha,
  });

  // Build canonical query string for URL
  const canonicalQueryString = queryParamsToString(queryParams);

  // Build full URL
  const url = `https://${host}${path}?${canonicalQueryString}`;

  // Build response headers
  const responseHeaders: Record<string, string> = {
    ...headers,
    Authorization: authorization,
  };

  if (contentType) {
    responseHeaders['Content-Type'] = contentType;
  }

  return {
    headers: responseHeaders,
    url,
  };
}

/**
 * Auth config structure from adapter_config.auth
 */
interface AdapterAuthConfig {
  type?: string;
  region?: string;
  service?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Check if credentials contain Volcengine auth configuration
 * Supports two formats:
 * 1. Nested: { auth: { type: 'volcengine_signature', accessKeyId, secretAccessKey, service, region } }
 * 2. Flat: { accessKeyId, secretAccessKey, volcengineService, volcengineRegion }
 */
export function isVolcengineAuth(credentials: Record<string, unknown>): boolean {
  // Check nested auth format (from adapter_config)
  const auth = credentials.auth as AdapterAuthConfig | undefined;
  if (auth?.type === 'volcengine_signature') {
    return (
      typeof auth.accessKeyId === 'string' &&
      typeof auth.secretAccessKey === 'string' &&
      typeof auth.service === 'string' &&
      typeof auth.region === 'string'
    );
  }

  // Check flat format (legacy)
  return (
    typeof credentials.accessKeyId === 'string' &&
    typeof credentials.secretAccessKey === 'string' &&
    typeof credentials.volcengineService === 'string' &&
    typeof credentials.volcengineRegion === 'string'
  );
}

/**
 * Extract Volcengine auth config from credentials and request
 * Supports two formats:
 * 1. Nested: { auth: { type: 'volcengine_signature', accessKeyId, secretAccessKey, service, region } }
 * 2. Flat: { accessKeyId, secretAccessKey, volcengineService, volcengineRegion }
 *
 * Action and Version are extracted from the endpoint URL query params or from credentials
 */
export function extractVolcengineConfig(
  credentials: Record<string, unknown>,
  params: Record<string, unknown>,
  endpoint?: string,
): VolcengineAuthConfig | null {
  if (!isVolcengineAuth(credentials)) {
    return null;
  }

  // Extract auth details based on format
  const auth = credentials.auth as AdapterAuthConfig | undefined;
  let accessKeyId: string;
  let secretAccessKey: string;
  let service: string;
  let region: string;

  if (auth?.type === 'volcengine_signature') {
    // Nested format from adapter_config
    accessKeyId = auth.accessKeyId!;
    secretAccessKey = auth.secretAccessKey!;
    service = auth.service!;
    region = auth.region!;
  } else {
    // Flat format (legacy)
    accessKeyId = credentials.accessKeyId as string;
    secretAccessKey = credentials.secretAccessKey as string;
    service = credentials.volcengineService as string;
    region = credentials.volcengineRegion as string;
  }

  // Extract Action and Version from endpoint URL query params first
  let action: string | undefined;
  let version: string | undefined;

  if (endpoint) {
    try {
      const url = new URL(endpoint);
      action = url.searchParams.get('Action') || undefined;
      version = url.searchParams.get('Version') || undefined;
    } catch {
      // Invalid URL, ignore
    }
  }

  // Fallback to params or credentials
  action = action || (params.Action as string) || (credentials.volcengineAction as string);
  version = version || (params.Version as string) || (credentials.volcengineVersion as string);

  if (!action || !version) {
    return null;
  }

  return {
    accessKeyId,
    secretAccessKey,
    service,
    region,
    action,
    version,
  };
}

/**
 * Configuration for Volcengine polling helper
 */
export interface VolcenginePollingOptions {
  /** HTTP client instance */
  httpClient: HttpClient;
  /** Polling configuration */
  pollingConfig: PollingConfig;
  /** Request credentials */
  credentials: Record<string, unknown>;
  /** Request params */
  params: Record<string, unknown>;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request timeout */
  timeout?: number;
  /** Tool name for special handling (e.g., 'generate-avatar-video') */
  toolName?: string;
}

/**
 * Volcengine Polling Helper
 * Handles POST-based polling with HMAC-SHA256 signing for Volcengine APIs
 */
export class VolcenginePollingHelper {
  private readonly logger = new Logger(VolcenginePollingHelper.name);

  /**
   * Handle complete Volcengine async polling flow:
   * 1. Extract task_id from initial response
   * 2. Poll until complete
   * 3. Extract result using configured path
   *
   * @param initialResponse - The initial API response containing task_id
   * @param options - Polling options
   * @returns Final response with extracted result data
   */
  async handleVolcenginePolling(
    initialResponse: AdapterResponse,
    options: VolcenginePollingOptions,
  ): Promise<AdapterResponse> {
    // Extract task_id from initial response using Volcengine-specific extraction
    const taskId = extractVolcengineTaskId(initialResponse.data);
    if (!taskId) {
      // Check for Volcengine error
      const error = extractVolcengineError(initialResponse.data);
      if (error) {
        throw new AdapterError(error, 'VOLCENGINE_API_ERROR', initialResponse.status);
      }
      throw new AdapterError(
        'Volcengine polling configured but no task_id found in response (expected data.task_id)',
        'POLLING_TASK_ID_NOT_FOUND',
      );
    }

    this.logger.log(`Volcengine task_id: ${taskId}`);

    // Poll until complete
    const pollingResult = await this.pollUntilComplete(taskId, options);

    // Extract result using configured path
    const resultData = this.extractResultData(
      pollingResult.data,
      options.pollingConfig.resultPath,
      options.toolName,
    );

    return {
      ...pollingResult,
      data: resultData,
    };
  }

  /**
   * Extract result data from polling response using configured path
   * Auto-parses JSON strings
   * Special handling for generate-avatar-video: extracts video URL from multiple response formats
   */
  private extractResultData(data: unknown, resultPath?: string, toolName?: string): unknown {
    // Special handling for generate-avatar-video method (Volcengine):
    // Supports multiple response formats from different Volcengine video generation APIs
    if (toolName === 'generate-avatar-video') {
      const result = this.extractGenerateAvatarVideoResult(data);
      if (result) {
        return result;
      }
    }

    if (!resultPath) {
      return data;
    }

    const value = this.getNestedValue(data, resultPath);
    if (value === undefined) {
      return data;
    }

    // Auto-parse JSON string if the value is a string that looks like JSON
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  /**
   * Extract video result from generate-avatar-video response
   * Supports two Volcengine response formats:
   *
   * Format 1: data.resp_data contains preview_url array with URLs
   *   { code: 10000, data: { resp_data: "{\"preview_url\": [\"https://...\"], ...}", status: "done" } }
   *   → Extract preview_url[0] as video_url
   *
   * Format 2: data.video_url exists directly (preview_url in resp_data is empty)
   *   { code: 10000, data: { video_url: "https://...", resp_data: "{\"preview_url\": [], ...}", status: "done" } }
   *   → Use data.video_url directly
   */
  private extractGenerateAvatarVideoResult(data: unknown): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const resp = data as Record<string, unknown>;
    const dataObj = resp.data as Record<string, unknown> | undefined;

    if (!dataObj) {
      return null;
    }

    // Parse resp_data to get video metadata
    let parsedRespData: Record<string, unknown> | null = null;
    if (dataObj.resp_data && typeof dataObj.resp_data === 'string') {
      try {
        parsedRespData = JSON.parse(dataObj.resp_data) as Record<string, unknown>;
      } catch {
        // JSON parse failed, continue without metadata
      }
    }

    // Format 1: Check if resp_data.preview_url has valid URLs
    if (parsedRespData) {
      const previewUrl = parsedRespData.preview_url as string[] | undefined;
      if (Array.isArray(previewUrl) && previewUrl.length > 0 && typeof previewUrl[0] === 'string') {
        const videoMeta = this.getNestedValue(parsedRespData, 'video.VideoMeta') as
          | Record<string, unknown>
          | undefined;
        return {
          video_url: previewUrl[0],
          video_meta: videoMeta || null,
          vid: this.getNestedValue(parsedRespData, 'video.Vid') || null,
        };
      }
    }

    // Format 2: Use data.video_url directly (preview_url is empty or not available)
    if (dataObj.video_url && typeof dataObj.video_url === 'string') {
      const videoMeta = parsedRespData
        ? (this.getNestedValue(parsedRespData, 'video.VideoMeta') as
            | Record<string, unknown>
            | undefined)
        : null;
      return {
        video_url: dataObj.video_url,
        video_meta: videoMeta || null,
        vid: parsedRespData ? this.getNestedValue(parsedRespData, 'video.Vid') || null : null,
      };
    }

    // No recognized format, return null to fall back to default extraction
    return null;
  }

  /**
   * Poll task status for Volcengine APIs using POST with HMAC-SHA256 signing
   */
  async pollUntilComplete(
    taskId: string,
    options: VolcenginePollingOptions,
  ): Promise<AdapterResponse> {
    const { httpClient, pollingConfig, credentials, params, headers = {}, timeout } = options;
    const maxWaitSeconds = pollingConfig.maxWaitSeconds || 300;
    const intervalSeconds = pollingConfig.intervalSeconds || 5;

    const maxAttempts = Math.ceil(maxWaitSeconds / intervalSeconds);
    const pollInterval = intervalSeconds * 1000;

    const statusUrlTemplate = pollingConfig.statusUrl;
    const isAbsolute = /^https?:\/\//i.test(statusUrlTemplate);
    if (!isAbsolute) {
      throw new AdapterError(
        `Polling statusUrl must be absolute: ${statusUrlTemplate}`,
        'INVALID_POLLING_URL',
      );
    }

    // Get configured statuses or use defaults
    const completedStatuses = pollingConfig.completedStatuses || [
      'completed',
      'success',
      'succeeded',
      'done',
    ];
    const failedStatuses = pollingConfig.failedStatuses || [
      'failed',
      'error',
      'cancelled',
      'canceled',
      'not_found',
      'expired',
    ];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Build status URL by replacing {id} and {task_id} placeholders
      const statusUrl = statusUrlTemplate.replace('{id}', taskId).replace('{task_id}', taskId);

      // Build request body from template
      const bodyTemplate = pollingConfig.statusBody || {};
      const requestBody = this.buildPollingRequestBody(bodyTemplate, taskId, params);

      // Build headers for polling
      const pollHeaders: Record<string, string> = {
        ...httpClient.getHeaders(),
        ...headers,
        'Content-Type': 'application/json',
      };

      // Apply Volcengine signing
      this.applyVolcengineAuth(credentials, params, pollHeaders, 'POST', statusUrl, requestBody);

      const response = await httpClient.post(statusUrl, requestBody, {
        headers: pollHeaders,
        timeout,
      });

      const data = this.parseResponse(response);

      // Check for Volcengine error codes that should terminate polling immediately
      const volcengineError = this.checkVolcengineErrorCode(data);
      if (volcengineError) {
        throw new AdapterError(volcengineError.message, volcengineError.code, response.status, {
          responseData: data,
        });
      }

      // Extract status using configured path or auto-detect
      const status = this.extractStatus(data, pollingConfig.statusPath);
      if (!status) {
        this.logger.warn('Cannot detect status field, assuming not ready');
        if (attempt < maxAttempts) {
          await this.sleep(pollInterval);
        }
        continue;
      }

      // Check if completed (case-insensitive)
      if (completedStatuses.some((s) => s.toLowerCase() === status.toLowerCase())) {
        return {
          data,
          status: response.status,
          headers: response.headers as Record<string, string>,
          raw: response,
        };
      }

      // Check if failed (case-insensitive)
      if (failedStatuses.some((s) => s.toLowerCase() === status.toLowerCase())) {
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
   * Apply Volcengine HMAC-SHA256 signing to headers
   */
  private applyVolcengineAuth(
    credentials: Record<string, unknown>,
    params: Record<string, unknown>,
    headers: Record<string, string>,
    method: string,
    endpoint: string,
    body: unknown,
  ): void {
    const volcengineConfig = extractVolcengineConfig(credentials, params, endpoint);
    if (!volcengineConfig) {
      this.logger.warn('Cannot extract Volcengine config for signing');
      return;
    }

    // Parse endpoint to extract host, path, and existing query params
    const url = new URL(endpoint);
    const host = url.host;
    const path = url.pathname || '/';

    // Extract existing query parameters from URL
    const existingQuery: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key !== 'Action' && key !== 'Version') {
        existingQuery[key] = value;
      }
    });

    // Prepare body string for POST requests
    let bodyStr = '';
    if (method.toUpperCase() !== 'GET' && body && typeof body === 'object') {
      bodyStr = JSON.stringify(body);
    } else if (method.toUpperCase() !== 'GET' && typeof body === 'string') {
      bodyStr = body;
    }

    // Sign the request
    const signResult = signVolcengineRequest(volcengineConfig, {
      method,
      host,
      path,
      query: existingQuery,
      body: bodyStr,
      contentType: method.toUpperCase() === 'GET' ? undefined : 'application/json',
    });

    // Apply signed headers
    for (const [key, value] of Object.entries(signResult.headers)) {
      headers[key] = value;
    }
  }

  /**
   * Build polling request body from template
   * Replaces placeholders like {task_id}, {req_key} with actual values
   */
  private buildPollingRequestBody(
    template: Record<string, unknown>,
    taskId: string,
    originalParams?: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string') {
        // Replace placeholders
        let resolved = value.replace('{task_id}', taskId).replace('{id}', taskId);

        // Replace other placeholders from original params
        if (originalParams) {
          for (const [paramKey, paramValue] of Object.entries(originalParams)) {
            if (typeof paramValue === 'string') {
              resolved = resolved.replace(`{${paramKey}}`, paramValue);
            }
          }
        }
        result[key] = resolved;
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.buildPollingRequestBody(
          value as Record<string, unknown>,
          taskId,
          originalParams,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Extract status from response using configured path or auto-detect
   */
  private extractStatus(data: unknown, statusPath?: string): string | null {
    // If statusPath is configured, use it
    if (statusPath) {
      const value = this.getNestedValue(data, statusPath);
      if (value && typeof value === 'string') {
        return value;
      }
    }

    // Fall back to auto-detection
    return this.autoDetectStatus(data);
  }

  /**
   * Auto-detect status field from response
   */
  private autoDetectStatus(data: unknown): string | null {
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
   * Auto-detect error message from response
   */
  private autoDetectError(data: unknown): string | null {
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
   * Check for Volcengine-specific error codes that should terminate polling
   * Returns error info if a terminal error is detected, null otherwise
   *
   * Known error codes:
   * - 50501: Invalid input image, user should try a different picture
   */
  private checkVolcengineErrorCode(data: unknown): { message: string; code: string } | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const resp = data as Record<string, unknown>;

    // Check top-level code first (non-10000 means error)
    const topCode = resp.code as number | undefined;
    if (topCode !== undefined && topCode !== 10000) {
      const message = (resp.message as string) || 'Volcengine API error';
      return this.mapVolcengineErrorCode(topCode, message);
    }

    // Check code inside data.resp_data (parsed JSON string)
    const dataObj = resp.data as Record<string, unknown> | undefined;
    if (dataObj?.resp_data && typeof dataObj.resp_data === 'string') {
      try {
        const parsedRespData = JSON.parse(dataObj.resp_data) as Record<string, unknown>;
        const innerCode = parsedRespData.code as number | undefined;
        if (innerCode !== undefined && innerCode !== 0) {
          const message = (parsedRespData.msg as string) || 'Volcengine task error';
          return this.mapVolcengineErrorCode(innerCode, message);
        }
      } catch {
        // JSON parse failed, ignore
      }
    }

    return null;
  }

  /**
   * Map Volcengine error codes to user-friendly messages
   */
  private mapVolcengineErrorCode(
    code: number,
    defaultMessage: string,
  ): { message: string; code: string } | null {
    // Error code 50501: Invalid input image
    if (code === 50501) {
      return {
        message:
          'The input image is not suitable for processing. Please try a different picture with clearer facial features.',
        code: 'VOLCENGINE_INVALID_INPUT_IMAGE',
      };
    }

    // Other known error codes can be added here
    // For now, only return error for specific codes we want to handle specially
    // Return null for unknown codes to let the normal flow continue
    if (code !== 0 && code !== 10000) {
      return {
        message: `${defaultMessage} (code: ${code})`,
        code: 'VOLCENGINE_API_ERROR',
      };
    }

    return null;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    if (!path || !obj) return undefined;

    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * Parse response data (handle arraybuffer for JSON)
   */
  private parseResponse(response: AxiosResponse): unknown {
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
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Extract task_id from Volcengine API response
 * Volcengine responses typically have the structure:
 * {
 *   "code": 10000,
 *   "data": { "task_id": "xxx" },
 *   "message": "Success",
 *   "request_id": "xxx"
 * }
 *
 * This function extracts the task_id from data.task_id, NOT request_id
 */
export function extractVolcengineTaskId(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const resp = response as Record<string, unknown>;

  // Check if response indicates success (code === 10000)
  if (resp.code !== undefined && resp.code !== 10000) {
    return null;
  }

  // Extract task_id from data.task_id (primary location)
  const data = resp.data as Record<string, unknown> | undefined;
  if (data?.task_id && typeof data.task_id === 'string') {
    return data.task_id;
  }

  // Fallback: check for task_id at root level
  if (resp.task_id && typeof resp.task_id === 'string') {
    return resp.task_id;
  }

  // Fallback: check common alternative field names in data
  if (data) {
    const alternativeFields = ['taskId', 'TaskId', 'id', 'Id', 'job_id', 'jobId'];
    for (const field of alternativeFields) {
      if (data[field] && typeof data[field] === 'string') {
        return data[field] as string;
      }
    }
  }

  return null;
}

/**
 * Check if a Volcengine API response indicates success
 * Success is indicated by code === 10000
 */
export function isVolcengineSuccess(response: unknown): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const resp = response as Record<string, unknown>;
  return resp.code === 10000;
}

/**
 * Extract error message from Volcengine API response
 * Returns the message field if code !== 10000
 */
export function extractVolcengineError(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const resp = response as Record<string, unknown>;

  // If success, no error
  if (resp.code === 10000) {
    return null;
  }

  // Extract error message
  if (resp.message && typeof resp.message === 'string') {
    return `Volcengine error (code: ${resp.code}): ${resp.message}`;
  }

  return `Volcengine error (code: ${resp.code})`;
}
