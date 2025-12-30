import { Injectable, Logger } from '@nestjs/common';
import _ from 'lodash';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { DriveService } from '../../../../drive/drive.service';
import { getCurrentUser } from '../../../tool-context';
import { collectResourceFields, extractFileId } from '../../../utils/schema-utils';
import type { IToolPreHandler, PreHandlerInput, PreHandlerOutput } from './pre.interface';

/**
 * Maximum image size in bytes (5MB)
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * Maximum video size in bytes (100MB) - Instagram limit
 */
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

/**
 * Supported image MIME types for compression
 */
const COMPRESSIBLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
]);

/**
 * Video MIME types
 */
const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/webm',
  'video/mpeg',
  'video/3gpp',
  'video/mov',
]);

/**
 * Toolsets with video size limits
 */
const VIDEO_SIZE_LIMITED_TOOLSETS = new Set(['instagram', 'tiktok', 'facebook']);

/**
 * Composio Pre-Execution Handler
 * Handles file_uploadable fields by downloading files to temp directory
 */
@Injectable()
export class ComposioToolPreHandlerService implements IToolPreHandler {
  protected readonly logger = new Logger(ComposioToolPreHandlerService.name);

  constructor(private readonly driveService: DriveService) {}

  /**
   * Process file_uploadable fields before tool execution
   */
  async process(input: PreHandlerInput): Promise<PreHandlerOutput> {
    const { request, schema, toolsetKey } = input;
    const localTempFiles: string[] = [];

    try {
      // Collect all resource fields from schema
      const resourceFields = collectResourceFields(schema);

      // Filter for file_path format (file_uploadable fields)
      const fileUploadFields = resourceFields.filter(
        (field) => field.schema.format === 'file_path',
      );

      if (fileUploadFields.length === 0) {
        // No file upload fields, return as-is with no-op cleanup
        return {
          request,
          cleanup: async () => {},
          success: true,
        };
      }

      // Process each file upload field
      const modifiedParams = { ...request.params };

      for (const field of fileUploadFields) {
        const value = _.get(modifiedParams, field.dataPath);

        if (!value) {
          continue; // Skip undefined/null values
        }

        // Extract fileId from value
        const fileId = extractFileId(value);
        if (!fileId) {
          this.logger.warn(`Invalid fileId for field ${field.dataPath}: ${value}`);
          continue;
        }

        // Download file to temp directory (with toolsetKey for size validation)
        const localPath = await this.downloadFileToTemp(fileId, field.dataPath, toolsetKey);

        localTempFiles.push(localPath);

        // Replace fileId with local file path
        _.set(modifiedParams, field.dataPath, localPath);
      }

      // Return modified request with cleanup function
      return {
        request: { ...request, params: modifiedParams },
        cleanup: async () => {
          await this.cleanupTempFiles(localTempFiles);
        },
        success: true,
      };
    } catch (error) {
      // On error, clean up any files already created
      await this.cleanupTempFiles(localTempFiles);

      return {
        request,
        cleanup: async () => {},
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Download file from DriveService to temporary directory
   * Compresses images larger than 5MB
   * Validates video size for social media platforms
   */
  private async downloadFileToTemp(
    fileId: string,
    _fieldPath: string,
    toolsetKey: string,
  ): Promise<string> {
    // Get current user from tool-context
    const user = getCurrentUser();

    // Get file details and validate permissions
    const driveFile = await this.driveService.getDriveFileDetail(user, fileId, {
      includeContent: false,
    });

    if (!driveFile) {
      throw new Error(`File not found or access denied: ${fileId}`);
    }

    // Get file stream
    const { data, filename } = await this.driveService.getDriveFileStream(user, fileId);

    // Validate video size for platforms with limits
    this.validateVideoSize(data, driveFile.type, toolsetKey, filename);

    // Generate unique temp file path
    // Format: composio-{timestamp}-{fileId}-{originalName}
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempFileName = `composio-${timestamp}-${fileId}-${safeName}`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    // Process file data (compress if needed)
    const processedData = await this.processFileData(data, driveFile.type, fileId);

    // Write buffer to temp file
    await fs.writeFile(tempFilePath, processedData);

    this.logger.debug(
      `Downloaded ${fileId} to ${tempFilePath} (size: ${processedData.length} bytes)`,
    );

    return tempFilePath;
  }

  /**
   * Validate video size for platforms with size limits
   * Throws error if video exceeds platform limit
   */
  private validateVideoSize(
    data: Buffer,
    mimeType: string | undefined,
    toolsetKey: string,
    filename: string,
  ): void {
    // Check if it's a video file
    if (!mimeType || !VIDEO_TYPES.has(mimeType.toLowerCase())) {
      return;
    }

    // Check if toolset has video size limits
    const toolsetLower = toolsetKey.toLowerCase();
    if (!VIDEO_SIZE_LIMITED_TOOLSETS.has(toolsetLower)) {
      return;
    }

    // Check if video exceeds size limit
    if (data.length > MAX_VIDEO_SIZE) {
      const fileSizeMB = (data.length / 1024 / 1024).toFixed(2);
      const maxSizeMB = (MAX_VIDEO_SIZE / 1024 / 1024).toFixed(0);

      throw new Error(
        `Video file "${filename}" is too large (${fileSizeMB}MB). ${toolsetKey} requires videos to be under ${maxSizeMB}MB. Please compress your video before uploading.`,
      );
    }
  }

  /**
   * Process file data, compressing images if they exceed MAX_IMAGE_SIZE
   */
  private async processFileData(
    data: Buffer,
    mimeType: string | undefined,
    fileId: string,
  ): Promise<Buffer> {
    // Check if file is a compressible image type
    if (!mimeType || !COMPRESSIBLE_IMAGE_TYPES.has(mimeType.toLowerCase())) {
      return data;
    }

    // Check if file size exceeds limit
    if (data.length <= MAX_IMAGE_SIZE) {
      return data;
    }

    this.logger.debug(
      `Image ${fileId} exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB (${data.length} bytes), compressing...`,
    );

    return this.compressImage(data, mimeType, fileId);
  }

  /**
   * Compress image to fit within MAX_IMAGE_SIZE
   * Aggressive single-pass compression strategy:
   * - < 20MB: One-shot compression with calculated quality
   * - >= 20MB: Resize first, then compress
   */
  private async compressImage(data: Buffer, mimeType: string, fileId: string): Promise<Buffer> {
    const originalSize = data.length;
    const targetSize = MAX_IMAGE_SIZE * 0.95; // Target 95% of max to have some margin

    try {
      // For very large images (>= 20MB), resize first to preserve detail
      if (originalSize >= 20 * 1024 * 1024) {
        return this.resizeAndCompress(data, mimeType, fileId, targetSize);
      }

      // Calculate aggressive quality based on compression ratio needed
      // Use logarithmic scale for better quality estimation
      const compressionRatio = targetSize / originalSize;
      // Quality mapping: ratio 0.25 -> q~30, ratio 0.5 -> q~50, ratio 0.75 -> q~70
      const estimatedQuality = Math.max(15, Math.min(85, Math.round(compressionRatio * 85 * 0.85)));

      const compressedBuffer = await this.compressWithQuality(data, mimeType, estimatedQuality);

      this.logger.debug(
        `Image ${fileId} compressed: quality=${estimatedQuality}, ` +
          `${this.formatSize(originalSize)} → ${this.formatSize(compressedBuffer.length)} ` +
          `(${((1 - compressedBuffer.length / originalSize) * 100).toFixed(1)}% reduction)`,
      );

      // If still too large, fallback to resize
      if (compressedBuffer.length > MAX_IMAGE_SIZE) {
        this.logger.debug(`Image ${fileId} still too large, applying resize fallback`);
        return this.resizeAndCompress(data, mimeType, fileId, targetSize);
      }

      return compressedBuffer;
    } catch (error) {
      this.logger.warn(`Failed to compress image ${fileId}: ${(error as Error).message}`);
      return data;
    }
  }

  /**
   * Resize and compress image to target size
   * Preserves maximum detail by calculating optimal dimensions
   */
  private async resizeAndCompress(
    data: Buffer,
    mimeType: string,
    fileId: string,
    targetSize: number,
  ): Promise<Buffer> {
    const metadata = await sharp(data).metadata();
    const currentWidth = metadata.width || 1920;
    const currentHeight = metadata.height || 1080;

    // Calculate scale factor with quality compensation
    // We'll use quality 75 after resize, so account for ~25% compression from quality
    const effectiveTargetSize = targetSize / 0.75;
    const scaleFactor = Math.sqrt(effectiveTargetSize / data.length);
    const newWidth = Math.max(800, Math.round(currentWidth * scaleFactor));
    const newHeight = Math.max(600, Math.round(currentHeight * scaleFactor));

    this.logger.debug(
      `Resizing image ${fileId}: ${currentWidth}x${currentHeight} → ${newWidth}x${newHeight}`,
    );

    const resizedBuffer = await this.applyResizeAndQuality(data, mimeType, newWidth, newHeight, 75);

    this.logger.debug(
      `Image ${fileId} resized: ${this.formatSize(data.length)} → ${this.formatSize(resizedBuffer.length)}`,
    );

    return resizedBuffer;
  }

  /**
   * Apply resize and quality compression in one sharp pipeline
   */
  private async applyResizeAndQuality(
    data: Buffer,
    mimeType: string,
    width: number,
    height: number,
    quality: number,
  ): Promise<Buffer> {
    const pipeline = sharp(data).resize(width, height, { fit: 'inside', withoutEnlargement: true });

    switch (mimeType) {
      case 'image/png':
        return pipeline.png({ quality, compressionLevel: 9 }).toBuffer();
      case 'image/webp':
        return pipeline.webp({ quality }).toBuffer();
      case 'image/tiff':
        return pipeline.tiff({ quality }).toBuffer();
      default:
        return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    }
  }

  /**
   * Compress image with specific quality setting
   */
  private async compressWithQuality(
    data: Buffer,
    mimeType: string,
    quality: number,
  ): Promise<Buffer> {
    const sharpInstance = sharp(data);

    switch (mimeType) {
      case 'image/png':
        return sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer();
      case 'image/webp':
        return sharpInstance.webp({ quality }).toBuffer();
      case 'image/tiff':
        return sharpInstance.tiff({ quality }).toBuffer();
      default:
        // Use mozjpeg for better compression efficiency
        return sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
    }
  }

  /**
   * Format bytes to human readable size
   */
  private formatSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
    }
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        this.logger.debug(`Cleaned up temp file: ${filePath}`);
      } catch (error) {
        // Ignore cleanup errors (file may not exist)
        this.logger.warn(`Failed to cleanup temp file ${filePath}: ${(error as Error).message}`);
      }
    }
  }
}
