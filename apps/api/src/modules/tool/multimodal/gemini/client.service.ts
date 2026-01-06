/**
 * GeminiClientService - Service for creating and managing Gemini client
 * Pure client management - no file operations
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import type { GeminiFileRef, InlineData } from './types';
import { MultimodalError, MultimodalErrorCode } from './types';

/** Default model for multimodal operations */
const DEFAULT_MODEL = 'gemini-3-flash-preview';

/** Maximum retry attempts for transient errors */
const MAX_RETRIES = 3;

/** Initial retry delay in milliseconds */
const INITIAL_RETRY_DELAY = 1000;

/**
 * Result with token usage metadata from Gemini API
 */
export interface GenerateResultWithUsage {
  text: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    cachedContentTokenCount?: number;
  };
}

/**
 * Wrapper class for a configured Gemini client instance
 * Pure client operations - no file dependencies
 */
export class GeminiClientInstance {
  private modelId: string;

  constructor(private client: GoogleGenAI) {
    this.modelId = DEFAULT_MODEL;
  }

  /**
   * Get the underlying GoogleGenAI client
   */
  getClient(): GoogleGenAI {
    return this.client;
  }

  /**
   * Generate content from already-uploaded file references
   * Uses createPartFromUri for proper File API integration
   * Returns text and usage metadata for token tracking
   */
  async generateFromFiles(
    prompt: string,
    fileRefs: GeminiFileRef[],
  ): Promise<GenerateResultWithUsage> {
    return this.executeWithRetry(async () => {
      // Build content parts: text first, then file references
      const parts: Array<string | ReturnType<typeof createPartFromUri>> = [prompt];

      // Add file references using createPartFromUri
      for (const fileRef of fileRefs) {
        parts.push(createPartFromUri(fileRef.uri, fileRef.mimeType));
      }

      const result = await this.client.models.generateContent({
        model: this.modelId,
        contents: createUserContent(parts),
      });

      if (!result.text) {
        throw new MultimodalError(
          'Empty response from Gemini',
          MultimodalErrorCode.GENERATION_FAILED,
          true,
        );
      }

      // Extract usage metadata from response
      const rawResult = result as any;
      const usageMetadata = rawResult.usageMetadata;

      return {
        text: result.text,
        usageMetadata: usageMetadata
          ? {
              promptTokenCount: usageMetadata.promptTokenCount ?? 0,
              candidatesTokenCount: usageMetadata.candidatesTokenCount ?? 0,
              totalTokenCount: usageMetadata.totalTokenCount ?? 0,
              cachedContentTokenCount: usageMetadata.cachedContentTokenCount,
            }
          : undefined,
      };
    });
  }

  /**
   * Generate content from inline base64-encoded data
   * Best for files < 20MB
   * Returns text and usage metadata for token tracking
   */
  async generateFromInlineData(
    prompt: string,
    inlineData: InlineData[],
  ): Promise<GenerateResultWithUsage> {
    return this.executeWithRetry(async () => {
      // Build content with inline data parts
      const contents = [
        {
          role: 'user' as const,
          parts: [
            { text: prompt },
            ...inlineData.map((data) => ({
              inlineData: {
                mimeType: data.mimeType,
                data: data.data,
              },
            })),
          ],
        },
      ];

      const result = await this.client.models.generateContent({
        model: this.modelId,
        contents,
      });

      if (!result.text) {
        throw new MultimodalError(
          'Empty response from Gemini',
          MultimodalErrorCode.GENERATION_FAILED,
          true,
        );
      }

      // Extract usage metadata from response
      const rawResult = result as any;
      const usageMetadata = rawResult.usageMetadata;

      return {
        text: result.text,
        usageMetadata: usageMetadata
          ? {
              promptTokenCount: usageMetadata.promptTokenCount ?? 0,
              candidatesTokenCount: usageMetadata.candidatesTokenCount ?? 0,
              totalTokenCount: usageMetadata.totalTokenCount ?? 0,
              cachedContentTokenCount: usageMetadata.cachedContentTokenCount,
            }
          : undefined,
      };
    });
  }

  /**
   * Execute an operation with retry logic for transient errors
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let delay = INITIAL_RETRY_DELAY;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryableError(error) || attempt === MAX_RETRIES) {
          break;
        }

        await this.sleep(delay);
        delay = Math.min(delay * 2, 10000);
      }
    }

    if (lastError instanceof MultimodalError) {
      throw lastError;
    }

    if (this.isRateLimitError(lastError)) {
      throw new MultimodalError(
        'Rate limit exceeded after retries',
        MultimodalErrorCode.RATE_LIMITED,
        false,
        { originalError: lastError?.message },
      );
    }

    throw new MultimodalError(
      lastError?.message || 'Content generation failed',
      MultimodalErrorCode.GENERATION_FAILED,
      false,
      { originalError: lastError?.message },
    );
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof MultimodalError) {
      return error.retryable;
    }

    const message = error instanceof Error ? error.message : String(error);
    const retryablePatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'socket hang up',
      'ENOTFOUND',
      '503',
      '502',
      '500',
      'temporarily unavailable',
    ];

    return retryablePatterns.some((pattern) =>
      message.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  private isRateLimitError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('429') || message.toLowerCase().includes('rate limit');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Service for managing a singleton Gemini client instance
 * Initializes client on module startup
 */
@Injectable()
export class GeminiClientService implements OnModuleInit {
  private client!: GoogleGenAI;
  private instance!: GeminiClientInstance;

  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(GeminiClientService.name);
  }

  onModuleInit(): void {
    const apiKey =
      this.configService.get<string>('credentials.gemini') || process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
      this.instance = new GeminiClientInstance(this.client);
      this.logger.info('Gemini client initialized');
    } else {
      this.logger.warn('Gemini API key not configured');
    }
  }

  /**
   * Get the raw GoogleGenAI client
   */
  getRawClient(): GoogleGenAI {
    if (!this.client) {
      throw new MultimodalError(
        'Gemini client not initialized, check API key configuration',
        MultimodalErrorCode.NO_API_KEY,
        false,
      );
    }
    return this.client;
  }

  /**
   * Get the client instance wrapper
   */
  getClient(): GeminiClientInstance {
    if (!this.instance) {
      throw new MultimodalError(
        'Gemini client not initialized, check API key configuration',
        MultimodalErrorCode.NO_API_KEY,
        false,
      );
    }
    return this.instance;
  }

  /**
   * Check if client is available
   */
  isAvailable(): boolean {
    return !!this.client;
  }
}
