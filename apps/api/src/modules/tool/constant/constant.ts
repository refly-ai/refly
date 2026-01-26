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
 * Default retryable network error codes for adapters
 */
export const DEFAULT_RETRYABLE_ERROR_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'] as const;

/**
 * Resource type constants (for tool metadata)
 */
const _ResourceType = {
  AUDIO: 'audio',
  VIDEO: 'video',
  IMAGE: 'image',
  DOCUMENT: 'document',
  CODE: 'code',
} as const;

/**
 * Media type constants for tool operations
 */

const _MEDIA_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  IMAGE: 'image',
  DOC: 'doc',
} as const;

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
