import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HeyGenGenerateVideoRequest,
  HeyGenGenerateVideoResponse,
  User,
} from '@refly/openapi-schema';
import axios, { AxiosInstance } from 'axios';
import { Queue } from 'bullmq';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { buildResponse, ERROR_DETAILS } from '../../../../utils';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../../../utils/const';
import { PrismaService } from '../../../common/prisma.service';
import { SyncToolCreditUsageJobData } from '../../../credit/credit.dto';
import { MiscService } from '../../../misc/misc.service';
import { MEDIA_TYPES } from '../../common/constant/media-types';
import { ToolExecutionSync } from '../../common/decorators/tool-execution-sync.decorator';
import { ToolExecutionSyncInterceptor } from '../../common/interceptors/tool-execution-sync.interceptor';

/**
 * HeyGen Video Generation Service
 * Using HeyGen API v2: https://docs.heygen.com/reference/create-an-avatar-video-v2
 */
@Injectable()
export class HeyGenService {
  private readonly logger = new Logger(HeyGenService.name);
  private readonly client: AxiosInstance | null = null;
  private readonly apiKey: string | null = null;

  // Credit cost: 1 minute = $1 = 140 credits (100x base + 40% markup)
  private readonly CREDIT_PER_MINUTE = 140;

  constructor(
    private readonly config: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly miscService: MiscService,
    private readonly toolExecutionSync: ToolExecutionSyncInterceptor,
    @Optional()
    @InjectQueue(QUEUE_SYNC_TOOL_CREDIT_USAGE)
    private readonly toolCreditUsageQueue?: Queue<SyncToolCreditUsageJobData>,
  ) {
    this.apiKey = this.config.get<string>('video.heygen.apiKey');
    if (!this.apiKey) {
      this.logger.error(
        'HEYGEN_API_KEY is not configured. Set the environment variable to enable HeyGen integration.',
      );
      return;
    }
    this.client = axios.create({
      baseURL: 'https://api.heygen.com',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
      },
      timeout: 60000,
      maxRedirects: 5,
      // Disable HTTP/2 to avoid potential connection issues
      httpAgent: new HttpAgent({
        keepAlive: true,
        timeout: 60000,
      }),
      httpsAgent: new HttpsAgent({
        keepAlive: true,
        timeout: 60000,
        rejectUnauthorized: true, // Validate SSL certificates
      }),
    });
  }

  /**
   * Ensure client is authenticated
   */
  private ensureAuth(): AxiosInstance {
    if (!this.client || !this.apiKey) {
      throw new Error('HeyGen API not authenticated. HEYGEN_API_KEY is not configured.');
    }
    return this.client;
  }

  /**
   * Get file URL from storageKey (Version 2: Using temporary presigned URLs)
   */
  private async resolveFileUrl(storageKey: string): Promise<string> {
    // Generate temporary presigned URL (valid for 1 hour)
    return await this.miscService.generateTempPublicURL(storageKey, 3600);
  }

  /**
   * Generate avatar video using HeyGen API v2 with automatic workflow sync
   * Uses @ToolExecutionSync decorator to handle all boilerplate logic:
   * - ActionResult creation and status management
   * - Workflow node execution tracking
   * - Canvas node creation and connection
   * - Parent-child relationship handling
   * Supports entityId-based file references for video and voice
   */
  @ToolExecutionSync({
    resultType: MEDIA_TYPES.VIDEO,
    getParentResultId: (req) => req.parentResultId,
    getTitle: (req) => req.title || 'heygen-generate-video',
    getModel: (req) => req.model,
    getProviderItemId: (req) => req.providerItemId,
    createCanvasNode: true,
    updateWorkflowNode: true,
    getMetadata: (_req, result) => ({
      videoUrl: result.data?.videoUrl,
      videoId: result.data?.videoId,
      duration: result.data?.duration,
      thumbnailUrl: result.data?.thumbnailUrl,
    }),
  })
  async generateVideo(
    user: User,
    request: HeyGenGenerateVideoRequest,
  ): Promise<HeyGenGenerateVideoResponse> {
    let videoInputs: any[] = [];
    let apiRequest: any = {};

    try {
      const client = this.ensureAuth();

      // Build video_inputs array with file resolution
      videoInputs = await Promise.all(
        request.scenes.map(async (scene, sceneIndex) => {
          this.logger.log(`[HeyGen Service] Processing scene #${sceneIndex + 1}:`, {
            voiceType: scene.voice.type,
            storageKey: scene.voice.storageKey,
            audioUrl: scene.voice.audioUrl,
          });

          // Only support audio type for voice
          const audioUrl: string | null = await this.getResourceUrl({
            storageKey: scene.voice.storageKey,
            url: scene.voice.audioUrl,
          });

          const videoInput: any = {
            voice: {
              type: 'audio',
              audio_url: audioUrl,
            },
          };

          // Add character only if provided
          if (scene.character?.avatarId) {
            videoInput.character = {
              type: scene.character.type || 'avatar',
              avatar_id: scene.character.avatarId,
              avatar_style: scene.character.avatarStyle || 'normal',
              ...(scene.character.scale != null && { scale: scene.character.scale }),
              ...(scene.character.offset && { offset: scene.character.offset }),
            };
          }

          // Handle background: support storageKey or URL with fallback
          if (scene.background) {
            this.logger.log(`[HeyGen Service] Scene #${sceneIndex + 1} background:`, {
              type: scene.background.type,
              storageKey: scene.background.storageKey,
              url: scene.background.url,
            });

            if (scene.background.type === 'image' || scene.background.type === 'video') {
              const bgUrl: string | null = await this.getResourceUrl(scene.background);
              if (!bgUrl) {
                throw new Error(
                  `Either storageKey or url is required for ${scene.background.type} background`,
                );
              }

              videoInput.background = {
                type: scene.background.type,
                url: bgUrl,
              };

              // Add play_style for video backgrounds (required by HeyGen API)
              if (scene.background.type === 'video') {
                videoInput.background.play_style = scene.background.playStyle || 'fit_to_scene';
              }
            } else if (scene.background.type === 'color') {
              videoInput.background = {
                type: 'color',
                color: scene.background.color || '#f6f6fc',
              };
            }
          }

          return videoInput;
        }),
      );

      // Build API request
      apiRequest = {
        video_inputs: videoInputs,
        ...(request.dimension && { dimension: request.dimension }),
        ...(request.aspectRatio && { aspect_ratio: request.aspectRatio }),
        ...(request.test != null && { test: request.test }),
        ...(request.title && { title: request.title }),
        ...(request.callbackId && { callback_id: request.callbackId }),
        ...(request.caption != null && { caption: request.caption }),
      };
      this.logger.log(`Generating video with ${videoInputs.length} scenes for user ${user.uid}`);

      // Make API call
      const response = await client.post('/v2/video/generate', apiRequest);

      const videoId = response.data.data?.video_id;
      if (!videoId) {
        return buildResponse<HeyGenGenerateVideoResponse>(false, null, {
          code: 'VIDEO_GENERATION_FAILED',
          message: 'No video ID returned from HeyGen API',
        });
      }
      this.logger.log(`✅ Video generation started: ${videoId}`);
      // block until the video is completed
      return await this.waitForVideoCompletion(videoId, { user, videoId });
    } catch (error) {
      const errorWithStatus = error as { response?: { status?: number; data?: any } };
      const status = errorWithStatus?.response?.status;
      const errorData = errorWithStatus?.response?.data;

      // Enhanced error logging for AggregateError and network errors
      this.logger.error(
        `Failed to generate video: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // Log AggregateError details if present
      if (error instanceof AggregateError) {
        this.logger.error(`AggregateError with ${error.errors.length} errors:`);
        error.errors.forEach((err: any, index) => {
          this.logger.error(`Error ${index + 1}: ${err.message}`);
          if (err.code) this.logger.error(`  Code: ${err.code}`);
          if (err.errno) this.logger.error(`  Errno: ${err.errno}`);
          if (err.syscall) this.logger.error(`  Syscall: ${err.syscall}`);
          if (err.hostname) this.logger.error(`  Hostname: ${err.hostname}`);
          if (err.address) this.logger.error(`  Address: ${err.address}`);
        });
      }

      // Log axios-specific error details
      const axiosError = error as any;
      if (axiosError.code) {
        this.logger.error(`Axios Error Code: ${axiosError.code}`);
      }
      if (axiosError.config) {
        this.logger.error(`Request URL: ${axiosError.config.url}`);
        this.logger.error(`Request Method: ${axiosError.config.method}`);
        this.logger.error(`Request BaseURL: ${axiosError.config.baseURL}`);
      }

      // Log detailed error information for debugging
      if (errorData) {
        this.logger.error(`HeyGen API Error Response: ${JSON.stringify(errorData, null, 2)}`);
      }

      // Log the request payload that caused the error
      this.logger.error(`Request payload: ${JSON.stringify(apiRequest, null, 2)}`);
      this.logger.error(`Video inputs: ${JSON.stringify(videoInputs, null, 2)}`);

      if (status === 429) {
        return buildResponse<HeyGenGenerateVideoResponse>(
          false,
          null,
          ERROR_DETAILS.RATE_LIMIT_ERROR,
        );
      } else if (status === 401) {
        return buildResponse<HeyGenGenerateVideoResponse>(false, null, ERROR_DETAILS.UNAUTHORIZED);
      } else if (status === 404) {
        return buildResponse<HeyGenGenerateVideoResponse>(false, null, {
          code: 'NOT_FOUND',
          message:
            'HeyGen API endpoint not found. Please check your API key and account permissions. ' +
            'Ensure your account has access to video generation features.',
        });
      } else if (status === 400) {
        return buildResponse<HeyGenGenerateVideoResponse>(false, null, {
          code: 'BAD_REQUEST',
          message: errorData?.message || 'Invalid request parameters',
        });
      }

      return buildResponse<HeyGenGenerateVideoResponse>(false, null, {
        code: 'VIDEO_GENERATION_FAILED',
        message: (error as Error).message || 'Failed to generate video',
      });
    }
  }

  /**
   * Calculate and charge credits for video generation
   * Credit cost: 1 minute = 140 credits
   */
  private async chargeVideoCredits(
    user: User | undefined,
    durationInSeconds: number | undefined,
    heygenVideoId: string,
  ): Promise<void> {
    // Skip charging if user is not provided
    if (!user) {
      this.logger.warn(`Skipping credit charge for video ${heygenVideoId}: missing user`);
      return;
    }

    // Skip charging if queue is not available
    if (!this.toolCreditUsageQueue) {
      this.logger.warn(
        `Skipping credit charge for video ${heygenVideoId}: toolCreditUsageQueue not available`,
      );
      return;
    }

    // Default to 0 if duration is not available
    const duration = durationInSeconds || 0;

    // Calculate credit cost: convert seconds to minutes (round up) and multiply by cost per minute
    const durationInMinutes = Math.ceil(duration / 60);
    const creditCost = durationInMinutes * this.CREDIT_PER_MINUTE;

    this.logger.log(
      `Charging ${creditCost} credits for video ${heygenVideoId} (${duration}s = ${durationInMinutes} minutes) for user ${user.uid}`,
    );

    // Find the most recent actionResult for this user with type 'video'
    // This assumes the decorator has already created the actionResult
    const actionResult = await this.prismaService.actionResult.findFirst({
      where: {
        uid: user.uid,
        type: MEDIA_TYPES.VIDEO,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        resultId: true,
      },
    });

    if (!actionResult) {
      this.logger.warn(`Skipping credit charge for video ${heygenVideoId}: no actionResult found`);
      return;
    }

    // Queue credit usage job for async processing
    const jobData: SyncToolCreditUsageJobData = {
      uid: user.uid,
      creditCost,
      timestamp: new Date(),
      resultId: actionResult.resultId,
      toolsetName: 'HeyGen',
      toolName: 'generate-video',
    };

    try {
      await this.toolCreditUsageQueue.add(
        `heygen_video_credit:${user.uid}:${heygenVideoId}`,
        jobData,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue credit charge for video ${heygenVideoId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Get resource URL from storageKey or direct URL
   * Uses temporary presigned URLs for private files
   */
  private async getResourceUrl(resource: { storageKey?: string; url?: string }): Promise<string> {
    let resourceUrl: string | null = null;
    if (resource.storageKey) {
      resourceUrl = await this.resolveFileUrl(resource.storageKey);
      this.logger.log(`[HeyGen Service] Resolved URL from storageKey: ${resourceUrl}`);
      return resourceUrl;
    }

    // If storageKey failed or not provided, try direct URL
    if (!resourceUrl && resource.url) {
      if (resource.url.startsWith('http')) {
        try {
          const headResponse = await axios.head(resource.url, { timeout: 5000 });
          if (headResponse.status !== 200) {
            throw new Error(
              `Resource URL is not accessible: ${resource.url} (status: ${headResponse.status})`,
            );
          }

          resourceUrl = resource.url;
        } catch (error) {
          throw new Error(
            `Failed to access audio URL: ${resource.url} - ${(error as Error).message}`,
          );
        }
      }
    }

    if (!resourceUrl) {
      throw new Error('Either resourceEntityId or resourceUrl is required for resource type');
    }
    return resourceUrl;
  }

  /**
   * Get video generation status and details
   */
  async getVideoStatus(request: { videoId: string }): Promise<HeyGenGenerateVideoResponse> {
    try {
      const client = this.ensureAuth();
      const response = await client.get(`/v1/video_status.get?video_id=${request.videoId}`);

      const data = response.data.data;

      return buildResponse<HeyGenGenerateVideoResponse>(true, {
        data: {
          videoId: request.videoId,
          status: data.status,
          videoUrl: data.video_url,
          thumbnailUrl: data.thumbnail_url,
          duration: data.duration,
          error: data.error,
        },
      });
    } catch (error) {
      const errorWithStatus = error as { response?: { status?: number; data?: any } };
      const status = errorWithStatus?.response?.status;

      this.logger.error(
        `Failed to get video status: ${(error as Error).message}`,
        (error as Error).stack,
      );

      if (status === 404) {
        return buildResponse<HeyGenGenerateVideoResponse>(false, null, {
          code: 'VIDEO_NOT_FOUND',
          message: `Video not found: ${request.videoId}`,
        });
      }

      return buildResponse<HeyGenGenerateVideoResponse>(false, null, {
        code: 'GET_VIDEO_STATUS_FAILED',
        message: (error as Error).message || 'Failed to get video status',
      });
    }
  }

  /**
   * Poll video status until completion or failure
   */
  async waitForVideoCompletion(
    videoId: string,
    options: {
      maxAttempts?: number;
      pollInterval?: number;
      onProgress?: (status: any) => void;
      user?: User;
      videoId?: string;
    } = {},
  ): Promise<HeyGenGenerateVideoResponse> {
    const maxAttempts = options.maxAttempts || 60; // 5 minutes with 5s interval
    const pollInterval = options.pollInterval || 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.getVideoStatus({ videoId });

      if (result.status !== 'success' || !result.data) {
        return result;
      }

      if (options.onProgress) {
        options.onProgress(result.data);
      }

      if (result.data.status === 'completed') {
        // Download video from HeyGen URL to upload to our storage
        if (result.data.videoUrl) {
          try {
            const videoResponse = await axios.get(result.data.videoUrl, {
              responseType: 'arraybuffer',
              timeout: 600000,
            });
            const videoBuffer = Buffer.from(videoResponse.data);
            // Charge credits after successful video generation
            await this.chargeVideoCredits(options.user, result.data.duration, videoId);

            // Return ToolExecutionResult with buffer for interceptor to handle upload
            return {
              status: 'success',
              data: {
                buffer: videoBuffer,
                filename: `video-${videoId}.mp4`,
                mimetype: 'video/mp4',
                videoId: result.data.videoId,
                duration: result.data.duration,
                thumbnailUrl: result.data.thumbnailUrl,
                videoUrl: result.data.videoUrl,
              },
            } as any;
          } catch (downloadError) {
            this.logger.error(
              `Failed to download video from HeyGen: ${(downloadError as Error).message}`,
              (downloadError as Error).stack,
            );
            return buildResponse<HeyGenGenerateVideoResponse>(false, null, {
              code: 'VIDEO_DOWNLOAD_FAILED',
              message: `Failed to download video: ${(downloadError as Error).message}`,
            });
          }
        }

        return result;
      }

      if (result.data.status === 'failed') {
        return buildResponse<HeyGenGenerateVideoResponse>(false, null, {
          code: 'VIDEO_GENERATION_FAILED',
          message: result.data.error?.message || 'Video generation failed',
        });
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return buildResponse<HeyGenGenerateVideoResponse>(false, null, {
      code: 'VIDEO_GENERATION_TIMEOUT',
      message: `Video generation timed out after ${maxAttempts} attempts`,
    });
  }
}
