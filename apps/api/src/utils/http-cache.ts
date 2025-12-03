import { Request, Response } from 'express';
import { createHash } from 'node:crypto';

export interface CacheOptions {
  /** File or resource identifier */
  identifier: string;
  /** Last modified date */
  lastModified: Date;
  /** Cache-Control max-age in seconds (default: 1 year) */
  maxAge?: number;
  /** Whether the resource is immutable (default: true) */
  immutable?: boolean;
}

export interface CacheResult {
  /** Whether to use cached version (304 response) */
  useCache: boolean;
  /** ETag to be sent in response */
  etag: string;
  /** Last-Modified header value */
  lastModifiedHeader: string;
  /** Cache-Control header value */
  cacheControl: string;
}

/**
 * Check if the client has a valid cached version and generate cache headers
 * @param req Express Request object
 * @param options Cache configuration options
 * @returns Cache result with headers and whether to use cache
 */
export function checkHttpCache(req: Request, options: CacheOptions): CacheResult {
  const { identifier, lastModified, maxAge = 31536000, immutable = true } = options;

  // Generate ETag based on identifier and lastModified timestamp
  const etag = `"${createHash('md5')
    .update(`${identifier}-${lastModified.getTime()}`)
    .digest('hex')}"`;

  // Convert lastModified to HTTP date format
  const lastModifiedHeader = lastModified.toUTCString();

  // Build Cache-Control header
  const cacheControl = `public, max-age=${maxAge}${immutable ? ', immutable' : ''}`;

  // Check if client has cached version
  const ifNoneMatch = req.headers['if-none-match'];
  const ifModifiedSince = req.headers['if-modified-since'];

  const useCache =
    ifNoneMatch === etag ||
    (ifModifiedSince !== undefined && new Date(ifModifiedSince) >= lastModified);

  return {
    useCache,
    etag,
    lastModifiedHeader,
    cacheControl,
  };
}

/**
 * Send 304 Not Modified response with appropriate cache headers
 * @param res Express Response object
 * @param cacheResult Cache result from checkHttpCache
 * @param additionalHeaders Additional headers to include
 */
export function send304NotModified(
  res: Response,
  cacheResult: CacheResult,
  additionalHeaders: Record<string, string> = {},
): void {
  res.status(304);
  res.set({
    ETag: cacheResult.etag,
    'Last-Modified': cacheResult.lastModifiedHeader,
    'Cache-Control': cacheResult.cacheControl,
    ...additionalHeaders,
  });
  res.end();
}

/**
 * Apply cache headers to a successful response
 * @param res Express Response object
 * @param cacheResult Cache result from checkHttpCache
 * @param additionalHeaders Additional headers to include
 */
export function applyCacheHeaders(
  res: Response,
  cacheResult: CacheResult,
  additionalHeaders: Record<string, string> = {},
): void {
  res.set({
    ETag: cacheResult.etag,
    'Last-Modified': cacheResult.lastModifiedHeader,
    'Cache-Control': cacheResult.cacheControl,
    ...additionalHeaders,
  });
}
