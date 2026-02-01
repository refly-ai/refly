/**
 * API client for Refly backend communication.
 * Handles authentication, retries, and error mapping.
 * Supports both OAuth tokens and API Keys for authentication.
 */

import * as fs from 'node:fs';
import { statSync } from 'node:fs';
import * as path from 'node:path';
import mime from 'mime';
import {
  getApiEndpoint,
  getAccessToken,
  getRefreshToken,
  getTokenExpiresAt,
  setOAuthTokens,
  getOAuthProvider,
  getAuthUser,
  getAuthMethod,
  getApiKey,
} from '../config/config.js';
import { ErrorCodes, type ErrorCode } from '../utils/output.js';
import { CLIError, AuthError, NetworkError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  errCode?: string;
  errMsg?: string;
  // Alternative error format used by some API responses
  error?: string;
  message?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  query?: Record<string, string>;
  timeout?: number;
  requireAuth?: boolean;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Make an authenticated API request with automatic token refresh (for OAuth)
 * or API Key authentication
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, timeout = DEFAULT_TIMEOUT, requireAuth = true } = options;

  const endpoint = getApiEndpoint();
  let url = `${endpoint}${path}`;

  // Add query parameters
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(query);
    url = `${url}?${params.toString()}`;
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'refly-cli/0.1.0',
  };

  // Handle authentication based on method
  if (requireAuth) {
    const authMethod = getAuthMethod();

    if (authMethod === 'apikey') {
      // Use API Key authentication
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new AuthError('Not authenticated');
      }
      headers['X-API-Key'] = apiKey;
    } else {
      // Use OAuth authentication (default)
      let accessToken = getAccessToken();

      if (!accessToken) {
        throw new AuthError('Not authenticated');
      }

      // Check if OAuth token is expired and refresh if needed
      const expiresAt = getTokenExpiresAt();
      if (expiresAt && new Date(expiresAt) < new Date()) {
        logger.debug('Access token expired, refreshing...');
        try {
          accessToken = await refreshAccessToken();
        } catch (error) {
          logger.error('Failed to refresh token:', error);
          throw new AuthError('Session expired, please login again');
        }
      }

      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    logger.debug(`API Request: ${method} ${path}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle empty responses (e.g., 204 No Content for DELETE)
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    if (
      response.status === 204 ||
      contentLength === '0' ||
      (!contentType?.includes('application/json') &&
        response.status >= 200 &&
        response.status < 300)
    ) {
      if (!response.ok) {
        throw new CLIError(ErrorCodes.API_ERROR, `HTTP ${response.status}: ${response.statusText}`);
      }
      return undefined as T;
    }

    // Parse response
    const data = (await response.json()) as APIResponse<T>;
    const hasSuccessFlag = typeof data === 'object' && data !== null && 'success' in data;

    // Handle API-level errors
    if (!response.ok) {
      throw mapAPIError(response.status, data);
    }

    if (hasSuccessFlag) {
      if (data.success) {
        return data.data as T;
      }
      throw mapAPIError(response.status, data);
    }

    // Non-wrapped responses (raw DTOs)
    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof CLIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new CLIError(ErrorCodes.TIMEOUT, 'Request timed out', undefined, 'Try again later');
      }

      if (error.message.includes('fetch')) {
        throw new NetworkError('Cannot connect to API');
      }
    }

    throw new CLIError(
      ErrorCodes.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

/**
 * Refresh access token using refresh token (OAuth only)
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new AuthError('No refresh token available');
  }

  const provider = getOAuthProvider();
  const user = getAuthUser();

  if (!provider || !user) {
    throw new AuthError('Invalid OAuth state');
  }

  const endpoint = getApiEndpoint();
  const url = `${endpoint}/v1/auth/cli/oauth/refresh`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'refly-cli/0.1.0',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new AuthError('Failed to refresh token');
  }

  const data = (await response.json()) as APIResponse<{
    accessToken: string;
    refreshToken: string;
  }>;

  if (!data.success || !data.data) {
    throw new AuthError('Failed to refresh token');
  }

  // Update stored tokens
  setOAuthTokens({
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    provider,
    user,
  });

  logger.debug('Access token refreshed successfully');
  return data.data.accessToken;
}

/**
 * Map API error response to CLIError
 */
function mapAPIError(status: number, response: APIResponse): CLIError {
  // Handle CLI error format: { ok: false, type: 'error', error: { code, message, hint } }
  if (response.error && typeof response.error === 'object') {
    const cliError = response.error as {
      code?: string;
      message?: string;
      hint?: string;
      suggestedFix?: { field?: string; format?: string; example?: string };
    };
    return new CLIError(
      (cliError.code || 'UNKNOWN') as ErrorCode,
      cliError.message || 'Unknown error',
      undefined,
      cliError.hint,
      cliError.suggestedFix,
    );
  }

  // Handle legacy format
  const errCode = response.errCode ?? response.error ?? 'UNKNOWN';
  const errMsg = response.errMsg ?? response.message ?? 'Unknown error';

  // Map HTTP status codes
  if (status === 401 || status === 403) {
    return new AuthError(errMsg);
  }

  if (status === 404) {
    return new CLIError(ErrorCodes.NOT_FOUND, errMsg, undefined, 'Check the resource ID');
  }

  if (status === 409) {
    return new CLIError(ErrorCodes.CONFLICT, errMsg, undefined, 'Refresh and try again');
  }

  if (status === 422) {
    return new CLIError(ErrorCodes.INVALID_INPUT, errMsg, undefined, 'Check input format');
  }

  if (status >= 500) {
    return new CLIError(ErrorCodes.API_ERROR, errMsg, undefined, 'Try again later');
  }

  // Map API error codes to ErrorCode type
  return new CLIError(errCode as ErrorCode, errMsg);
}

/**
 * Stream response interface for file downloads
 */
export interface StreamResponse {
  data: Buffer;
  filename: string;
  contentType: string;
  size: number;
}

/**
 * Make an authenticated streaming API request for file downloads.
 * Reuses the same auth logic as apiRequest() for OAuth/API Key support.
 */
export async function apiRequestStream(
  path: string,
  options: { timeout?: number } = {},
): Promise<StreamResponse> {
  const { timeout = 300000 } = options; // 5 min default for downloads

  const endpoint = getApiEndpoint();
  const url = `${endpoint}${path}`;

  // Build headers with authentication (same logic as apiRequest)
  const headers: Record<string, string> = {
    'User-Agent': 'refly-cli/0.1.0',
  };

  const authMethod = getAuthMethod();

  if (authMethod === 'apikey') {
    // Use API Key authentication
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new AuthError('Not authenticated');
    }
    headers['X-API-Key'] = apiKey;
  } else {
    // Use OAuth authentication (default)
    let accessToken = getAccessToken();

    if (!accessToken) {
      throw new AuthError('Not authenticated');
    }

    // Check if OAuth token is expired and refresh if needed
    const expiresAt = getTokenExpiresAt();
    if (expiresAt && new Date(expiresAt) < new Date()) {
      logger.debug('Access token expired, refreshing...');
      try {
        accessToken = await refreshAccessToken();
      } catch (error) {
        logger.error('Failed to refresh token:', error);
        throw new AuthError('Session expired, please login again');
      }
    }

    headers.Authorization = `Bearer ${accessToken}`;
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    logger.debug(`API Stream Request: GET ${path}`);

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try to parse error response
      try {
        const errorData = (await response.json()) as APIResponse;
        throw mapAPIError(response.status, errorData);
      } catch (e) {
        if (e instanceof CLIError) throw e;
        throw new CLIError(ErrorCodes.API_ERROR, `HTTP ${response.status}: ${response.statusText}`);
      }
    }

    // Parse filename from Content-Disposition header
    const contentDisposition = response.headers.get('content-disposition');
    let filename = 'download';
    if (contentDisposition) {
      // Handle both: filename="name.ext" and filename*=UTF-8''name.ext
      const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
      if (match) {
        filename = decodeURIComponent(match[1]);
      }
    }

    // Get the response as ArrayBuffer and convert to Buffer
    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    return {
      data,
      filename,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      size: data.length,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof CLIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new CLIError(ErrorCodes.TIMEOUT, 'Download timed out', undefined, 'Try again later');
      }

      if (error.message.includes('fetch')) {
        throw new NetworkError('Cannot connect to API');
      }
    }

    throw new CLIError(
      ErrorCodes.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

/**
 * Verify API connection and authentication
 */
export async function verifyConnection(): Promise<{
  connected: boolean;
  authenticated: boolean;
  authMethod?: 'oauth' | 'apikey';
  user?: { uid: string; name?: string; email?: string };
}> {
  try {
    const authMethod = getAuthMethod();

    // Check if we have any credentials
    if (authMethod === 'apikey') {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { connected: true, authenticated: false };
      }
    } else {
      const accessToken = getAccessToken();
      if (!accessToken) {
        return { connected: true, authenticated: false };
      }
    }

    const user = await apiRequest<{ uid: string; name?: string; email?: string }>('/v1/user/me', {
      requireAuth: true,
    });

    return { connected: true, authenticated: true, authMethod, user };
  } catch (error) {
    if (error instanceof AuthError) {
      return { connected: true, authenticated: false };
    }
    if (error instanceof NetworkError) {
      return { connected: false, authenticated: false };
    }
    // For other errors, assume connection works but auth failed
    return { connected: true, authenticated: false };
  }
}

/**
 * Result of a drive file upload
 */
export interface DriveFileUploadResult {
  fileId: string;
  name: string;
  type: string;
  size: number;
  storageKey: string;
  url?: string;
}

/**
 * Presigned upload URL response
 */
interface PresignedUploadResponse {
  uploadId: string;
  presignedUrl: string;
  expiresIn: number;
}

/**
 * Get MIME type for a file path
 */
function getMimeType(filePath: string): string {
  return mime.getType(filePath) || 'application/octet-stream';
}

/**
 * Step 1: Get a presigned URL for file upload
 */
async function getPresignedUploadUrl(
  canvasId: string,
  filename: string,
  size: number,
  contentType: string,
): Promise<PresignedUploadResponse> {
  return apiRequest<PresignedUploadResponse>('/v1/cli/drive/file/upload/presign', {
    method: 'POST',
    body: { canvasId, filename, size, contentType },
  });
}

/**
 * Step 2: Upload file to presigned URL with retry
 */
async function uploadToPresignedUrl(
  presignedUrl: string,
  filePath: string,
  contentType: string,
  retryCount = 1,
): Promise<void> {
  const fileStats = statSync(filePath);
  const timeout = 300000; // 5 min timeout for upload

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Read file as buffer for presigned PUT
      const fileBuffer = await fs.promises.readFile(filePath);

      const response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileStats.size.toString(),
        },
        body: fileBuffer,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new CLIError(
          ErrorCodes.API_ERROR,
          `Upload to storage failed: HTTP ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
        );
      }

      return; // Success
    } catch (error) {
      clearTimeout(timeoutId);

      // Don't retry on auth or validation errors
      if (error instanceof CLIError) {
        throw error;
      }

      // Retry on network errors
      if (attempt < retryCount) {
        logger.debug(`Upload attempt ${attempt + 1} failed, retrying...`);
        continue;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new CLIError(
            ErrorCodes.TIMEOUT,
            'Upload timed out',
            undefined,
            'Try a smaller file or check network',
          );
        }

        if (error.message.includes('fetch')) {
          throw new NetworkError('Cannot connect to storage');
        }
      }

      throw new CLIError(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Unknown upload error',
      );
    }
  }
}

/**
 * Step 3: Confirm upload completion
 */
async function confirmUpload(uploadId: string): Promise<DriveFileUploadResult> {
  return apiRequest<DriveFileUploadResult>('/v1/cli/drive/file/upload/confirm', {
    method: 'POST',
    body: { uploadId },
  });
}

/**
 * Upload a file to a canvas using presigned URL flow.
 * 3-step process: presign -> PUT to OSS -> confirm
 * @param filePath - Absolute path to the file to upload
 * @param canvasId - Canvas ID to associate the file with
 * @param options - Optional configuration including progress callback
 * @returns Upload result with file metadata
 */
/**
 * Workflow variable definition
 */
export interface WorkflowVariable {
  variableId?: string;
  name: string;
  variableType?: string;
  value?: unknown[];
  required?: boolean;
  isSingle?: boolean;
  resourceTypes?: string[];
  default?: unknown;
  description?: string;
}

/**
 * Workflow info returned from GET /v1/cli/workflow/:id
 */
export interface WorkflowInfo {
  workflowId: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  variables: WorkflowVariable[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch workflow details by ID
 * @param workflowId - The workflow ID to fetch
 * @returns Workflow details including variables
 */
export async function apiGetWorkflow(workflowId: string): Promise<WorkflowInfo> {
  return apiRequest<WorkflowInfo>(`/v1/cli/workflow/${workflowId}`);
}

export async function apiUploadDriveFile(
  filePath: string,
  canvasId: string,
  options?: {
    timeout?: number;
    onProgress?: (stage: 'presign' | 'upload' | 'confirm') => void;
  },
): Promise<DriveFileUploadResult> {
  const filename = path.basename(filePath);
  const mimeType = getMimeType(filePath);
  const fileStats = statSync(filePath);

  logger.debug(`Starting presigned upload: ${filename} (${fileStats.size} bytes)`);

  // Step 1: Get presigned URL
  options?.onProgress?.('presign');
  let presignResponse: PresignedUploadResponse;
  try {
    presignResponse = await getPresignedUploadUrl(canvasId, filename, fileStats.size, mimeType);
    logger.debug(`Got presigned URL, uploadId: ${presignResponse.uploadId}`);
  } catch (error) {
    logger.error('Failed to get presigned URL:', error);
    throw error;
  }

  // Step 2: Upload to presigned URL
  options?.onProgress?.('upload');
  try {
    await uploadToPresignedUrl(presignResponse.presignedUrl, filePath, mimeType);
    logger.debug('File uploaded to presigned URL');
  } catch (error) {
    logger.error('Failed to upload to presigned URL:', error);
    throw error;
  }

  // Step 3: Confirm upload
  options?.onProgress?.('confirm');
  try {
    const result = await confirmUpload(presignResponse.uploadId);
    logger.debug(`Upload confirmed, fileId: ${result.fileId}`);
    return result;
  } catch (error) {
    logger.error('Failed to confirm upload:', error);
    throw error;
  }
}

/**
 * Get workflow variables with current values
 * @param canvasId - The canvas/workflow ID
 * @returns Array of workflow variables with values
 */
export async function apiGetWorkflowVariables(canvasId: string): Promise<WorkflowVariable[]> {
  return apiRequest<WorkflowVariable[]>('/v1/canvas/workflow/variables', {
    query: { canvasId },
  });
}

/**
 * Update workflow variables (set values)
 * @param canvasId - The canvas/workflow ID
 * @param variables - Variables with values to set
 * @returns Updated variables
 */
export async function apiUpdateWorkflowVariables(
  canvasId: string,
  variables: WorkflowVariable[],
): Promise<WorkflowVariable[]> {
  return apiRequest<WorkflowVariable[]>('/v1/canvas/workflow/variables', {
    method: 'POST',
    body: { canvasId, variables },
  });
}

/**
 * Action result response from the API
 */
export interface ActionResultResponse {
  resultId: string;
  version?: number;
  title?: string;
  type?: string;
  status?: string;
  targetId?: string;
  targetType?: string;
  workflowExecutionId?: string;
  workflowNodeExecutionId?: string;
  input?: Record<string, unknown>;
  actionMeta?: Record<string, unknown>;
  context?: Record<string, unknown>;
  errors?: Array<{ type: string; message: string }>;
  errorType?: string;
  outputUrl?: string;
  storageKey?: string;
  createdAt?: string;
  updatedAt?: string;
  steps?: Array<{
    name?: string;
    content?: string;
    reasoningContent?: string;
    logs?: unknown[];
    artifacts?: unknown[];
    structuredData?: Record<string, unknown>;
    tokenUsage?: unknown[];
    toolCalls?: Array<{
      callId: string;
      toolsetId: string;
      toolName: string;
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      error?: string;
      status: 'executing' | 'completed' | 'failed';
      createdAt?: number;
      updatedAt?: number;
    }>;
  }>;
  messages?: Array<{
    messageId: string;
    type: string;
    content?: string;
    reasoningContent?: string;
    toolCallId?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  files?: Array<{
    fileId: string;
    name: string;
    type: string;
    size: number;
  }>;
  modelInfo?: {
    provider?: string;
    modelId?: string;
  };
}

/**
 * Get action result by resultId
 * @param resultId - The action result ID (ar-xxx)
 * @returns Action result details
 */
export async function apiGetActionResult(resultId: string): Promise<ActionResultResponse> {
  return apiRequest<ActionResultResponse>('/v1/cli/action/result', {
    query: { resultId },
  });
}
