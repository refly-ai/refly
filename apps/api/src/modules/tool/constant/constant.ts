/**
 * Toolset type constants
 */

import type { GenericToolsetType, ToolsetAuthType } from '@refly/openapi-schema';

/**
 * Toolset type enumeration (for GenericToolset.type)
 * - regular: Regular toolsets (includes both code-based and config-based)
 * - mcp: Model Context Protocol server toolsets
 * - external_oauth: OAuth-based external integrations
 *
 * Note: Backend uses AuthType to distinguish between regular/config_based/credentials,
 * but frontend only sees 'regular' for all non-OAuth, non-MCP tools
 */
export const ToolsetType: Record<string, GenericToolsetType> = {
  REGULAR: 'regular',
  MCP: 'mcp',
  EXTERNAL_OAUTH: 'external_oauth',
} as const;

/**
 * Toolset type values
 */
export type ToolsetTypeValue = GenericToolsetType;

/**
 * Toolset auth type constants
 * - credentials: API key or credentials-based authentication
 * - oauth: OAuth-based authentication (via Composio)
 * - config_based: Configuration-based (no auth required or config-driven)
 */
export const AuthType: Record<string, ToolsetAuthType> = {
  CREDENTIALS: 'credentials',
  OAUTH: 'oauth',
  CONFIG_BASED: 'config_based',
} as const;

/**
 * Auth type values
 */
export type AuthTypeValue = ToolsetAuthType;

/**
 * Adapter type constants
 */

/**
 * Adapter type enumeration
 */
export const AdapterType = {
  HTTP: 'http',
  SDK: 'sdk',
} as const;

/**
 * Adapter type values
 */
export type AdapterTypeValue = (typeof AdapterType)[keyof typeof AdapterType];

/**
 * HTTP methods
 */
export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

/**
 * HTTP method values
 */
export type HttpMethodValue = (typeof HttpMethod)[keyof typeof HttpMethod];

/**
 * Default retryable network error codes for adapters
 */
export const DEFAULT_RETRYABLE_ERROR_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'] as const;

export type RetryableErrorCode = (typeof DEFAULT_RETRYABLE_ERROR_CODES)[number];

/**
 * Resource type constants (for tool metadata)
 */
export const ResourceType = {
  AUDIO: 'audio',
  VIDEO: 'video',
  IMAGE: 'image',
  DOCUMENT: 'document',
  CODE: 'code',
} as const;

/**
 * Resource type values
 */
export type ResourceTypeValue = (typeof ResourceType)[keyof typeof ResourceType];

/**
 * All resource types as array
 */
export const RESOURCE_TYPES = Object.values(ResourceType);

/**
 * Common file extensions for each resource type
 */
export const RESOURCE_EXTENSIONS: Record<ResourceTypeValue, string[]> = {
  [ResourceType.AUDIO]: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'],
  [ResourceType.VIDEO]: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv'],
  [ResourceType.IMAGE]: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
  [ResourceType.DOCUMENT]: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf'],
  [ResourceType.CODE]: [
    'js',
    'ts',
    'jsx',
    'tsx',
    'py',
    'java',
    'cpp',
    'c',
    'go',
    'rs',
    'rb',
    'php',
    'swift',
    'kt',
    'cs',
    'html',
    'css',
    'json',
    'xml',
    'yaml',
    'yml',
    'sh',
    'sql',
  ],
};

/**
 * Media type constants for tool operations
 */

export const MEDIA_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  IMAGE: 'image',
  DOC: 'doc',
} as const;

export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES];

/**
 * MIME type mappings for media types
 */
export const MIME_TYPE_MAP: Record<string, MediaType> = {
  // Video
  'video/mp4': MEDIA_TYPES.VIDEO,
  'video/webm': MEDIA_TYPES.VIDEO,
  'video/ogg': MEDIA_TYPES.VIDEO,
  'video/quicktime': MEDIA_TYPES.VIDEO,
  'video/x-msvideo': MEDIA_TYPES.VIDEO,

  // Audio
  'audio/mpeg': MEDIA_TYPES.AUDIO,
  'audio/mp3': MEDIA_TYPES.AUDIO,
  'audio/wav': MEDIA_TYPES.AUDIO,
  'audio/ogg': MEDIA_TYPES.AUDIO,
  'audio/webm': MEDIA_TYPES.AUDIO,
  'audio/aac': MEDIA_TYPES.AUDIO,

  // Image
  'image/jpeg': MEDIA_TYPES.IMAGE,
  'image/jpg': MEDIA_TYPES.IMAGE,
  'image/png': MEDIA_TYPES.IMAGE,
  'image/gif': MEDIA_TYPES.IMAGE,
  'image/webp': MEDIA_TYPES.IMAGE,
  'image/svg+xml': MEDIA_TYPES.IMAGE,

  // Document
  'application/pdf': MEDIA_TYPES.DOC,
  'application/msword': MEDIA_TYPES.DOC,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': MEDIA_TYPES.DOC,
  'application/vnd.ms-excel': MEDIA_TYPES.DOC,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': MEDIA_TYPES.DOC,
  'application/vnd.ms-powerpoint': MEDIA_TYPES.DOC,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': MEDIA_TYPES.DOC,
  'text/plain': MEDIA_TYPES.DOC,
  'text/markdown': MEDIA_TYPES.DOC,
};

/**
 * File extension to media type mapping
 */
export const EXTENSION_MAP: Record<string, MediaType> = {
  // Video
  mp4: MEDIA_TYPES.VIDEO,
  webm: MEDIA_TYPES.VIDEO,
  ogg: MEDIA_TYPES.VIDEO,
  mov: MEDIA_TYPES.VIDEO,
  avi: MEDIA_TYPES.VIDEO,

  // Audio
  mp3: MEDIA_TYPES.AUDIO,
  wav: MEDIA_TYPES.AUDIO,
  oga: MEDIA_TYPES.AUDIO,
  m4a: MEDIA_TYPES.AUDIO,
  aac: MEDIA_TYPES.AUDIO,

  // Image
  jpg: MEDIA_TYPES.IMAGE,
  jpeg: MEDIA_TYPES.IMAGE,
  png: MEDIA_TYPES.IMAGE,
  gif: MEDIA_TYPES.IMAGE,
  webp: MEDIA_TYPES.IMAGE,
  svg: MEDIA_TYPES.IMAGE,

  // Document
  pdf: MEDIA_TYPES.DOC,
  doc: MEDIA_TYPES.DOC,
  docx: MEDIA_TYPES.DOC,
  xls: MEDIA_TYPES.DOC,
  xlsx: MEDIA_TYPES.DOC,
  ppt: MEDIA_TYPES.DOC,
  pptx: MEDIA_TYPES.DOC,
  txt: MEDIA_TYPES.DOC,
  md: MEDIA_TYPES.DOC,
};

/**
 * Get media type from MIME type
 */
export function getMediaTypeFromMime(mimeType: string): MediaType | undefined {
  return MIME_TYPE_MAP[mimeType.toLowerCase()];
}

/**
 * Get media type from file extension
 */
export function getMediaTypeFromExtension(extension: string): MediaType | undefined {
  return EXTENSION_MAP[extension.toLowerCase().replace('.', '')];
}

/**
 * Check if MIME type is valid for a given media type
 */
export function isValidMimeType(mimeType: string, mediaType: MediaType): boolean {
  return getMediaTypeFromMime(mimeType) === mediaType;
}

/**
 * Get resource type from file extension
 */
export function getResourceTypeFromExtension(extension: string): ResourceTypeValue | undefined {
  const ext = extension.toLowerCase().replace('.', '');

  for (const [type, extensions] of Object.entries(RESOURCE_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return type as ResourceTypeValue;
    }
  }

  return undefined;
}

/**
 * Check if extension is valid for a given resource type
 */
export function isValidExtension(extension: string, resourceType: ResourceTypeValue): boolean {
  const ext = extension.toLowerCase().replace('.', '');
  return RESOURCE_EXTENSIONS[resourceType]?.includes(ext) ?? false;
}

/**
 * Get all extensions for a resource type
 */
export function getExtensionsForResourceType(resourceType: ResourceTypeValue): string[] {
  return RESOURCE_EXTENSIONS[resourceType] ?? [];
}

/**
 * Billing type enumeration
 */
export enum BillingType {
  PER_CALL = 'per_call',
  PER_QUANTITY = 'per_quantity',
}

/**
 * Composio connection status constants
 */
export const COMPOSIO_CONNECTION_STATUS = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
} as const;
export type ComposioConnectionStatusValue =
  (typeof COMPOSIO_CONNECTION_STATUS)[keyof typeof COMPOSIO_CONNECTION_STATUS];

/**
 * Circuit breaker state enumeration
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Adapter error class
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

/**
 * Handler error class
 */
export class HandlerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HandlerError';
  }
}
