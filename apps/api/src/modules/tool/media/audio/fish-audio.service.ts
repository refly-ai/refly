import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FishAudioSpeechToTextRequest,
  FishAudioSpeechToTextResponse,
  FishAudioTextToSpeechRequest,
  FishAudioTextToSpeechResponse,
  User,
} from '@refly/openapi-schema';

import { Queue } from 'bullmq';
import { getAudioDurationInSeconds } from 'get-audio-duration';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildResponse } from '../../../../utils';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../../../utils/const';
import { PrismaService } from '../../../common/prisma.service';
import { SyncToolCreditUsageJobData } from '../../../credit/credit.dto';
import { MiscService } from '../../../misc/misc.service';
import { MEDIA_TYPES } from '../../common/constant/media-types';
import { ToolExecutionSync } from '../../common/decorators/tool-execution-sync.decorator';
import {
  type ToolExecutionResult,
  ToolExecutionSyncInterceptor,
} from '../../common/interceptors/tool-execution-sync.interceptor';
import type { FishAudioClient, ReferenceAudio, STTRequest, TTSRequest } from './fish-audio.cjs';
import { loadFishAudio } from './fish-audio.cjs';

/**
 * Fish Audio Service
 * Using official Fish Audio SDK: https://docs.fish.audio/sdk-reference/javascript
 */
@Injectable()
export class FishAudioService implements OnModuleInit {
  private readonly logger = new Logger(FishAudioService.name);
  private fishAudioClient: FishAudioClient;
  private fishAudioModule: Awaited<ReturnType<typeof loadFishAudio>>;

  // Timeout configurations for audio generation (in milliseconds)
  private readonly timeoutConfig = {
    audio: 15 * 60 * 1000, // 15 minutes for audio
  };

  // Polling interval (in milliseconds)
  private readonly pollInterval = 2000; // 2 seconds

  // Credit costs: Fish Audio pricing
  // TTS: $0.10 per minute * 140 credits per USD = 14 credits per minute
  // STT: $0.006 per minute * 140 credits per USD = 0.84 credits per minute
  private readonly TTS_CREDIT_PER_MINUTE = 14;
  private readonly STT_CREDIT_PER_MINUTE = 1; // Rounded up from 0.84 for simplicity

  constructor(
    private readonly config: ConfigService,
    private readonly miscService: MiscService,
    private readonly prismaService: PrismaService,
    private readonly toolExecutionSync: ToolExecutionSyncInterceptor,
    @Optional()
    @InjectQueue(QUEUE_SYNC_TOOL_CREDIT_USAGE)
    private readonly toolCreditUsageQueue?: Queue<SyncToolCreditUsageJobData>,
  ) {}

  /**
   * NestJS lifecycle hook - called after module initialization
   * This ensures SDK is loaded before the service is used
   */
  async onModuleInit() {
    await this.initializeFishAudio();
  }

  private async initializeFishAudio() {
    const apiKey = this.config.get<string>('audio.fish.apiKey');
    if (!apiKey) {
      const message =
        'FISH_AUDIO_API_KEY is not configured. Set the environment variable to enable Fish Audio integration.';
      this.logger.error(message);
      return;
    }

    try {
      this.fishAudioModule = await loadFishAudio();
      this.fishAudioClient = new this.fishAudioModule.FishAudioClient({ apiKey });
    } catch (error) {
      this.logger.error(`❌ Failed to load Fish Audio SDK: ${(error as Error).message}`);
      throw error; // Re-throw to make initialization failure visible
    }
  }

  /**
   * Convert Buffer to File object for SDK
   */
  private bufferToFile(buffer: Buffer, filename: string, mimeType: string): File {
    // Convert Buffer to Uint8Array for Blob
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
  }

  /**
   * Process reference audio file for voice cloning
   * Converts uploaded audio file (storageKey) to ReferenceAudio format required by SDK
   */
  private async processReferenceAudio(
    user: User,
    reference: { entityId: string; text?: string },
  ): Promise<ReferenceAudio> {
    let audioFile: File;
    try {
      // Step 1: Get file metadata from database
      const file = await this.prismaService.staticFile.findFirst({
        where: { entityId: reference.entityId, deletedAt: null },
      });

      if (!file) {
        throw new Error(`File not found for storageKey: ${reference.entityId}`);
      }

      // Step 2: Download audio file directly from storage (optimized - no HTTP round trip)
      const audioBuffer = await this.miscService.downloadFile({
        storageKey: file.storageKey,
        visibility: file.visibility as 'public' | 'private',
      });

      // Step 3: Get transcript text
      let transcriptText = reference.text;
      if (!transcriptText) {
        const sttResult = await this.speechToText(user, {
          entityId: file.entityId,
        });
        transcriptText = sttResult.data.text;
      }

      // Step 4: Convert Buffer to File object
      const extension = reference.entityId.split('.').pop()?.toLowerCase() || 'mp3';
      const mimeType = `audio/${extension}`;
      const filename = `reference_${Date.now()}.${extension}`;
      const audioFile = this.bufferToFile(audioBuffer, filename, mimeType);
      // Step 5: Return ReferenceAudio object
      return {
        audio: audioFile,
        text: transcriptText,
      };
    } catch (_error) {
      return {
        audio: audioFile,
        text: null,
      };
    }
  }

  /**
   * Calculate and charge credits for audio generation (TTS)
   * Credit cost: 14 credits per minute ($0.10/min * 140)
   */
  private async chargeTTSCredits(
    user: User | undefined,
    durationInSeconds: number | undefined,
    audioId: string,
  ): Promise<void> {
    // Skip charging if user is not provided
    if (!user) {
      this.logger.warn(`Skipping TTS credit charge for audio ${audioId}: missing user`);
      return;
    }

    // Skip charging if queue is not available
    if (!this.toolCreditUsageQueue) {
      this.logger.warn(
        `Skipping TTS credit charge for audio ${audioId}: toolCreditUsageQueue not available`,
      );
      return;
    }

    // Default to 0 if duration is not available
    const duration = durationInSeconds || 0;

    // Calculate credit cost: convert seconds to minutes and multiply by cost per minute
    const durationInMinutes = duration / 60;
    const usdCost = durationInMinutes * 0.1;
    const creditCost = Math.ceil(usdCost * 140);

    this.logger.log(
      `Charging ${creditCost} credits for TTS audio ${audioId} (${duration}s = ${durationInMinutes.toFixed(2)} minutes) for user ${user.uid}`,
    );

    // Find the most recent actionResult for this user with type 'audio'
    const actionResult = await this.prismaService.actionResult.findFirst({
      where: {
        uid: user.uid,
        type: MEDIA_TYPES.AUDIO,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        resultId: true,
      },
    });

    if (!actionResult) {
      this.logger.warn(`Skipping TTS credit charge for audio ${audioId}: no actionResult found`);
      return;
    }

    // Queue credit usage job for async processing
    const jobData: SyncToolCreditUsageJobData = {
      uid: user.uid,
      creditCost,
      timestamp: new Date(),
      resultId: actionResult.resultId,
      toolsetName: 'Fish Audio',
      toolName: 'text-to-speech',
    };

    try {
      await this.toolCreditUsageQueue.add(`fish_audio_tts_credit:${user.uid}:${audioId}`, jobData);
    } catch (error) {
      this.logger.error(
        `Failed to queue TTS credit charge for audio ${audioId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Calculate and charge credits for speech transcription (STT)
   * Credit cost: 1 credit per minute ($0.006/min * 140, rounded up)
   */
  private async chargeSTTCredits(
    user: User | undefined,
    durationInSeconds: number | undefined,
    audioId: string,
  ): Promise<void> {
    // Skip charging if user is not provided
    if (!user) {
      this.logger.warn(`Skipping STT credit charge for audio ${audioId}: missing user`);
      return;
    }

    // Skip charging if queue is not available
    if (!this.toolCreditUsageQueue) {
      this.logger.warn(
        `Skipping STT credit charge for audio ${audioId}: toolCreditUsageQueue not available`,
      );
      return;
    }

    // Default to 0 if duration is not available
    const duration = durationInSeconds || 0;

    // Calculate credit cost: convert seconds to minutes and multiply by cost per minute
    const durationInMinutes = duration / 60;
    const usdCost = durationInMinutes * 0.006;
    const creditCost = Math.ceil(usdCost * 140);

    this.logger.log(
      `Charging ${creditCost} credits for STT audio ${audioId} (${duration}s = ${durationInMinutes.toFixed(2)} minutes) for user ${user.uid}`,
    );

    // Find the most recent actionResult for this user with type 'doc' (STT result type)
    const actionResult = await this.prismaService.actionResult.findFirst({
      where: {
        uid: user.uid,
        type: MEDIA_TYPES.DOC,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        resultId: true,
      },
    });

    if (!actionResult) {
      this.logger.warn(`Skipping STT credit charge for audio ${audioId}: no actionResult found`);
      return;
    }

    // Queue credit usage job for async processing
    const jobData: SyncToolCreditUsageJobData = {
      uid: user.uid,
      creditCost,
      timestamp: new Date(),
      resultId: actionResult.resultId,
      toolsetName: 'Fish Audio',
      toolName: 'speech-to-text',
    };

    try {
      await this.toolCreditUsageQueue.add(`fish_audio_stt_credit:${user.uid}:${audioId}`, jobData);
      this.logger.log(`✅ STT credit charge queued successfully for audio ${audioId}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue STT credit charge for audio ${audioId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Convert text to speech using Fish Audio SDK with automatic workflow sync
   * Uses @ToolExecutionSync decorator to handle all boilerplate logic:
   * - ActionResult creation and status management
   * - Workflow node execution tracking
   * - Canvas node creation and connection
   * - Parent-child relationship handling
   */
  /**
   * Public API method that returns FishAudioTextToSpeechResponse for backward compatibility
   */
  async textToSpeech(
    user: User,
    request: FishAudioTextToSpeechRequest,
  ): Promise<FishAudioTextToSpeechResponse> {
    // Call the decorated method which returns ToolExecutionResult
    const result = await this.textToSpeechInternal(user, request);

    // Convert ToolExecutionResult to FishAudioTextToSpeechResponse
    if (result.status === 'success') {
      return buildResponse<FishAudioTextToSpeechResponse>(true, {
        data: {
          audioUrl: result.data?.outputUrl || '',
          storageKey: result.data?.storageKey || '',
          entityId: result.data?.entityId || '',
          duration: result.data?.duration || 0,
          format: result.data?.format || 'mp3',
          size: result.data?.size || 0,
        },
      });
    } else {
      return buildResponse<FishAudioTextToSpeechResponse>(false, null, result.errors?.[0]);
    }
  }

  /**
   * Internal text-to-speech implementation with @ToolExecutionSync decorator
   * Uses @ToolExecutionSync decorator to handle all boilerplate logic:
   * - ActionResult creation and status management
   * - Workflow node execution tracking
   * - Canvas node creation and connection
   * - Parent-child relationship handling
   */
  @ToolExecutionSync({
    resultType: MEDIA_TYPES.AUDIO,
    getParentResultId: (req) => req.parentResultId,
    getTitle: (req) => req.prompt || req.text || 'fish-audio-text-to-speech',
    getModel: (req) => req.model,
    getProviderItemId: (req) => req.providerItemId,
    createCanvasNode: true,
    updateWorkflowNode: true,
    getMetadata: (_req, result) => ({
      duration: result.data?.duration,
      format: result.data?.format,
      size: result.data?.size,
    }),
  })
  private async textToSpeechInternal(
    user: User,
    request: FishAudioTextToSpeechRequest,
  ): Promise<ToolExecutionResult> {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Process reference audio files if provided
        let processedReferences: ReferenceAudio[] | undefined;
        if (request.references && request.references.length > 0) {
          processedReferences = await Promise.all(
            request.references.map((ref) => this.processReferenceAudio(user, ref)),
          );
          if (processedReferences.every((ref) => ref.text === null)) {
            return {
              status: 'error',
              errors: [{ code: 'PARAMS_ERROR', message: 'Invalid reference audio parameters' }],
            };
          }
        }

        // Build SDK request with proper TTSRequest type
        // Use 'text' if provided, otherwise fall back to 'prompt' from MediaGenerateRequest
        const textToConvert = request.text || request.prompt;
        const sdkRequest: TTSRequest = {
          text: textToConvert,
          format: request.format ?? 'mp3',
          ...(request.referenceId && { reference_id: request.referenceId }),
          ...(request.chunkLength != null && { chunk_length: request.chunkLength }),
          ...(request.normalize != null && { normalize: request.normalize }),
          ...(request.topP != null && { top_p: request.topP }),
          ...(request.mp3Bitrate != null && { mp3_bitrate: request.mp3Bitrate }),
          ...(request.sampleRate != null && { sample_rate: request.sampleRate }),
          ...(processedReferences?.length && { references: processedReferences }),
        };

        // Generate speech using SDK
        const audioStream = await this.fishAudioClient.textToSpeech.convert(sdkRequest);
        const audioBuffer = await this.streamToBuffer(audioStream);

        // Determine file extension and metadata
        const format = request.format || 'mp3';
        const extension = format === 'pcm' ? 'raw' : format;

        // Calculate actual audio duration by parsing the audio file
        let duration = 0;
        let tempFilePath: string | null = null;
        try {
          // Write buffer to temporary file for audio duration calculation
          tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.${extension}`);
          await fs.writeFile(tempFilePath, audioBuffer);
          duration = Math.round(await getAudioDurationInSeconds(tempFilePath));
        } catch (error) {
          // Fallback: estimate based on buffer size (only for PCM format)
          if (format === 'pcm') {
            duration = Math.round(audioBuffer.length / (request.sampleRate ?? 16000) / 2);
          } else {
            this.logger.warn(`Failed to get audio duration: ${(error as Error).message}`);
          }
        } finally {
          // Clean up temporary file
          if (tempFilePath) {
            try {
              await fs.unlink(tempFilePath);
            } catch (error) {
              this.logger.warn(
                `Failed to delete temp file ${tempFilePath}: ${(error as Error).message}`,
              );
            }
          }
        }

        // Charge credits after successful audio generation
        await this.chargeTTSCredits(user, duration, `tts-${Date.now()}`);

        // Return ToolExecutionResult format with buffer
        // The interceptor will handle upload and generate entityId/entityType
        return {
          status: 'success',
          data: {
            buffer: audioBuffer,
            filename: `audio.${extension}`,
            mimetype: `audio/${format === 'pcm' ? 'raw' : format}`,
            duration,
            format,
            size: audioBuffer.length,
          },
        };
      } catch (error) {
        lastError = error as Error;
        const errorWithStatus = error as { status?: number; response?: { status?: number } };
        const status = errorWithStatus?.status || errorWithStatus?.response?.status;

        // Don't retry on certain errors
        if (status === 401 || status === 400) {
          return {
            status: 'error',
            errors: [
              {
                code: status === 401 ? 'UNAUTHORIZED' : 'BAD_REQUEST',
                message: lastError?.message || 'Request failed',
              },
            ],
          };
        }

        // Retry on rate limit or other errors
        if (attempt === maxRetries - 1) {
          return {
            status: 'error',
            errors: [
              {
                code: status === 429 ? 'RATE_LIMIT_ERROR' : 'TTS_GENERATION_FAILED',
                message: lastError?.message || 'Failed to generate speech after maximum retries',
              },
            ],
          };
        }
      }
    }

    // Return error response for graceful workflow handling
    return {
      status: 'error',
      errors: [
        {
          code: 'TTS_GENERATION_FAILED',
          message: lastError?.message || 'Failed to generate speech after maximum retries',
        },
      ],
    };
  }

  /**
   * Convert speech to text using Fish Audio SDK with automatic workflow sync
   * Uses @ToolExecutionSync decorator to handle all boilerplate logic:
   * - ActionResult creation and status management
   * - Workflow node execution tracking
   * - Canvas node creation and connection
   * - Parent-child relationship handling
   */
  /**
   * Public API method that returns FishAudioSpeechToTextResponse for backward compatibility
   */
  async speechToText(
    user: User,
    request: FishAudioSpeechToTextRequest,
  ): Promise<FishAudioSpeechToTextResponse> {
    // Call the decorated method which returns ToolExecutionResult
    const result = await this.speechToTextInternal(user, request);

    // Convert ToolExecutionResult to FishAudioSpeechToTextResponse
    if (result.status === 'success') {
      return buildResponse<FishAudioSpeechToTextResponse>(true, {
        data: {
          text: result.data?.text || '',
          duration: result.data?.duration || 0,
          segments: result.data?.segments || [],
        },
      });
    } else {
      return buildResponse<FishAudioSpeechToTextResponse>(false, null, result.errors?.[0]);
    }
  }

  /**
   * Internal speech-to-text implementation with @ToolExecutionSync decorator
   */
  @ToolExecutionSync({
    resultType: MEDIA_TYPES.DOC,
    getParentResultId: (req) => req.parentResultId,
    getTitle: (_req) => 'fish-audio-speech-to-text',
    getModel: (req) => req.model,
    getProviderItemId: (req) => req.providerItemId,
    createCanvasNode: true,
    updateWorkflowNode: true,
    getMetadata: (_req, result) => ({
      text: result.data?.text,
      duration: result.data?.duration,
      segments: result.data?.segments,
    }),
  })
  private async speechToTextInternal(
    user: User,
    request: FishAudioSpeechToTextRequest,
  ): Promise<ToolExecutionResult> {
    try {
      // Step 1: Get file metadata from database
      const file = await this.prismaService.staticFile.findFirst({
        where: { entityId: request.entityId, deletedAt: null },
      });

      if (!file) {
        return {
          status: 'error',
          errors: [
            {
              code: 'FILE_NOT_FOUND',
              message: `File not found for entityId: ${request.entityId}`,
            },
          ],
        };
      }

      // Step 2: Download audio file directly from storage (optimized - no HTTP round trip)
      const audioBuffer = await this.miscService.downloadFile({
        storageKey: file.storageKey,
        visibility: file.visibility as 'public' | 'private',
      });

      // Step 3: Determine MIME type from file extension
      const extension = file.storageKey.split('.').pop()?.toLowerCase() || 'mp3';
      const mimeType = `audio/${extension}`;
      const filename = `audio.${extension}`;

      // Step 4: Convert buffer to File object for SDK
      const audioFile = this.bufferToFile(audioBuffer, filename, mimeType);

      // Step 5: Build SDK request with proper STTRequest type
      const sdkRequest: STTRequest = {
        audio: audioFile,
        language: request.language,
        ignore_timestamps: request.ignoreTimestamps,
      };

      // Step 6: Transcribe using SDK
      const result = await this.fishAudioClient.speechToText.convert(sdkRequest);

      // Charge credits after successful transcription
      await this.chargeSTTCredits(user, result.duration, request.entityId);

      return {
        status: 'success',
        data: {
          text: result.text,
          duration: result.duration,
          segments: result.segments || [],
        },
      };
    } catch (error) {
      const errorWithStatus = error as { status?: number; response?: { status?: number } };
      const status = errorWithStatus?.status || errorWithStatus?.response?.status;

      if (status === 413) {
        return {
          status: 'error',
          errors: [
            {
              code: '413',
              message: 'Audio file too large. Maximum size is 100MB.',
            },
          ],
        };
      } else if (status === 400) {
        this.logger.error(`Invalid audio format: ${(error as Error).message}`);
        return {
          status: 'error',
          errors: [
            {
              code: '400',
              message: (error as Error).message,
            },
          ],
        };
      }
      this.logger.error(
        `Failed to transcribe speech: ${(error as Error).message} for user ${user.uid}`,
        (error as Error).stack,
      );

      return {
        status: 'error',
        errors: [
          {
            code: 'STT_TRANSCRIPTION_FAILED',
            message: (error as Error).message || 'Failed to transcribe speech',
          },
        ],
      };
    }
  }

  /**
   * Helper method to convert stream to buffer
   */
  private async streamToBuffer(stream: ReadableStream): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }
}
