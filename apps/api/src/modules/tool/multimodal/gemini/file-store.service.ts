/**
 * GeminiFileStoreService - Manages file uploads to Gemini File API with LRU caching
 * Pure file operations service - gets client from GeminiClientService
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LRUCache } from 'lru-cache';
import pLimit from 'p-limit';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { GeminiFileRef, ImageInput } from './types';
import { MultimodalError, MultimodalErrorCode } from './types';
import { getExtensionFromMimeType } from '../../utils/image';
import { GeminiClientService } from './client.service';

/** Maximum file size for upload (20MB) */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Configurable concurrency limit for Gemini uploads */
const MM_UPLOAD_LIMIT = Number(process.env.MM_UPLOAD_LIMIT ?? 3);
const uploadLimit = pLimit(MM_UPLOAD_LIMIT);

/** Default cache options */
const DEFAULT_MAX_FILES = 100;
const DEFAULT_TTL_MINUTES = 45;

/** Supported MIME types for Gemini File API */
const SUPPORTED_MIME_TYPES: string[] = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  // Documents
  'application/pdf',
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
  'video/3gpp',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/flac',
  'audio/aac',
];

/**
 * File store service for managing Gemini File API uploads with caching
 * Pure file operations - gets client from GeminiClientService
 */
@Injectable()
export class GeminiFileStoreService implements OnModuleDestroy {
  private cache: LRUCache<string, GeminiFileRef>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly logger: PinoLogger,
    private readonly clientService: GeminiClientService,
  ) {
    this.logger.setContext(GeminiFileStoreService.name);

    // Initialize LRU cache
    this.cache = new LRUCache({
      max: DEFAULT_MAX_FILES,
      ttl: DEFAULT_TTL_MINUTES * 60 * 1000,
      updateAgeOnGet: true,
    });

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.cache.clear();
  }

  /**
   * Upload a file to Gemini File API, with caching support
   */
  async uploadFile(input: ImageInput): Promise<GeminiFileRef> {
    // Validate MIME type
    if (!this.isSupportedMimeType(input.mimeType)) {
      throw new MultimodalError(
        `Unsupported file type: ${input.mimeType}`,
        MultimodalErrorCode.UNSUPPORTED_TYPE,
        false,
        { mimeType: input.mimeType, supported: SUPPORTED_MIME_TYPES },
      );
    }

    const cacheKey = this.getInputCacheKey(input);

    // Check cache first
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isValidRef(cached)) {
        return cached;
      }
    }

    // Prepare file for upload
    const tempFilePath = await this.prepareFileForUpload(input);

    try {
      // Validate file size
      const stats = fs.statSync(tempFilePath);
      if (stats.size > MAX_FILE_SIZE) {
        throw new MultimodalError(
          `Image file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
          MultimodalErrorCode.FILE_TOO_LARGE,
          false,
          { sizeBytes: stats.size, maxBytes: MAX_FILE_SIZE },
        );
      }

      // Get client from client service and upload
      const client = this.clientService.getRawClient();

      // Upload to Gemini with concurrency limit using new SDK
      const uploadResult = await uploadLimit(() =>
        client.files.upload({
          file: tempFilePath,
          config: {
            mimeType: input.mimeType,
            displayName: input.name || path.basename(tempFilePath),
          },
        }),
      );

      const ref: GeminiFileRef = {
        uri: uploadResult.uri!,
        mimeType: uploadResult.mimeType || input.mimeType,
        displayName: uploadResult.displayName,
        expiresAt: uploadResult.expirationTime ? new Date(uploadResult.expirationTime) : undefined,
        sizeBytes: Number(uploadResult.sizeBytes) || stats.size,
      };

      // Cache the reference
      if (cacheKey) {
        this.cache.set(cacheKey, ref);
      }

      return ref;
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }

      if (this.isRateLimitError(error)) {
        throw new MultimodalError(
          'Rate limit exceeded, please retry later',
          MultimodalErrorCode.RATE_LIMITED,
          true,
          { originalError: error instanceof Error ? error.message : String(error) },
        );
      }

      throw new MultimodalError(
        'Failed to upload file to Gemini',
        MultimodalErrorCode.UPLOAD_FAILED,
        true,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    } finally {
      // Clean up temp file if we created one
      if (input.buffer && tempFilePath.startsWith(os.tmpdir())) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Get a cached file reference
   */
  getCached(cacheKey: string): GeminiFileRef | undefined {
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidRef(cached)) {
      return cached;
    }
    return undefined;
  }

  /**
   * Check if a file reference is still valid
   */
  isValidRef(ref: GeminiFileRef): boolean {
    if (!ref.expiresAt) return true;
    const buffer = 5 * 60 * 1000;
    return ref.expiresAt.getTime() > Date.now() + buffer;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
    };
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Generate a cache key from ImageInput
   */
  private getInputCacheKey(input: ImageInput): string | undefined {
    return input.cacheKey ?? input.storageKey ?? input.url ?? input.filePath;
  }

  /**
   * Prepare a file for upload (write buffer to temp file if needed)
   */
  private async prepareFileForUpload(input: ImageInput): Promise<string> {
    if (input.filePath) {
      if (!fs.existsSync(input.filePath)) {
        throw new MultimodalError(
          `File not found: ${input.filePath}`,
          MultimodalErrorCode.FILE_NOT_FOUND,
          false,
        );
      }
      return input.filePath;
    }

    if (input.buffer) {
      const ext = getExtensionFromMimeType(input.mimeType);
      const tempPath = path.join(os.tmpdir(), `gemini-upload-${Date.now()}${ext}`);
      fs.writeFileSync(tempPath, input.buffer);
      return tempPath;
    }

    if (input.url) {
      throw new MultimodalError(
        'URL download not supported, please provide buffer or filePath',
        MultimodalErrorCode.INVALID_CONFIG,
        false,
      );
    }

    throw new MultimodalError(
      'ImageInput requires buffer, filePath, or url',
      MultimodalErrorCode.INVALID_CONFIG,
      false,
    );
  }

  private isSupportedMimeType(mimeType: string): boolean {
    return (
      SUPPORTED_MIME_TYPES.includes(mimeType) ||
      mimeType.startsWith('image/') ||
      mimeType.startsWith('video/') ||
      mimeType.startsWith('audio/') ||
      mimeType === 'application/pdf'
    );
  }

  private isRateLimitError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('429') || message.toLowerCase().includes('rate limit');
  }

  private cleanup(): void {
    for (const [key, ref] of this.cache.entries()) {
      if (!this.isValidRef(ref)) {
        this.cache.delete(key);
      }
    }
  }
}
