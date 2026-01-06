/**
 * VideoInterpreterService - Analyzes video content using Gemini multimodal API
 * Supports file uploads and YouTube URLs
 */

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { GeminiClientInstance } from './client.service';
import { GeminiFileStoreService } from './file-store.service';
import { buildVideoAnalysisPrompt } from './prompts';
import type {
  VideoInput,
  VideoInterpretRequest,
  BatchVideoInterpretRequest,
  TimestampMarker,
  GeminiFileRef,
  VideoInterpretResultWithUsage,
  BatchVideoInterpretResultWithUsage,
  MultimodalTokenUsage,
} from './types';
import { MultimodalError, MultimodalErrorCode } from './types';

/** Maximum video file size for File API (2GB) */
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

/**
 * Service for interpreting video content using Gemini multimodal API
 */
@Injectable()
export class VideoInterpreterService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly fileStoreService: GeminiFileStoreService,
  ) {
    this.logger.setContext(VideoInterpreterService.name);
  }

  /**
   * Interpret video content and return structured analysis with token usage
   */
  async interpret(
    client: GeminiClientInstance,
    request: VideoInterpretRequest,
  ): Promise<VideoInterpretResultWithUsage> {
    const { video, query, mode = 'general' } = request;

    // Handle YouTube URL directly (Gemini native support)
    if (video.youtubeUrl) {
      return this.interpretYouTube(client, video.youtubeUrl, query, mode);
    }

    // Validate video input
    if (!video.buffer && !video.filePath && !video.url) {
      throw new MultimodalError(
        'Video input must have buffer, filePath, url, or youtubeUrl',
        MultimodalErrorCode.INVALID_CONFIG,
        false,
      );
    }

    // Check file size if buffer is provided
    if (video.buffer && video.buffer.length > MAX_FILE_SIZE) {
      throw new MultimodalError(
        'Video file exceeds 2GB limit. Please compress or trim the video.',
        MultimodalErrorCode.FILE_TOO_LARGE,
        false,
        {
          maxSize: '2GB',
          actualSize: `${(video.buffer.length / (1024 * 1024 * 1024)).toFixed(2)}GB`,
        },
      );
    }

    // Always use File API for video files
    let fileRef: GeminiFileRef;
    try {
      fileRef = await this.fileStoreService.uploadFile({
        buffer: video.buffer,
        filePath: video.filePath,
        url: video.url,
        mimeType: video.mimeType,
        name: video.name,
        cacheKey: video.cacheKey,
      });
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to upload video: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.UPLOAD_FAILED,
        true,
      );
    }

    // Build analysis prompt
    const prompt = buildVideoAnalysisPrompt({ query, mode });

    // Generate analysis using File API
    try {
      const result = await client.generateFromFiles(prompt, [fileRef]);

      // Parse timestamps if in timeline mode
      const timestamps = mode === 'timeline' ? this.parseTimestamps(result.text) : undefined;

      // Build token usage from response metadata
      const tokenUsage: MultimodalTokenUsage | undefined = result.usageMetadata
        ? {
            promptTokens: result.usageMetadata.promptTokenCount,
            outputTokens: result.usageMetadata.candidatesTokenCount,
            totalTokens: result.usageMetadata.totalTokenCount,
            cachedContentTokens: result.usageMetadata.cachedContentTokenCount,
            modalityType: 'video',
          }
        : undefined;

      return {
        analysis: result.text,
        timestamps,
        fileRef,
        tokenUsage,
      };
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to analyze video: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Interpret YouTube video using Gemini's native URL support
   */
  private async interpretYouTube(
    client: GeminiClientInstance,
    youtubeUrl: string,
    query: string | undefined,
    mode: 'general' | 'transcript' | 'timeline',
  ): Promise<VideoInterpretResultWithUsage> {
    // Validate YouTube URL
    if (!this.isValidYouTubeUrl(youtubeUrl)) {
      throw new MultimodalError(
        `Invalid YouTube URL: ${youtubeUrl}`,
        MultimodalErrorCode.INVALID_YOUTUBE_URL,
        false,
      );
    }

    const prompt = buildVideoAnalysisPrompt({ query, mode });

    try {
      // Gemini natively supports YouTube URLs via fileData
      const genAI = client.getClient();
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ fileData: { fileUri: youtubeUrl, mimeType: 'video/*' } }, { text: prompt }],
          },
        ],
      });

      const analysis = result.text || '';
      const timestamps = mode === 'timeline' ? this.parseTimestamps(analysis) : undefined;

      // Extract usage metadata from raw result
      const rawResult = result as any;
      const usageMetadata = rawResult.usageMetadata;

      // Build token usage from response metadata
      const tokenUsage: MultimodalTokenUsage | undefined = usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount ?? 0,
            outputTokens: usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata.totalTokenCount ?? 0,
            cachedContentTokens: usageMetadata.cachedContentTokenCount,
            modalityType: 'video',
          }
        : undefined;

      return {
        analysis,
        timestamps,
        fileRef: undefined, // YouTube URLs don't create file refs
        tokenUsage,
      };
    } catch (error) {
      throw new MultimodalError(
        `Failed to analyze YouTube video: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Validate YouTube URL format
   */
  private isValidYouTubeUrl(url: string): boolean {
    const youtubePatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
    ];
    return youtubePatterns.some((pattern) => pattern.test(url));
  }

  /**
   * Parse timestamps from timeline analysis output
   */
  private parseTimestamps(analysis: string): TimestampMarker[] {
    const timestamps: TimestampMarker[] = [];
    // Match patterns like [00:15], [1:30], [01:23:45]
    const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*[-–:]?\s*(.+?)(?=\[|\n\n|$)/g;

    for (const match of analysis.matchAll(timestampRegex)) {
      timestamps.push({
        timestamp: match[1],
        description: match[2].trim(),
      });
    }

    return timestamps;
  }

  /**
   * Extract specific timestamp content from video
   */
  async extractAtTimestamp(
    client: GeminiClientInstance,
    video: VideoInput,
    timestamp: string,
    query?: string,
  ): Promise<string> {
    const prompt = `Focus on the content at timestamp ${timestamp} in this video.
${query ? `\nQuestion: "${query}"` : '\nDescribe what is happening at this moment.'}`;

    if (video.youtubeUrl) {
      const genAI = client.getClient();
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: video.youtubeUrl, mimeType: 'video/*' } },
              { text: prompt },
            ],
          },
        ],
      });
      return result.text || '';
    }

    const fileRef = await this.fileStoreService.uploadFile({
      buffer: video.buffer,
      filePath: video.filePath,
      url: video.url,
      mimeType: video.mimeType,
      cacheKey: video.cacheKey,
    });

    const result = await client.generateFromFiles(prompt, [fileRef]);
    return result.text;
  }

  /**
   * Batch interpret multiple videos in a single API call
   * Always uses File API for video files (per design requirement)
   * Note: YouTube URLs are processed separately via native Gemini support
   */
  async batchInterpret(
    client: GeminiClientInstance,
    request: BatchVideoInterpretRequest,
  ): Promise<BatchVideoInterpretResultWithUsage> {
    const { videos, query, mode = 'general' } = request;

    if (!videos || videos.length === 0) {
      throw new MultimodalError(
        'At least one video is required',
        MultimodalErrorCode.INVALID_CONFIG,
        false,
      );
    }

    // Separate YouTube URLs from file-based videos
    const youtubeVideos: VideoInput[] = [];
    const fileVideos: VideoInput[] = [];

    for (const video of videos) {
      if (video.youtubeUrl) {
        youtubeVideos.push(video);
      } else if (video.buffer || video.filePath || video.url) {
        // Check file size
        if (video.buffer && video.buffer.length > MAX_FILE_SIZE) {
          throw new MultimodalError(
            `Video ${video.name || 'unknown'} exceeds 2GB limit. Please compress or trim the video.`,
            MultimodalErrorCode.FILE_TOO_LARGE,
            false,
            {
              maxSize: '2GB',
              actualSize: `${(video.buffer.length / (1024 * 1024 * 1024)).toFixed(2)}GB`,
            },
          );
        }
        fileVideos.push(video);
      } else {
        throw new MultimodalError(
          'Each video must have buffer, filePath, url, or youtubeUrl',
          MultimodalErrorCode.INVALID_CONFIG,
          false,
        );
      }
    }

    const fileRefs: GeminiFileRef[] = [];
    const videoNames: (string | undefined)[] = [];

    // Upload all file-based videos to File API (always use File API for videos)
    for (const video of fileVideos) {
      videoNames.push(video.name);
      try {
        const fileRef = await this.fileStoreService.uploadFile({
          buffer: video.buffer,
          filePath: video.filePath,
          url: video.url,
          mimeType: video.mimeType,
          name: video.name,
          cacheKey: video.cacheKey,
        });
        fileRefs.push(fileRef);
      } catch (error) {
        if (error instanceof MultimodalError) {
          throw error;
        }
        throw new MultimodalError(
          `Failed to upload video ${video.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
          MultimodalErrorCode.UPLOAD_FAILED,
          true,
        );
      }
    }

    // Add YouTube video names
    for (const video of youtubeVideos) {
      videoNames.push(video.name || video.youtubeUrl);
    }

    // Build batch analysis prompt
    const prompt = this.buildBatchPrompt(videos.length, query, mode, videoNames);

    // Generate analysis
    try {
      let analysis: string;
      let tokenUsage: MultimodalTokenUsage | undefined;

      if (youtubeVideos.length > 0 && fileRefs.length > 0) {
        // Mixed mode: combine file refs and YouTube URLs
        // For mixed content, we need to use the raw API
        const genAI = client.getClient();
        const parts: Array<{ fileData: { fileUri: string; mimeType: string } } | { text: string }> =
          [];

        // Add file refs
        for (const fileRef of fileRefs) {
          parts.push({ fileData: { fileUri: fileRef.uri, mimeType: fileRef.mimeType } });
        }

        // Add YouTube URLs
        for (const video of youtubeVideos) {
          parts.push({ fileData: { fileUri: video.youtubeUrl!, mimeType: 'video/*' } });
        }

        // Add prompt
        parts.push({ text: prompt });

        const result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts }],
        });
        analysis = result.text || '';

        // Extract usage metadata from raw result
        const rawResult = result as any;
        const usageMetadata = rawResult.usageMetadata;
        if (usageMetadata) {
          tokenUsage = {
            promptTokens: usageMetadata.promptTokenCount ?? 0,
            outputTokens: usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata.totalTokenCount ?? 0,
            cachedContentTokens: usageMetadata.cachedContentTokenCount,
            modalityType: 'video',
          };
        }
      } else if (youtubeVideos.length > 0) {
        // All YouTube URLs
        const genAI = client.getClient();
        const parts: Array<{ fileData: { fileUri: string; mimeType: string } } | { text: string }> =
          [];

        for (const video of youtubeVideos) {
          parts.push({ fileData: { fileUri: video.youtubeUrl!, mimeType: 'video/*' } });
        }
        parts.push({ text: prompt });

        const result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts }],
        });
        analysis = result.text || '';

        // Extract usage metadata from raw result
        const rawResult = result as any;
        const usageMetadata = rawResult.usageMetadata;
        if (usageMetadata) {
          tokenUsage = {
            promptTokens: usageMetadata.promptTokenCount ?? 0,
            outputTokens: usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata.totalTokenCount ?? 0,
            cachedContentTokens: usageMetadata.cachedContentTokenCount,
            modalityType: 'video',
          };
        }
      } else {
        // All file-based videos
        const result = await client.generateFromFiles(prompt, fileRefs);
        analysis = result.text;

        // Build token usage from response metadata
        if (result.usageMetadata) {
          tokenUsage = {
            promptTokens: result.usageMetadata.promptTokenCount,
            outputTokens: result.usageMetadata.candidatesTokenCount,
            totalTokens: result.usageMetadata.totalTokenCount,
            cachedContentTokens: result.usageMetadata.cachedContentTokenCount,
            modalityType: 'video',
          };
        }
      }

      // Parse timestamps if in timeline mode
      const timestamps = mode === 'timeline' ? this.parseTimestamps(analysis) : undefined;

      return {
        analysis,
        fileRefs,
        individualResults: timestamps
          ? [{ name: 'Combined Analysis', analysis, timestamps }]
          : undefined,
        tokenUsage,
      };
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to analyze videos: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Build prompt for batch video analysis
   */
  private buildBatchPrompt(
    videoCount: number,
    query: string | undefined,
    mode: 'general' | 'transcript' | 'timeline',
    videoNames: (string | undefined)[],
  ): string {
    const videoList = videoNames
      .map((name, i) => `${i + 1}. ${name || `Video ${i + 1}`}`)
      .join('\n');

    const basePrompt = buildVideoAnalysisPrompt({ query, mode });

    return `You are analyzing ${videoCount} video${videoCount > 1 ? 's' : ''}.

## Videos
${videoList}

${basePrompt}

Provide a unified analysis covering all videos. When referencing specific content, indicate which video it comes from.`;
  }
}
