/**
 * ImageInterpreterService - Converts images to structured text descriptions
 *
 * Features:
 * - Image compression to < 5MB using Sharp
 * - Smart API selection: inline base64 for < 20MB total, File API for larger batches
 * - AI-readable optimization (normalize, sharpen)
 */

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { GeminiClientInstance } from './client.service';
import { GeminiFileStoreService } from './file-store.service';
import { buildInterpretationPrompt } from './prompts';
import type {
  InterpretRequest,
  GeminiFileRef,
  ImageInput,
  InlineData,
  InterpretResultWithUsage,
  MultimodalTokenUsage,
} from './types';
import { MultimodalError, MultimodalErrorCode } from './types';
import { compressImageForAI, type CompressResult, shouldUseFileApi } from '../../utils/image';

/** Size threshold for switching from inline base64 to File API (20MB) */
const FILE_API_THRESHOLD = 20 * 1024 * 1024;

/** Compressed image with metadata */
interface CompressedImage {
  result: CompressResult;
  originalInput: ImageInput;
}

/**
 * Service for interpreting images using Gemini multimodal API
 *
 * Features:
 * - Automatic image compression (< 5MB per image)
 * - Smart API selection: inline base64 for < 20MB total, File API for larger
 */
@Injectable()
export class ImageInterpreterService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly fileStoreService: GeminiFileStoreService,
  ) {
    this.logger.setContext(ImageInterpreterService.name);
  }

  /**
   * Interpret images and return structured text descriptions with token usage
   * Uses a pre-created client instance
   *
   * Smart API selection:
   * - Total size < 20MB: Use inline base64 (faster, no upload overhead)
   * - Total size >= 20MB: Use File API (for larger batches)
   */
  async interpret(
    client: GeminiClientInstance,
    request: InterpretRequest,
  ): Promise<InterpretResultWithUsage> {
    const { images, query, maxChars } = request;

    if (!images || images.length === 0) {
      return { interpretations: [], fileRefs: [] };
    }

    // Step 1: Compress all images in parallel
    const compressedImages = await this.compressImages(images);
    // Step 2: Calculate total size and decide API strategy
    const useFileApi = shouldUseFileApi(
      compressedImages.map((c) => c.result),
      FILE_API_THRESHOLD,
    );

    const prompt = buildInterpretationPrompt({
      query,
      maxChars,
      imageCount: compressedImages.length,
    });

    try {
      if (useFileApi) {
        // Use File API for larger batches (>= 20MB total)
        return await this.interpretWithFileApi(client, prompt, compressedImages);
      } else {
        // Use inline base64 for smaller batches (< 20MB total)
        return await this.interpretWithInlineData(client, prompt, compressedImages);
      }
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to interpret images: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Compress all images for AI processing
   */
  private async compressImages(images: ImageInput[]): Promise<CompressedImage[]> {
    const results: CompressedImage[] = [];

    for (const image of images) {
      try {
        // Get input buffer or file path
        const input = image.buffer || image.filePath;
        if (!input) {
          throw new MultimodalError(
            'Image must have buffer or filePath',
            MultimodalErrorCode.INVALID_CONFIG,
            false,
          );
        }

        const result = await compressImageForAI(input, image.mimeType, {
          mode: 'ai-readable',
          maxSizeBytes: 5 * 1024 * 1024, // 5MB per image
        });

        this.logger.debug(
          `Compressed image: ${(result.originalSize / 1024 / 1024).toFixed(2)}MB -> ` +
            `${(result.compressedSize / 1024 / 1024).toFixed(2)}MB ` +
            `(${result.wasCompressed ? 'compressed' : 'skipped'})`,
        );

        results.push({ result, originalInput: image });
      } catch (error) {
        if (error instanceof MultimodalError) {
          throw error;
        }
        throw new MultimodalError(
          `Failed to compress image: ${error instanceof Error ? error.message : String(error)}`,
          MultimodalErrorCode.UPLOAD_FAILED,
          true,
        );
      }
    }

    return results;
  }

  /**
   * Interpret images using inline base64 data (for total size < 20MB)
   */
  private async interpretWithInlineData(
    client: GeminiClientInstance,
    prompt: string,
    compressedImages: CompressedImage[],
  ): Promise<InterpretResultWithUsage> {
    // Convert to inline data format
    const inlineData: InlineData[] = compressedImages.map((img) => ({
      mimeType: img.result.mimeType,
      data: img.result.buffer.toString('base64'),
    }));

    const result = await client.generateFromInlineData(prompt, inlineData);

    // Build token usage from response metadata
    const tokenUsage: MultimodalTokenUsage | undefined = result.usageMetadata
      ? {
          promptTokens: result.usageMetadata.promptTokenCount,
          outputTokens: result.usageMetadata.candidatesTokenCount,
          totalTokens: result.usageMetadata.totalTokenCount,
          cachedContentTokens: result.usageMetadata.cachedContentTokenCount,
          modalityType: 'image',
        }
      : undefined;

    return {
      interpretations: [result.text],
      fileRefs: [], // No file refs when using inline data
      tokenUsage,
    };
  }

  /**
   * Interpret images using File API (for total size >= 20MB)
   */
  private async interpretWithFileApi(
    client: GeminiClientInstance,
    prompt: string,
    compressedImages: CompressedImage[],
  ): Promise<InterpretResultWithUsage> {
    const fileRefs: GeminiFileRef[] = [];

    // Upload all compressed images to Gemini File API
    for (const img of compressedImages) {
      // Create ImageInput from compressed result
      const imageInput: ImageInput = {
        buffer: img.result.buffer,
        mimeType: img.result.mimeType,
        name: img.originalInput.name,
        cacheKey: img.originalInput.cacheKey,
      };

      const ref = await this.fileStoreService.uploadFile(imageInput);
      fileRefs.push(ref);
    }

    const result = await client.generateFromFiles(prompt, fileRefs);

    // Build token usage from response metadata
    const tokenUsage: MultimodalTokenUsage | undefined = result.usageMetadata
      ? {
          promptTokens: result.usageMetadata.promptTokenCount,
          outputTokens: result.usageMetadata.candidatesTokenCount,
          totalTokens: result.usageMetadata.totalTokenCount,
          cachedContentTokens: result.usageMetadata.cachedContentTokenCount,
          modalityType: 'image',
        }
      : undefined;

    return {
      interpretations: [result.text],
      fileRefs,
      tokenUsage,
    };
  }

  /**
   * Interpret a single image with optional context
   */
  async interpretOne(
    client: GeminiClientInstance,
    image: ImageInput,
    options?: { query?: string },
  ): Promise<string> {
    const result = await this.interpret(client, {
      images: [image],
      query: options?.query,
    });

    return result.interpretations[0] || '';
  }

  /**
   * Batch interpret multiple images separately
   * Returns individual interpretations for each image with aggregated token usage
   * Uses inline base64 since each image is processed individually
   */
  async interpretBatch(
    client: GeminiClientInstance,
    images: ImageInput[],
    options?: { query?: string; maxCharsPerImage?: number },
  ): Promise<{
    interpretations: string[];
    fileRefs: GeminiFileRef[];
    tokenUsage?: MultimodalTokenUsage;
  }> {
    const interpretations: string[] = [];
    let totalPromptTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;

    for (const image of images) {
      // Compress the image
      const input = image.buffer || image.filePath;
      if (!input) {
        throw new MultimodalError(
          'Image must have buffer or filePath',
          MultimodalErrorCode.INVALID_CONFIG,
          false,
        );
      }

      const compressed = await compressImageForAI(input, image.mimeType, {
        mode: 'ai-readable',
        maxSizeBytes: 5 * 1024 * 1024,
      });

      // Build single-image prompt
      const prompt = buildInterpretationPrompt({
        query: options?.query,
        maxChars: options?.maxCharsPerImage ?? 2000,
        imageCount: 1,
      });

      // Use inline base64 for single image (always < 5MB after compression)
      const inlineData: InlineData[] = [
        {
          mimeType: compressed.mimeType,
          data: compressed.buffer.toString('base64'),
        },
      ];

      const result = await client.generateFromInlineData(prompt, inlineData);
      interpretations.push(result.text);

      // Aggregate token usage
      if (result.usageMetadata) {
        totalPromptTokens += result.usageMetadata.promptTokenCount;
        totalOutputTokens += result.usageMetadata.candidatesTokenCount;
        totalTokens += result.usageMetadata.totalTokenCount;
      }
    }

    // Build aggregated token usage
    const tokenUsage: MultimodalTokenUsage | undefined =
      totalTokens > 0
        ? {
            promptTokens: totalPromptTokens,
            outputTokens: totalOutputTokens,
            totalTokens,
            modalityType: 'image',
          }
        : undefined;

    // No file refs when using inline data
    return { interpretations, fileRefs: [], tokenUsage };
  }
}
