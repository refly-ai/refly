/**
 * Handler type definitions
 * Migrated from @refly/openapi-schema to keep dynamic-tooling self-contained
 */

import type {
  HandlerContext,
  HandlerRequest,
  HandlerResponse,
  UploadMetadata,
  UploadResult,
} from '@refly/openapi-schema';

/**
 * Pre-handler function type
 * Processes the request before it's executed
 */
export type PreHandler = (
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerRequest>;

/**
 * Post-handler function type
 * Processes the response after execution
 */
export type PostHandler = (
  response: HandlerResponse,
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerResponse>;

/**
 * Resource resolver interface
 * Handles resolution of Drive file resources
 */
export interface ResourceResolver {
  /**
   * Resolve a Drive file to the requested format
   * @param fileId - The file ID to resolve
   * @param format - Desired output format
   * @returns Resolved file data
   */
  resolveDriveFile: (
    fileId: string,
    format?: 'base64' | 'url' | 'binary' | 'buffer' | 'text',
  ) => Promise<string | Buffer>;
}

/**
 * Resource uploader interface
 * Handles uploading of resources from various sources
 */
export interface ResourceUploader {
  /**
   * Upload a file from local filesystem
   * @param localPath - Path to the local file
   * @param metadata - Upload metadata
   * @returns Upload result with file information
   */
  uploadFile: (localPath: string, metadata: UploadMetadata) => Promise<UploadResult>;

  /**
   * Upload a file from a Buffer
   * @param buffer - File data as Buffer
   * @param filename - Desired filename
   * @param metadata - Upload metadata
   * @returns Upload result with file information
   */
  uploadBuffer?: (
    buffer: Buffer,
    filename: string,
    metadata: UploadMetadata,
  ) => Promise<UploadResult>;

  /**
   * Upload a file from a URL
   * @param url - Source URL
   * @param filename - Desired filename
   * @param metadata - Upload metadata
   * @returns Upload result with file information
   */
  uploadFromUrl?: (
    url: string,
    filename: string,
    metadata: UploadMetadata,
  ) => Promise<UploadResult>;
}
