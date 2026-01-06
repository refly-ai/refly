import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, createPartFromUri } from '@google/genai';
import mime from 'mime';

/**
 * Gemini Files API - NestJS Service Implementation
 *
 * This service provides a complete interface for working with the Gemini Files API.
 * Files are stored for 48 hours and can be up to 2GB each, with 20GB total per project.
 *
 * @see https://ai.google.dev/gemini-api/docs/files
 */

export interface GeminiFileMetadata {
  name: string;
  displayName?: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  updateTime: string;
  expirationTime: string;
  sha256Hash: string;
  uri: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  error?: {
    code: number;
    message: string;
  };
}

export interface UploadFileOptions {
  /** The file path or Blob/Buffer to upload */
  file: string | Blob | Buffer;
  /** MIME type of the file (required for Blob/Buffer) */
  mimeType?: string;
  /** Display name for the file */
  displayName?: string;
}

export interface ListFilesOptions {
  /** Maximum number of files to return per page */
  pageSize?: number;
  /** Page token for pagination */
  pageToken?: string;
}

export interface ListFilesResponse {
  files: GeminiFileMetadata[];
  nextPageToken?: string;
}

export interface WaitForFileOptions {
  /** Polling interval in milliseconds (default: 1000) */
  pollIntervalMs?: number;
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeoutMs?: number;
}

@Injectable()
export class GeminiFilesApiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiFilesApiService.name);
  private client: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey =
      this.configService.get<string>('GOOGLE_API_KEY') ||
      this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'Gemini API key not configured. GeminiFilesApiService will not be available.',
      );
      return;
    }

    this.client = new GoogleGenAI({ apiKey });
    this.logger.log('GeminiFilesApiService initialized');
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.client;
  }

  /**
   * Ensure the client is configured before making API calls
   */
  private ensureConfigured(): void {
    if (!this.client) {
      throw new Error(
        'GeminiFilesApiService is not configured. Please set GOOGLE_API_KEY or GEMINI_API_KEY.',
      );
    }
  }

  /**
   * Upload a file to the Gemini Files API
   *
   * Use this when the total request size (including files, text prompt, system instructions, etc.)
   * is larger than 20 MB.
   *
   * @param options - Upload options including file path/data, mimeType, and displayName
   * @returns The uploaded file metadata
   *
   * @example
   * ```typescript
   * // Upload from file path
   * const file = await this.geminiFilesApiService.uploadFile({
   *   file: 'path/to/sample.mp3',
   *   mimeType: 'audio/mpeg',
   * });
   *
   * // Upload from Buffer
   * const buffer = fs.readFileSync('path/to/image.png');
   * const file = await this.geminiFilesApiService.uploadFile({
   *   file: buffer,
   *   mimeType: 'image/png',
   *   displayName: 'my-image',
   * });
   * ```
   */
  async uploadFile(options: UploadFileOptions): Promise<GeminiFileMetadata> {
    this.ensureConfigured();

    const { file, mimeType, displayName } = options;

    const uploadConfig: { mimeType?: string; displayName?: string } = {};
    if (mimeType) {
      uploadConfig.mimeType = mimeType;
    }
    if (displayName) {
      uploadConfig.displayName = displayName;
    }

    this.logger.debug(`Uploading file${displayName ? `: ${displayName}` : ''}`);

    const result = await this.client.files.upload({
      file: file as string,
      config: Object.keys(uploadConfig).length > 0 ? uploadConfig : undefined,
    });

    this.logger.debug(`File uploaded successfully: ${result.name}`);
    return result as unknown as GeminiFileMetadata;
  }

  /**
   * Upload a file from a URL
   *
   * Downloads the file from the URL and uploads it to Gemini.
   *
   * @param url - The URL to download the file from
   * @param options - Optional mimeType and displayName
   * @returns The uploaded file metadata
   *
   * @example
   * ```typescript
   * const file = await this.geminiFilesApiService.uploadFileFromUrl(
   *   'https://example.com/image.png',
   *   { mimeType: 'image/png' }
   * );
   * ```
   */
  async uploadFileFromUrl(
    url: string,
    options?: { mimeType?: string; displayName?: string },
  ): Promise<GeminiFileMetadata> {
    this.ensureConfigured();

    this.logger.debug(`Downloading file from URL: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    // Priority: explicit option > Content-Type header > infer from URL path
    const urlPath = new URL(url).pathname;
    const mimeType =
      options?.mimeType ||
      response.headers.get('content-type')?.split(';')[0] ||
      mime.getType(urlPath) ||
      'application/octet-stream';

    return this.uploadFile({
      file: buffer as unknown as string,
      mimeType,
      displayName: options?.displayName,
    });
  }

  /**
   * Get metadata for a file
   *
   * Verifies that the API successfully stored the uploaded file and retrieves its metadata.
   *
   * @param name - The file name (e.g., "files/abc123")
   * @returns The file metadata
   *
   * @example
   * ```typescript
   * const file = await this.geminiFilesApiService.uploadFile({ file: 'path/to/file.mp3' });
   * const metadata = await this.geminiFilesApiService.getFile(file.name);
   * console.log(metadata.state); // 'ACTIVE' when ready
   * ```
   */
  async getFile(name: string): Promise<GeminiFileMetadata> {
    this.ensureConfigured();

    const result = await this.client.files.get({ name });
    return result as unknown as GeminiFileMetadata;
  }

  /**
   * Wait for a file to become active
   *
   * Polls the file status until it becomes ACTIVE or FAILED.
   *
   * @param name - The file name
   * @param options - Polling options
   * @returns The file metadata when active
   * @throws Error if the file processing fails or times out
   *
   * @example
   * ```typescript
   * const file = await this.geminiFilesApiService.uploadFile({ file: 'path/to/video.mp4' });
   * const activeFile = await this.geminiFilesApiService.waitForFileActive(file.name);
   * ```
   */
  async waitForFileActive(name: string, options?: WaitForFileOptions): Promise<GeminiFileMetadata> {
    this.ensureConfigured();

    const pollInterval = options?.pollIntervalMs || 1000;
    const timeout = options?.timeoutMs || 300000; // 5 minutes default
    const startTime = Date.now();

    this.logger.debug(`Waiting for file to become active: ${name}`);

    while (Date.now() - startTime < timeout) {
      const file = await this.getFile(name);

      if (file.state === 'ACTIVE') {
        this.logger.debug(`File is now active: ${name}`);
        return file;
      }

      if (file.state === 'FAILED') {
        const errorMessage = `File processing failed: ${file.error?.message || 'Unknown error'}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    const timeoutError = `Timeout waiting for file to become active: ${name}`;
    this.logger.error(timeoutError);
    throw new Error(timeoutError);
  }

  /**
   * List all uploaded files
   *
   * Returns a paginated list of all files uploaded to the API.
   *
   * @param options - Pagination options
   * @returns List of files and optional next page token
   *
   * @example
   * ```typescript
   * // List first page
   * const { files, nextPageToken } = await this.geminiFilesApiService.listFiles({ pageSize: 10 });
   *
   * // Get next page
   * if (nextPageToken) {
   *   const nextPage = await this.geminiFilesApiService.listFiles({ pageToken: nextPageToken });
   * }
   * ```
   */
  async listFiles(options?: ListFilesOptions): Promise<ListFilesResponse> {
    this.ensureConfigured();

    const config: { pageSize?: number; pageToken?: string } = {};
    if (options?.pageSize) {
      config.pageSize = options.pageSize;
    }
    if (options?.pageToken) {
      config.pageToken = options.pageToken;
    }

    const files: GeminiFileMetadata[] = [];

    const listResponse = await this.client.files.list({
      config: Object.keys(config).length > 0 ? config : undefined,
    });

    // The SDK returns an async iterator, collect results
    for await (const file of listResponse) {
      files.push(file as unknown as GeminiFileMetadata);
    }

    return { files, nextPageToken: undefined };
  }

  /**
   * List all files (async generator)
   *
   * Returns an async iterator for all uploaded files.
   *
   * @example
   * ```typescript
   * for await (const file of this.geminiFilesApiService.listAllFiles()) {
   *   console.log(file.name);
   * }
   * ```
   */
  async *listAllFiles(): AsyncGenerator<GeminiFileMetadata> {
    this.ensureConfigured();

    const listResponse = await this.client.files.list();
    for await (const file of listResponse) {
      yield file as unknown as GeminiFileMetadata;
    }
  }

  /**
   * Delete an uploaded file
   *
   * Files are automatically deleted after 48 hours, but you can manually delete them earlier.
   *
   * @param name - The file name to delete (e.g., "files/abc123")
   *
   * @example
   * ```typescript
   * const file = await this.geminiFilesApiService.uploadFile({ file: 'path/to/file.mp3' });
   * await this.geminiFilesApiService.deleteFile(file.name);
   * ```
   */
  async deleteFile(name: string): Promise<void> {
    this.ensureConfigured();

    this.logger.debug(`Deleting file: ${name}`);
    await this.client.files.delete({ name });
    this.logger.debug(`File deleted successfully: ${name}`);
  }

  /**
   * Create a file part for use in generateContent
   *
   * Helper method to create the correct part format for including a file in a prompt.
   *
   * @param file - The file metadata
   * @returns A part that can be used in generateContent
   *
   * @example
   * ```typescript
   * const file = await this.geminiFilesApiService.uploadFile({
   *   file: 'path/to/image.png',
   *   mimeType: 'image/png',
   * });
   *
   * const part = this.geminiFilesApiService.createFilePart(file);
   * // Use with generateContent:
   * // contents: [part, "Describe this image"]
   * ```
   */
  createFilePart(file: GeminiFileMetadata) {
    return createPartFromUri(file.uri, file.mimeType);
  }

  /**
   * Upload a file and wait for it to be ready
   *
   * Convenience method that uploads a file and waits for it to become active.
   *
   * @param options - Upload options
   * @param waitOptions - Options for waiting
   * @returns The active file metadata
   *
   * @example
   * ```typescript
   * const file = await this.geminiFilesApiService.uploadFileAndWait({
   *   file: 'path/to/video.mp4',
   *   mimeType: 'video/mp4',
   * });
   * // File is guaranteed to be ready for use
   * ```
   */
  async uploadFileAndWait(
    options: UploadFileOptions,
    waitOptions?: WaitForFileOptions,
  ): Promise<GeminiFileMetadata> {
    const file = await this.uploadFile(options);
    return this.waitForFileActive(file.name, waitOptions);
  }
}

/**
 * Supported MIME types for Gemini Files API
 * @see https://ai.google.dev/gemini-api/docs/files
 */
export const SUPPORTED_MIME_TYPES = new Set([
  // Images
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',

  // Audio
  'audio/wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac',

  // Video
  'video/mp4',
  'video/mpeg',
  'video/mov',
  'video/avi',
  'video/x-flv',
  'video/mpg',
  'video/webm',
  'video/wmv',
  'video/3gpp',

  // Documents
  'application/pdf',
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/x-javascript',
  'text/x-typescript',
  'application/x-typescript',
  'text/csv',
  'text/markdown',
  'text/x-python',
  'application/x-python-code',
  'application/json',
  'text/xml',
  'application/rtf',
]);

/**
 * Check if a MIME type is supported by the Gemini Files API
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType);
}
