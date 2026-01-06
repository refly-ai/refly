import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { User } from '@refly/openapi-schema';
import { runModuleInitWithTimeoutAndRetry } from '@refly/utils';
import { PinoLogger } from 'nestjs-pino';
import * as fs from 'node:fs';
import { DriveService } from '../../../drive/drive.service';
import { MiscService } from '../../../misc/misc.service';
import { GeminiClientService } from './client.service';
import { ImageInterpreterService } from './image.service';

export interface VisionReadParams {
  fileId: string;
  query?: string;
  mode?: 'general' | 'ocr' | 'data';
}

export interface BatchVisionReadParams {
  fileIds: string[];
  query?: string;
  mode?: 'general' | 'ocr' | 'data';
}

export interface VisionReadResult {
  success: boolean;
  errCode?: string;
  errMsg?: string;
  data?: {
    analysis: string;
    fileName: string;
    fileId: string;
  };
}

export interface BatchVisionReadResult {
  success: boolean;
  errCode?: string;
  errMsg?: string;
  data?: {
    analysis: string;
    fileNames: string[];
    fileIds: string[];
  };
}

export interface ImageData {
  filePath: string;
  mimeType: string;
  fileName: string;
}

@Injectable()
export class VisionService implements OnModuleInit {
  private driveService: DriveService;
  private miscService: MiscService;

  constructor(
    private moduleRef: ModuleRef,
    private readonly logger: PinoLogger,
    private readonly clientService: GeminiClientService,
    private readonly interpreterService: ImageInterpreterService,
  ) {
    this.logger.setContext(VisionService.name);
  }

  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      () => {
        this.driveService = this.moduleRef.get(DriveService, { strict: false });
        this.miscService = this.moduleRef.get(MiscService, { strict: false });
      },
      {
        logger: this.logger,
        label: 'VisionService.onModuleInit',
      },
    );
  }

  /**
   * Read and analyze an image using Gemini multimodal API
   */
  async visionRead(user: User, params: VisionReadParams): Promise<VisionReadResult> {
    let tempFilePath: string | null = null;
    try {
      const geminiClient = this.clientService.getClient();

      // Get image data from drive file (downloads to local temp file)
      const imageData = await this.getImageData(user, params.fileId);
      if (!imageData) {
        return {
          success: false,
          errCode: 'IMAGE_NOT_FOUND',
          errMsg: `Could not find or access image: ${params.fileId}`,
        };
      }
      tempFilePath = imageData.filePath;

      // Use ImageInterpreterService for analysis with local file path
      const result = await this.interpreterService.interpret(geminiClient, {
        images: [
          {
            filePath: imageData.filePath,
            mimeType: imageData.mimeType as any,
            name: imageData.fileName,
            cacheKey: params.fileId,
          },
        ],
        query: params.query,
        maxChars: 8000,
      });

      return {
        success: true,
        data: {
          analysis: result.interpretations[0] || '',
          fileName: imageData.fileName,
          fileId: params.fileId,
        },
      };
    } catch (error) {
      this.logger.error(`visionRead failed: ${error?.message}`, error);
      return {
        success: false,
        errCode: 'VISION_ERROR',
        errMsg: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Clean up temp file after processing
      if (tempFilePath) {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Batch read and analyze multiple images using Gemini multimodal API
   * All images are uploaded and processed together in a single API call
   */
  async batchVisionRead(user: User, params: BatchVisionReadParams): Promise<BatchVisionReadResult> {
    const tempFilePaths: string[] = [];
    try {
      const geminiClient = this.clientService.getClient();

      // Download all images in parallel
      const imageDataPromises = params.fileIds.map((fileId) => this.getImageData(user, fileId));
      const imageDataResults = await Promise.all(imageDataPromises);

      // Filter out failed downloads and collect temp paths for cleanup
      const validImages: { data: ImageData; fileId: string }[] = [];
      for (let i = 0; i < imageDataResults.length; i++) {
        const imageData = imageDataResults[i];
        if (imageData) {
          tempFilePaths.push(imageData.filePath);
          validImages.push({ data: imageData, fileId: params.fileIds[i] });
        }
      }

      if (validImages.length === 0) {
        return {
          success: false,
          errCode: 'IMAGES_NOT_FOUND',
          errMsg: 'Could not find or access any of the specified images',
        };
      }

      // Prepare images for batch processing
      const imagesToProcess = validImages.map(({ data, fileId }) => ({
        filePath: data.filePath,
        mimeType: data.mimeType as any,
        name: data.fileName,
        cacheKey: fileId,
      }));

      // Use ImageInterpreterService for batch analysis - all images in one API call
      const result = await this.interpreterService.interpret(geminiClient, {
        images: imagesToProcess,
        query: params.query,
        maxChars: Math.min(8000 * validImages.length, 32000), // Scale max chars with image count
      });

      return {
        success: true,
        data: {
          analysis: result.interpretations[0] || '',
          fileNames: validImages.map((v) => v.data.fileName),
          fileIds: validImages.map((v) => v.fileId),
        },
      };
    } catch (error) {
      this.logger.error(`batchVisionRead failed: ${error?.message}`, error);
      return {
        success: false,
        errCode: 'VISION_ERROR',
        errMsg: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Clean up all temp files after processing
      for (const tempFilePath of tempFilePaths) {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Get image data from a drive file
   * Downloads to local temp file path for direct upload to Gemini File API
   *
   * Note: Uses includeContent: false to bypass document parsing size limits
   * since images are processed by Gemini File API which supports up to 20MB
   */
  async getImageData(user: User, fileId: string): Promise<ImageData | null> {
    try {
      // Only get metadata, not parsed content - avoids loadOrParseDriveFile size limits
      const driveFile = await this.driveService.getDriveFileDetail(user, fileId, {
        includeContent: false,
      });
      if (!driveFile || !driveFile.storageKey) {
        return null;
      }

      // Get file extension from mime type
      const mimeType = driveFile.type || 'image/png';
      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/heic': '.heic',
        'image/heif': '.heif',
      };
      const extension = extMap[mimeType] || '.bin';

      // Download to local temp file path for Gemini File API upload
      const filePath = await this.miscService.downloadFileToPath(
        { storageKey: driveFile.storageKey, visibility: 'private' },
        extension,
      );

      return {
        filePath,
        mimeType,
        fileName: driveFile.name || fileId,
      };
    } catch (error) {
      this.logger.warn(`Failed to get image data for ${fileId}: ${error?.message}`);
      return null;
    }
  }
}
