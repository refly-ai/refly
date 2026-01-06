/**
 * MultimodalBridgeService - Bridge between ReflyService and MultimodalToolsService
 * Handles file retrieval from Drive and delegates to MultimodalToolsService for processing
 * Includes standalone credit tracking for multimodal processing
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { User } from '@refly/openapi-schema';
import { runModuleInitWithTimeoutAndRetry } from '@refly/utils';
import { PinoLogger } from 'nestjs-pino';
import * as fs from 'node:fs';
import { DriveService } from '../../drive/drive.service';
import { MiscService } from '../../misc/misc.service';
import { MultimodalToolsService } from './multimodal-tools.service';
import { QUEUE_SYNC_MULTIMODAL_CREDIT_USAGE } from '../../../utils/const';
import { MULTIMODAL_BILLING_RATES, MULTIMODAL_MODEL_ID } from '../constant/multimodal-billing';
import type { MultimodalTokenUsage, MultimodalityType } from './gemini/types';
import type { SyncMultimodalCreditUsageJobData } from '../../credit/credit.dto';

// Response types
export interface MultimodalResponse<T = unknown> {
  success: boolean;
  errCode?: string;
  errMsg?: string;
  data?: T;
}

export interface VideoUnderstandingResult {
  analysis: string;
  timestamps?: Array<{ timestamp: string; description: string }>;
  fileName?: string;
  fileId?: string;
  tokenUsage?: MultimodalTokenUsage;
}

export interface DocumentProcessingResult {
  analysis: string;
  tables?: Array<{
    title?: string;
    headers: string[];
    rows: string[][];
    pageNumber?: number;
  }>;
  structure?: {
    title?: string;
    pageCount: number;
    sections: Array<{ title: string; level: number; pageNumber?: number }>;
  };
  fileName?: string;
  fileId: string;
  tokenUsage?: MultimodalTokenUsage;
}

export interface AudioUnderstandingResult {
  analysis: string;
  transcript?: {
    text: string;
    segments?: Array<{
      start: string;
      end: string;
      text: string;
      speaker?: string;
    }>;
    detectedLanguage?: string;
  };
  speakers?: Array<{
    speaker: string;
    start: string;
    end: string;
    text: string;
  }>;
  fileName?: string;
  fileId: string;
  tokenUsage?: MultimodalTokenUsage;
}

export interface SpeechGenerationResult {
  fileId: string;
  fileName: string;
  durationMs: number;
  storageKey?: string;
  tokenUsage?: MultimodalTokenUsage;
}

export interface MediaData {
  filePath: string;
  mimeType: string;
  fileName: string;
}

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
    tokenUsage?: MultimodalTokenUsage;
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
    tokenUsage?: MultimodalTokenUsage;
  };
}

export interface ImageData {
  filePath: string;
  mimeType: string;
  fileName: string;
}

@Injectable()
export class MultimodalBridgeService implements OnModuleInit {
  private driveService: DriveService;
  private miscService: MiscService;

  constructor(
    private moduleRef: ModuleRef,
    private readonly logger: PinoLogger,
    private readonly multimodalToolsService: MultimodalToolsService,
    @InjectQueue(QUEUE_SYNC_MULTIMODAL_CREDIT_USAGE)
    private readonly multimodalCreditQueue: Queue,
  ) {
    this.logger.setContext(MultimodalBridgeService.name);
  }

  /**
   * Track credit usage for multimodal processing
   * Queues credit deduction asynchronously to avoid blocking the response
   */
  private async trackCreditUsage(
    user: User,
    tokenUsage: MultimodalTokenUsage | undefined,
    modalityType: MultimodalityType,
  ): Promise<void> {
    if (!tokenUsage) {
      this.logger.warn(`No token usage data available for ${modalityType} processing`);
      return;
    }

    try {
      const jobData: SyncMultimodalCreditUsageJobData = {
        uid: user.uid,
        tokenUsage: {
          promptTokens: tokenUsage.promptTokens,
          outputTokens: tokenUsage.outputTokens,
          totalTokens: tokenUsage.totalTokens,
          cachedContentTokens: tokenUsage.cachedContentTokens,
          modalityType: tokenUsage.modalityType,
          modelId: tokenUsage.modelId || MULTIMODAL_MODEL_ID,
        },
        creditBilling: MULTIMODAL_BILLING_RATES[modalityType],
        timestamp: new Date(),
      };

      await this.multimodalCreditQueue.add('sync-multimodal-credit', jobData);
      this.logger.debug(
        `Queued credit usage for ${modalityType}: ${tokenUsage.totalTokens} tokens`,
      );
    } catch (error) {
      // Log but don't fail the request if credit tracking fails
      this.logger.error(`Failed to queue credit usage for ${modalityType}: ${error?.message}`);
    }
  }

  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      () => {
        this.driveService = this.moduleRef.get(DriveService, { strict: false });
        this.miscService = this.moduleRef.get(MiscService, { strict: false });
      },
      {
        logger: this.logger,
        label: 'MultimodalBridgeService.onModuleInit',
      },
    );
  }

  /**
   * Analyze video content (file or YouTube URL)
   */
  async videoUnderstanding(
    user: User,
    params: {
      fileId?: string;
      youtubeUrl?: string;
      query?: string;
      mode?: 'general' | 'transcript' | 'timeline';
      contentType?: string;
    },
  ): Promise<MultimodalResponse<VideoUnderstandingResult>> {
    try {
      // Use provided contentType or fetch from storage
      const videoData = await this.getMediaData(user, params.fileId, 'video', params.contentType);
      if (!videoData && !params.youtubeUrl) {
        return {
          success: false,
          errCode: 'VIDEO_NOT_FOUND',
          errMsg: `Could not find or access video: ${params.fileId}`,
        };
      }

      const result = await this.multimodalToolsService.analyzeVideo({
        video: params.youtubeUrl
          ? { youtubeUrl: params.youtubeUrl, mimeType: 'video/*' }
          : { filePath: videoData!.filePath, mimeType: videoData!.mimeType as any },
        query: params.query,
        mode: params.mode || 'general',
      });

      // Track credit usage for video processing
      await this.trackCreditUsage(user, result.tokenUsage, 'video');

      return {
        success: true,
        data: {
          analysis: result.analysis,
          timestamps: result.timestamps,
          fileName: videoData?.fileName,
          fileId: params.fileId,
          tokenUsage: result.tokenUsage,
        },
      };
    } catch (error) {
      this.logger.error(`videoUnderstanding failed: ${error?.message}`, error);
      return {
        success: false,
        errCode: 'VIDEO_ANALYSIS_ERROR',
        errMsg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process and analyze documents (PDF and other supported formats)
   */
  async documentProcessing(
    user: User,
    params: {
      fileId: string;
      query?: string;
      mode?: 'summary' | 'extract' | 'qa';
      pageRange?: { start?: number; end?: number };
      contentType?: string;
    },
  ): Promise<MultimodalResponse<DocumentProcessingResult>> {
    try {
      // Use provided contentType or fetch from storage
      const docData = await this.getMediaData(user, params.fileId, 'document', params.contentType);
      if (!docData) {
        return {
          success: false,
          errCode: 'DOCUMENT_NOT_FOUND',
          errMsg: `Could not find or access document: ${params.fileId}`,
        };
      }

      const result = await this.multimodalToolsService.analyzeDocument({
        document: { filePath: docData.filePath, mimeType: docData.mimeType as any },
        query: params.query,
        mode: params.mode || 'summary',
        pageRange: params.pageRange,
      });

      // Track credit usage for document processing
      await this.trackCreditUsage(user, result.tokenUsage, 'document');

      return {
        success: true,
        data: {
          analysis: result.analysis,
          tables: result.tables,
          structure: result.structure,
          fileName: docData.fileName,
          fileId: params.fileId,
          tokenUsage: result.tokenUsage,
        },
      };
    } catch (error) {
      this.logger.error(`documentProcessing failed: ${error?.message}`, error);
      return {
        success: false,
        errCode: 'DOCUMENT_PROCESSING_ERROR',
        errMsg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Analyze audio content (transcription, summarization, Q&A, speaker diarization)
   */
  async audioUnderstanding(
    user: User,
    params: {
      fileId: string;
      query?: string;
      mode?: 'transcription' | 'summary' | 'qa' | 'speaker_diarization';
      language?: string;
      contentType?: string;
    },
  ): Promise<MultimodalResponse<AudioUnderstandingResult>> {
    try {
      // Use provided contentType or fetch from storage
      const audioData = await this.getMediaData(user, params.fileId, 'audio', params.contentType);
      if (!audioData) {
        return {
          success: false,
          errCode: 'AUDIO_NOT_FOUND',
          errMsg: `Could not find or access audio: ${params.fileId}`,
        };
      }

      const result = await this.multimodalToolsService.analyzeAudio({
        audio: { filePath: audioData.filePath, mimeType: audioData.mimeType as any },
        query: params.query,
        mode: params.mode || 'transcription',
        language: params.language,
      });

      // Track credit usage for audio processing
      await this.trackCreditUsage(user, result.tokenUsage, 'audio');

      return {
        success: true,
        data: {
          analysis: result.analysis,
          transcript: result.transcript,
          speakers: result.speakers,
          fileName: audioData.fileName,
          fileId: params.fileId,
          tokenUsage: result.tokenUsage,
        },
      };
    } catch (error) {
      this.logger.error(`audioUnderstanding failed: ${error?.message}`, error);
      return {
        success: false,
        errCode: 'AUDIO_ANALYSIS_ERROR',
        errMsg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate speech from text (TTS)
   */
  async speechGeneration(
    user: User,
    params: {
      text: string;
      voice?: string;
      language?: string;
    },
  ): Promise<MultimodalResponse<SpeechGenerationResult>> {
    try {
      const result = await this.multimodalToolsService.generateSpeech({
        text: params.text,
        voiceName: params.voice as any,
        language: params.language,
      });

      // Track credit usage for speech generation
      await this.trackCreditUsage(user, result.tokenUsage, 'speech');

      const fileName = `speech-${Date.now()}.wav`;

      // Upload the generated audio to storage
      const uploadResult = await this.miscService.uploadFile(user, {
        file: {
          buffer: result.audioBuffer,
          mimetype: result.mimeType,
          originalname: fileName,
        },
        entityType: 'driveFile',
        visibility: 'private',
      });

      if (!uploadResult?.storageKey) {
        throw new Error('Failed to upload audio file');
      }

      return {
        success: true,
        data: {
          fileId: uploadResult.storageKey,
          fileName,
          durationMs: result.durationMs,
          storageKey: uploadResult.storageKey,
          tokenUsage: result.tokenUsage,
        },
      };
    } catch (error) {
      this.logger.error(`speechGeneration failed: ${error?.message}`, error);
      return {
        success: false,
        errCode: 'SPEECH_GENERATION_ERROR',
        errMsg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get available TTS voices
   */
  getAvailableTTSVoices(): string[] {
    return this.multimodalToolsService.getAvailableVoices();
  }

  // ============================================================================
  // Vision Read (Image Analysis)
  // ============================================================================

  /**
   * Read and analyze an image using Gemini multimodal API
   */
  async visionRead(user: User, params: VisionReadParams): Promise<VisionReadResult> {
    let tempFilePath: string | null = null;
    try {
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

      // Use MultimodalToolsService for image interpretation
      const result = await this.multimodalToolsService.interpretImages({
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

      // Track credit usage for image processing
      await this.trackCreditUsage(user, result.tokenUsage, 'image');

      return {
        success: true,
        data: {
          analysis: result.interpretations[0] || '',
          fileName: imageData.fileName,
          fileId: params.fileId,
          tokenUsage: result.tokenUsage,
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

      // Use MultimodalToolsService for batch image interpretation - all images in one API call
      const result = await this.multimodalToolsService.interpretImages({
        images: imagesToProcess,
        query: params.query,
        maxChars: Math.min(8000 * validImages.length, 32000), // Scale max chars with image count
      });

      // Track credit usage for batch image processing
      await this.trackCreditUsage(user, result.tokenUsage, 'image');

      return {
        success: true,
        data: {
          analysis: result.interpretations[0] || '',
          fileNames: validImages.map((v) => v.data.fileName),
          fileIds: validImages.map((v) => v.fileId),
          tokenUsage: result.tokenUsage,
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

  /**
   * Get video data from drive file
   */
  async getVideoData(user: User, fileId: string): Promise<MediaData | null> {
    return this.getMediaData(user, fileId, 'video');
  }

  /**
   * Get document data from drive file
   */
  async getDocumentData(user: User, fileId: string): Promise<MediaData | null> {
    return this.getMediaData(user, fileId, 'document');
  }

  /**
   * Get audio data from drive file
   */
  async getAudioData(user: User, fileId: string): Promise<MediaData | null> {
    return this.getMediaData(user, fileId, 'audio');
  }

  /**
   * Helper method to get media data from drive file
   * @param user - User making the request
   * @param fileId - Drive file ID
   * @param mediaType - Type of media for default MIME type fallback
   * @param providedContentType - Optional MIME type from caller (avoids re-querying if provided)
   */
  private async getMediaData(
    user: User,
    fileId: string | undefined,
    mediaType: 'video' | 'document' | 'audio',
    providedContentType?: string,
  ): Promise<MediaData | null> {
    if (!fileId) return null;

    try {
      const driveFile = await this.driveService.getDriveFileDetail(user, fileId, {
        includeContent: false,
      });
      if (!driveFile || !driveFile.storageKey) {
        return null;
      }

      // Use provided contentType first, then fall back to driveFile.type, then default
      const mimeType = providedContentType || driveFile.type || this.getDefaultMimeType(mediaType);
      const extension = this.getExtensionFromMimeType(mimeType, mediaType);

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
      this.logger.warn(`Failed to get ${mediaType} data for ${fileId}: ${error?.message}`);
      return null;
    }
  }

  private getDefaultMimeType(mediaType: 'video' | 'document' | 'audio'): string {
    switch (mediaType) {
      case 'video':
        return 'video/mp4';
      case 'document':
        return 'application/pdf';
      case 'audio':
        return 'audio/mpeg';
    }
  }

  private getExtensionFromMimeType(
    mimeType: string,
    mediaType: 'video' | 'document' | 'audio',
  ): string {
    const extMap: Record<string, string> = {
      // Video
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
      // Document
      'application/pdf': '.pdf',
      // Audio
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/webm': '.webm',
      'audio/mp4': '.m4a',
      'audio/flac': '.flac',
    };

    if (extMap[mimeType]) {
      return extMap[mimeType];
    }

    // Default extensions by media type
    switch (mediaType) {
      case 'video':
        return '.mp4';
      case 'document':
        return '.pdf';
      case 'audio':
        return '.mp3';
    }
  }
}
