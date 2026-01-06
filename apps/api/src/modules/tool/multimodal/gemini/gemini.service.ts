/**
 * GeminiService - High-level orchestration service for Gemini multimodal operations
 *
 * This service combines client and file store operations to provide:
 * - Automatic API selection (inline vs File API) based on content size
 * - Content generation from mixed media inputs
 * - File upload management with smart caching
 */

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { GeminiClientService, GeminiClientInstance } from './client.service';
import { GeminiFileStoreService } from './file-store.service';
import type { MediaInput, GeminiFileRef, InlineData, ImageInput } from './types';
import { MultimodalError, MultimodalErrorCode } from './types';
import * as fs from 'node:fs';

/** Size threshold for switching from inline base64 to File API (20MB) */
const FILE_API_THRESHOLD = 20 * 1024 * 1024;

/** Options for content generation */
export interface GenerateContentOptions {
  /** Force use of File API even for small files */
  forceFileApi?: boolean;
  /** Custom size threshold for File API (default: 20MB) */
  sizeThreshold?: number;
}

/**
 * High-level Gemini service for multimodal content generation
 *
 * Provides intelligent routing between inline data and File API
 * based on content size and user preferences.
 */
@Injectable()
export class GeminiService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly clientService: GeminiClientService,
    private readonly fileStoreService: GeminiFileStoreService,
  ) {
    this.logger.setContext(GeminiService.name);
  }

  /**
   * Check if Gemini service is available
   */
  isAvailable(): boolean {
    return this.clientService.isAvailable();
  }

  /**
   * Get the client instance for direct operations
   */
  getClient(): GeminiClientInstance {
    return this.clientService.getClient();
  }

  /**
   * Generate content from media inputs with automatic API selection
   *
   * Automatically chooses between:
   * - Inline base64: For smaller payloads (< 20MB total), faster, no upload overhead
   * - File API: For larger payloads, handles files up to 2GB
   *
   * @param prompt - Text prompt for generation
   * @param media - Array of media inputs (images, videos, audio, documents)
   * @param options - Generation options
   * @returns Generated text content
   */
  async generateContent(
    prompt: string,
    media: MediaInput[],
    options?: GenerateContentOptions,
  ): Promise<string> {
    if (!media || media.length === 0) {
      // Text-only generation
      const result = await this.getClient().generateFromInlineData(prompt, []);
      return result.text;
    }

    const threshold = options?.sizeThreshold ?? FILE_API_THRESHOLD;
    const useFileApi = options?.forceFileApi || (await this.checkForLargeFiles(media, threshold));

    if (useFileApi) {
      this.logger.debug('Using File API for large content');
      const fileRefs = await this.uploadMedia(media);
      const result = await this.getClient().generateFromFiles(prompt, fileRefs);
      return result.text;
    } else {
      this.logger.debug('Using inline data for small content');
      const inlineData = await this.prepareInlineData(media);
      const result = await this.getClient().generateFromInlineData(prompt, inlineData);
      return result.text;
    }
  }

  /**
   * Generate content from pre-uploaded file references
   *
   * Use this when you already have file references from previous uploads
   * to avoid re-uploading the same files.
   *
   * @param prompt - Text prompt for generation
   * @param fileRefs - Array of Gemini file references
   * @returns Generated text content
   */
  async generateFromFiles(prompt: string, fileRefs: GeminiFileRef[]): Promise<string> {
    const result = await this.getClient().generateFromFiles(prompt, fileRefs);
    return result.text;
  }

  /**
   * Generate content from inline base64 data
   *
   * Use this for small files that don't need to be uploaded to File API.
   *
   * @param prompt - Text prompt for generation
   * @param inlineData - Array of base64-encoded media
   * @returns Generated text content
   */
  async generateFromInlineData(prompt: string, inlineData: InlineData[]): Promise<string> {
    const result = await this.getClient().generateFromInlineData(prompt, inlineData);
    return result.text;
  }

  /**
   * Upload media files to Gemini File API
   *
   * Files are cached for reuse within the TTL period.
   *
   * @param media - Array of media inputs to upload
   * @returns Array of file references
   */
  async uploadMedia(media: MediaInput[]): Promise<GeminiFileRef[]> {
    const fileRefs: GeminiFileRef[] = [];

    for (const input of media) {
      const imageInput: ImageInput = {
        buffer: input.buffer,
        filePath: input.filePath,
        url: input.url,
        mimeType: input.mimeType,
        name: input.name,
        cacheKey: input.cacheKey,
      };

      const ref = await this.fileStoreService.uploadFile(imageInput);
      fileRefs.push(ref);
    }

    return fileRefs;
  }

  /**
   * Check if any files exceed the size threshold
   *
   * @param media - Array of media inputs to check
   * @param threshold - Size threshold in bytes (default: 20MB)
   * @returns True if File API should be used
   */
  async checkForLargeFiles(
    media: MediaInput[],
    threshold: number = FILE_API_THRESHOLD,
  ): Promise<boolean> {
    let totalSize = 0;

    for (const input of media) {
      const size = await this.getMediaSize(input);
      totalSize += size;

      // Early exit if threshold exceeded
      if (totalSize >= threshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Prepare media inputs as inline base64 data
   *
   * @param media - Array of media inputs
   * @returns Array of inline data objects
   */
  async prepareInlineData(media: MediaInput[]): Promise<InlineData[]> {
    const inlineData: InlineData[] = [];

    for (const input of media) {
      const buffer = await this.getMediaBuffer(input);
      inlineData.push({
        mimeType: input.mimeType,
        data: buffer.toString('base64'),
      });
    }

    return inlineData;
  }

  /**
   * Get a cached file reference if available
   *
   * @param cacheKey - Cache key for the file
   * @returns File reference if cached and valid, undefined otherwise
   */
  getCachedFile(cacheKey: string): GeminiFileRef | undefined {
    return this.fileStoreService.getCached(cacheKey);
  }

  /**
   * Get file store statistics
   */
  getFileStoreStats(): { size: number; maxSize: number } {
    return this.fileStoreService.getStats();
  }

  /**
   * Clear the file store cache
   */
  clearFileCache(): void {
    this.fileStoreService.clear();
  }

  /**
   * Get the size of a media input in bytes
   */
  private async getMediaSize(input: MediaInput): Promise<number> {
    if (input.buffer) {
      return input.buffer.length;
    }

    if (input.filePath) {
      try {
        const stats = fs.statSync(input.filePath);
        return stats.size;
      } catch {
        throw new MultimodalError(
          `File not found: ${input.filePath}`,
          MultimodalErrorCode.FILE_NOT_FOUND,
          false,
        );
      }
    }

    if (input.url) {
      // For URLs, we can't know the size without downloading
      // Return 0 to let the caller decide (usually use File API for safety)
      return 0;
    }

    throw new MultimodalError(
      'MediaInput requires buffer, filePath, or url',
      MultimodalErrorCode.INVALID_CONFIG,
      false,
    );
  }

  /**
   * Get the buffer content of a media input
   */
  private async getMediaBuffer(input: MediaInput): Promise<Buffer> {
    if (input.buffer) {
      return input.buffer;
    }

    if (input.filePath) {
      try {
        return fs.readFileSync(input.filePath);
      } catch {
        throw new MultimodalError(
          `File not found: ${input.filePath}`,
          MultimodalErrorCode.FILE_NOT_FOUND,
          false,
        );
      }
    }

    if (input.url) {
      throw new MultimodalError(
        'URL download not supported for inline data, please provide buffer or use File API',
        MultimodalErrorCode.INVALID_CONFIG,
        false,
      );
    }

    throw new MultimodalError(
      'MediaInput requires buffer, filePath, or url',
      MultimodalErrorCode.INVALID_CONFIG,
      false,
    );
  }
}
