/**
 * Handler-related type definitions and interfaces
 */

import type {
  HandlerContext,
  HandlerRequest,
  HandlerResponse,
  UploadMetadata,
  UploadResult,
} from '@refly/openapi-schema';

export { HandlerError } from '../constant';

/**
 * Pre-handler function type
 */
export type PreHandler = (
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerRequest>;

/**
 * Post-handler function type
 */
export type PostHandler = (
  response: HandlerResponse,
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerResponse>;

/**
 * Resource resolver interface
 */
export interface ResourceResolver {
  /**
   * Resolve drive file by file ID and convert to specified format
   * @param fileId - Drive file ID
   * @param format - Output format (base64, url, binary, text, or legacy 'buffer')
   * @returns Resolved file content in the specified format
   */
  resolveDriveFile: (
    fileId: string,
    format?: 'base64' | 'url' | 'binary' | 'buffer' | 'text',
  ) => Promise<string | Buffer>;
}

/**
 * Resource uploader interface
 * Uses DriveService for underlying file upload and storage operations
 */
export interface ResourceUploader {
  /**
   * Upload file to storage and create database record using DriveService
   * @param localPath - Local file path to upload
   * @param metadata - Upload metadata including provider, method, and resource type
   * @returns Upload result with file information
   */
  uploadFile: (localPath: string, metadata: UploadMetadata) => Promise<UploadResult>;

  /**
   * Upload file buffer directly to storage using DriveService
   * @param buffer - File buffer to upload
   * @param filename - Name of the file
   * @param metadata - Upload metadata including provider, method, and resource type
   * @returns Upload result with file information
   */
  uploadBuffer?: (
    buffer: Buffer,
    filename: string,
    metadata: UploadMetadata,
  ) => Promise<UploadResult>;

  /**
   * Upload file from external URL using DriveService
   * @param url - External URL to download and upload
   * @param filename - Name for the uploaded file
   * @param metadata - Upload metadata including provider, method, and resource type
   * @returns Upload result with file information
   */
  uploadFromUrl?: (
    url: string,
    filename: string,
    metadata: UploadMetadata,
  ) => Promise<UploadResult>;
}
