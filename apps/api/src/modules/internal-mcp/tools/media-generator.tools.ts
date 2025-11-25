import { Injectable, Logger } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import { Request } from 'express';
import { InternalMcpService } from '../internal-mcp.service';
import { User as UserModel } from '@prisma/client';
import { MediaGeneratorService } from '../../media-generator/media-generator.service';
import { ActionService } from '../../action/action.service';
import { ProviderService } from '../../provider/provider.service';
import { MediaGenerateRequest } from '@refly/openapi-schema';

@Injectable()
export class MediaGeneratorTools {
  private readonly logger = new Logger(MediaGeneratorTools.name);

  // Timeout configurations for different media types (in milliseconds)
  private readonly timeoutConfig = {
    image: 90 * 1000, // 90 seconds for images
    audio: 5 * 60 * 1000, // 5 minutes for audio
    video: 10 * 60 * 1000, // 10 minutes for video
  };

  // Polling interval (in milliseconds)
  private readonly pollInterval = 2000; // 2 seconds

  constructor(
    private readonly mediaGeneratorService: MediaGeneratorService,
    private readonly actionService: ActionService,
    private readonly internalMcpService: InternalMcpService,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Generate media with internal polling mechanism
   */
  @Tool({
    name: 'generate_media',
    description:
      'Generate multimedia content including images, videos, and audio. This tool supports all three media types: "image" for generating pictures and artwork, "video" for creating video clips and animations, and "audio" for generating music, sound effects, and voice content. The tool automatically handles the generation process with real-time progress updates until completion. For optimal results, consider using get_media_generation_models first to discover available models and their specific capabilities for your desired media type.',
    parameters: z.object({
      mediaType: z
        .enum(['image', 'audio', 'video'])
        .describe(
          'Type of media to generate: "image" for pictures/artwork, "video" for video clips/animations, "audio" for music/sounds/voice',
        ),
      prompt: z.string().describe('Detailed text prompt describing the media content to generate'),
      model: z
        .string()
        .optional()
        .describe(
          'Specific AI modelId to use for generation (optional - will auto-select based on media type if not provided). Use get_media_generation_models to discover available models and their capabilities for your desired media type.',
        ),
      provider: z
        .string()
        .optional()
        .describe(
          'Specific providerKey to use (optional - defaults to replicate). Use get_media_generation_models to see available providers for your desired media type.',
        ),
    }),
  })
  async generateMedia(
    params: {
      mediaType: 'image' | 'audio' | 'video';
      prompt: string;
      model?: string;
      provider?: string;
    },
    context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'generate_media' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      // Get user's configured media generation settings
      const userMediaConfig = await this.providerService.getUserMediaConfig(user, params.mediaType);

      if (!userMediaConfig) {
        return this.internalMcpService.formatErrorResponse(
          new Error(
            `No media generation model configured for ${params.mediaType}. Please configure a model first using the settings, or use get_media_generation_models to see available models and specify model and provider parameters.`,
          ),
        );
      }

      // Build media generation request
      const mediaRequest: MediaGenerateRequest = {
        mediaType: params.mediaType,
        prompt: params.prompt,
        model: userMediaConfig.model,
        providerItemId: userMediaConfig.providerItemId,
      };

      // Start media generation
      const generateResponse = await this.mediaGeneratorService.generate(user, mediaRequest);

      if (!generateResponse.resultId) {
        return this.internalMcpService.formatErrorResponse(
          new Error('Failed to start media generation'),
        );
      }

      const { resultId } = generateResponse;

      // Report initial progress
      await context.reportProgress({
        progress: 5,
        total: 100,
      });

      // Start polling with timeout
      const timeout = this.timeoutConfig[params.mediaType];
      const startTime = Date.now();

      this.logger.log(`Starting polling for ${params.mediaType} generation, timeout: ${timeout}ms`);

      while (Date.now() - startTime < timeout) {
        // Wait for polling interval
        await this.sleep(this.pollInterval);

        // Check status
        const actionResult = await this.actionService.getActionResult(user, { resultId });

        // Calculate progress based on elapsed time and media type
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(Math.floor((elapsed / timeout) * 90) + 5, 95);

        // Report progress
        await context.reportProgress({
          progress: estimatedProgress,
          total: 100,
        });

        // Check if completed
        if (actionResult.status === 'finish') {
          // Report completion
          await context.reportProgress({
            progress: 100,
            total: 100,
          });

          this.logger.log(`Media generation completed for ${resultId}`);

          return this.internalMcpService.formatSuccessResponse({
            success: true,
            resultId,
            status: 'completed',
            mediaType: params.mediaType,
            prompt: params.prompt,
            model: userMediaConfig.model,
            provider: userMediaConfig.provider,
            outputUrl: actionResult.outputUrl,
            storageKey: actionResult.storageKey,
            elapsedTime: `${Math.round((Date.now() - startTime) / 1000)}s`,
          });
        }

        // Check if failed
        if (actionResult.status === 'failed') {
          const errors = actionResult.errors || [];
          this.logger.error(`Media generation failed for ${resultId}: ${JSON.stringify(errors)}`);

          const errorMessage = Array.isArray(errors) ? errors.join(', ') : String(errors);
          return this.internalMcpService.formatErrorResponse(
            new Error(`Media generation failed: ${errorMessage}`),
          );
        }

        // Continue polling if still executing or waiting
        this.logger.debug(`Media generation status for ${resultId}: ${actionResult.status}`);
      }

      // Timeout reached
      this.logger.warn(`Media generation timeout for ${resultId} after ${timeout}ms`);

      return this.internalMcpService.formatErrorResponse(
        Object.assign(new Error(`Media generation timeout after ${timeout / 1000}s`), {
          resultId,
          suggestion: `Use get_media_generation_status with resultId "${resultId}" to check status later`,
        }),
      );
    } catch (error) {
      this.logger.error(`Error in generate_media: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }

  /**
   * Get media generation status (for backward compatibility)
   */
  @Tool({
    name: 'get_media_generation_status',
    description:
      'Check the current status and progress of any media generation task (image, video, or audio) using its result ID. This tool can be used to monitor long-running generation tasks.',
    parameters: z.object({
      resultId: z
        .string()
        .describe('The unique result ID returned from a previous media generation request'),
    }),
  })
  async getMediaGenerationStatus(
    params: { resultId: string },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'get_media_generation_status' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      const actionResult = await this.actionService.getActionResult(user, {
        resultId: params.resultId,
      });

      const response = {
        resultId: params.resultId,
        status: actionResult.status,
        title: actionResult.title,
        outputUrl: actionResult.outputUrl,
        storageKey: actionResult.storageKey,
        errors: actionResult.errors || [],
        errorType: actionResult.errorType,
        createdAt: actionResult.createdAt,
        updatedAt: actionResult.updatedAt,
      };

      return this.internalMcpService.formatSuccessResponse(response);
    } catch (error) {
      this.logger.error(`Error in get_media_generation_status: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }

  /**
   * Helper method to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
