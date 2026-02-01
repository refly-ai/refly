/**
 * Data redaction utilities for sensitive information in API call records
 *
 * SECURITY: This module provides functions to redact or encrypt sensitive data
 * before persisting to the database. Sensitive fields include:
 * - Authorization headers (Bearer tokens, API keys)
 * - Authentication credentials
 * - PII (Personally Identifiable Information)
 * - Secret keys and tokens
 */

/**
 * Sensitive header names that should be redacted
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'x-refly-api-key',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'x-access-token',
  'x-refresh-token',
];

/**
 * Sensitive body field names that should be redacted
 */
const SENSITIVE_BODY_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
];

/**
 * Redact sensitive headers from request/response headers
 * @param headers - Headers object (can be Record<string, string> or Headers)
 * @returns Redacted headers object
 */
function redactHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const result: Record<string, string> = {};

  // Check if it's a Fetch API Headers object
  const isHeadersObject =
    (typeof Headers !== 'undefined' && headers instanceof Headers) ||
    typeof (headers as any).entries === 'function';

  let entries: Iterable<[string, string]>;

  if (isHeadersObject) {
    // Handle Fetch API Headers
    entries = (headers as any).entries();
  } else {
    // Handle plain object
    entries = Object.entries(headers as Record<string, unknown>).map(([key, value]) => [
      key,
      String(value ?? ''),
    ]);
  }

  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      // Redact sensitive headers but keep a hint of the value type
      if (typeof value === 'string') {
        if (value.startsWith('Bearer ')) {
          result[key] = 'Bearer [REDACTED]';
        } else if (value.length > 0) {
          // Show first 4 chars for debugging, rest redacted
          const prefix = value.substring(0, Math.min(4, value.length));
          result[key] = `${prefix}...[REDACTED]`;
        } else {
          result[key] = '[REDACTED]';
        }
      } else {
        result[key] = '[REDACTED]';
      }
    } else {
      result[key] = String(value ?? '');
    }
  }

  return result;
}

/**
 * Recursively redact sensitive fields from request/response body
 * @param body - Body object (can be any JSON-serializable value)
 * @returns Redacted body object
 */
function redactBody(body: unknown): unknown {
  if (body === null || body === undefined) {
    return body;
  }

  if (typeof body !== 'object') {
    return body;
  }

  if (Array.isArray(body)) {
    return body.map((item) => redactBody(item));
  }

  const result: Record<string, unknown> = {};
  const bodyObj = body as Record<string, unknown>;

  for (const [key, value] of Object.entries(bodyObj)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_BODY_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
      // Redact sensitive fields
      if (typeof value === 'string' && value.length > 0) {
        const prefix = value.substring(0, Math.min(4, value.length));
        result[key] = `${prefix}...[REDACTED]`;
      } else {
        result[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively redact nested objects
      result[key] = redactBody(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Redact sensitive data from API call record before persisting
 * @param data - API call record data
 * @returns Redacted data safe for persistence
 */
export function redactApiCallRecord(data: {
  requestHeaders?: string | null;
  requestBody?: string | null;
  responseBody?: string | null;
}): {
  requestHeaders?: string | null;
  requestBody?: string | null;
  responseBody?: string | null;
} {
  const result: {
    requestHeaders?: string | null;
    requestBody?: string | null;
    responseBody?: string | null;
  } = {};

  // Redact request headers
  if (data.requestHeaders) {
    try {
      const headers = JSON.parse(data.requestHeaders);
      const redacted = redactHeaders(headers);
      result.requestHeaders = JSON.stringify(redacted);
    } catch {
      // If parsing fails, redact the entire string
      result.requestHeaders = '[REDACTED - INVALID JSON]';
    }
  } else {
    result.requestHeaders = data.requestHeaders;
  }

  // Redact request body
  if (data.requestBody) {
    try {
      const body = JSON.parse(data.requestBody);
      const redacted = redactBody(body);
      result.requestBody = JSON.stringify(redacted);
    } catch {
      // If parsing fails, redact the entire string
      result.requestBody = '[REDACTED - INVALID JSON]';
    }
  } else {
    result.requestBody = data.requestBody;
  }

  // Redact response body
  if (data.responseBody) {
    try {
      const body = JSON.parse(data.responseBody);
      const redacted = redactBody(body);
      result.responseBody = JSON.stringify(redacted);
    } catch {
      // If parsing fails, redact the entire string
      result.responseBody = '[REDACTED - INVALID JSON]';
    }
  } else {
    result.responseBody = data.responseBody;
  }

  return result;
}
