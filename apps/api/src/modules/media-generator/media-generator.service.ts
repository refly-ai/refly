import { Injectable, Logger } from '@nestjs/common';
import mime from 'mime';
import {
  User,
  MediaGenerateRequest,
  EntityType,
  CanvasNodeType,
  CanvasNode,
  MediaGenerationResult,
} from '@refly/openapi-schema';

import { PrismaService } from '../common/prisma.service';
import { ProviderService } from '../provider/provider.service';
import { ActionResultNotFoundError } from '@refly/errors';
import { genActionResultID, safeParseJSON } from '@refly/utils';
import { fal } from '@fal-ai/client';
import Replicate from 'replicate';
import { ActionResult } from '../../generated/client';
import { DriveService } from '../drive/drive.service';
import { driveFilePO2DTO } from '../drive/drive.dto';

@Injectable()
export class MediaGeneratorService {
  private readonly logger = new Logger(MediaGeneratorService.name);

  // Timeout configurations for different media types (in milliseconds)
  private readonly timeoutConfig = {
    image: 5 * 60 * 1000, // 5 minutes for images
    audio: 15 * 60 * 1000, // 15 minutes for audio
    video: 15 * 60 * 1000, // 15 minutes for video
  };

  // Polling interval (in milliseconds)
  private readonly pollInterval = 2000; // 2 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly driveService: DriveService,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Validate that the provided model and providerItemId are compatible with the requested media type
   * @param user User information
   * @param mediaType Media type (image, audio, video)
   * @param model Model ID
   * @param providerItemId Provider item ID
   * @returns Validation result
   */
  private async validateMediaGenerationRequest(
    user: User,
    mediaType: string,
    model: string,
    providerItemId: string,
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Get the provider item to validate
      const providerItem = await this.providerService.findProviderItemById(user, providerItemId);

      if (!providerItem) {
        return {
          isValid: false,
          error: `Provider item ${providerItemId} not found`,
        };
      }

      // Check if the provider item supports the requested media type
      try {
        const config: any = safeParseJSON(providerItem.config || '{}');
        const capabilities = config.capabilities || {};

        if (!capabilities[mediaType]) {
          return {
            isValid: false,
            error: `Provider item ${providerItem.itemId} does not support ${mediaType} generation`,
          };
        }

        // Check if the model ID matches
        if (config.modelId !== model) {
          return {
            isValid: false,
            error: `Model ID mismatch: requested ${model}, but provider item has ${config.modelId}`,
          };
        }

        return { isValid: true };
      } catch (parseError) {
        return {
          isValid: false,
          error: `Invalid provider item configuration: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get user's default media generation model configuration
   * @param user User information
   * @param mediaType Media type (image, audio, video)
   * @returns Default model configuration or null if not configured
   */
  private async getUserDefaultMediaModel(
    user: User,
    mediaType: string,
  ): Promise<{ model: string; providerItemId: string } | null> {
    try {
      // Get user's configured media generation settings
      const userMediaConfig = await this.providerService.getUserMediaConfig(
        user,
        mediaType as 'image' | 'audio' | 'video',
      );

      if (!userMediaConfig) {
        this.logger.warn(
          `No media generation model configured for ${mediaType} for user ${user.uid}`,
        );
        return null;
      }

      this.logger.log(
        `Using user's default ${mediaType} model: ${userMediaConfig.model} from provider: ${userMediaConfig.provider}`,
      );

      return {
        model: userMediaConfig.model,
        providerItemId: userMediaConfig.providerItemId,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to get user's default media model for ${mediaType}: ${error?.message || error}`,
      );
      return null;
    }
  }

  private async doGenerate(
    user: User,
    request: MediaGenerateRequest,
  ): Promise<MediaGenerationResult> {
    const { mediaType, model, prompt, providerItemId, wait, targetType, targetId, parentResultId } =
      request;

    // If no model or providerItemId is specified, try to get user's default configuration
    let finalModel = model;
    let finalProviderItemId = providerItemId;

    if (!finalModel) {
      this.logger.log(
        `No model or providerItemId specified for ${mediaType} generation, using user's default configuration`,
      );
      const defaultConfig = await this.getUserDefaultMediaModel(user, mediaType);
      if (defaultConfig) {
        finalModel = defaultConfig.model;
        finalProviderItemId = defaultConfig.providerItemId;
        this.logger.log(
          `Using default ${mediaType} model: ${finalModel} with providerItemId: ${finalProviderItemId}`,
        );
      } else {
        throw new Error(
          `No media generation model configured for ${mediaType}. Please configure a model first using the settings.`,
        );
      }
    } else {
      this.logger.log(
        `Using specified ${mediaType} model: ${finalModel} with providerItemId: ${finalProviderItemId}`,
      );
    }

    const resultId = request.resultId || genActionResultID();

    // Creating an ActionResult Record
    const result = await this.prisma.actionResult.create({
      data: {
        resultId,
        uid: user.uid,
        type: 'media',
        title: prompt,
        modelName: finalModel,
        targetType,
        targetId,
        providerItemId: finalProviderItemId,
        status: 'waiting',
        input: JSON.stringify({
          ...request,
          model: finalModel,
          providerItemId: finalProviderItemId,
        }),
        version: 0,
        parentResultId,
      },
    });

    // Create the final request with resolved model and providerItemId
    const finalRequest: MediaGenerateRequest = {
      ...request,
      model: finalModel,
      providerItemId: finalProviderItemId,
    };

    // Start media generation asynchronously and capture promise for optional return
    const mediaGeneratePromise = this.executeGenerate(user, result, finalRequest).catch((error) => {
      this.logger.error(`Media generation failed for ${resultId}:`, error);
      return null;
    });

    // If wait is true, execute synchronously and return result
    if (wait) {
      // Poll for completion
      await this.pollActionResult(resultId, mediaType);
      const mediaGenerateResult = await mediaGeneratePromise;

      return mediaGenerateResult;
    }

    return {
      resultId,
    };
  }

  /**
   * Start asynchronous media generation task
   * @param user User Information
   * @param request Media Generation Request
   * @returns Response containing resultId or completed result if wait is true
   */
  async generate(user: User, request: MediaGenerateRequest): Promise<MediaGenerationResult> {
    const { mediaType, prompt, parentResultId } = request;

    // Store workflow node execution to update status at the end
    let nodeExecutionToUpdate: { nodeExecutionId: string; nodeData: CanvasNode } | null = null;

    // Check if this media generation is part of a workflow node execution
    if (parentResultId) {
      const parentResult = await this.prisma.actionResult.findFirst({
        select: {
          targetId: true,
          targetType: true,
          workflowNodeExecutionId: true,
        },
        where: { resultId: parentResultId },
        orderBy: { version: 'desc' },
      });

      if (!parentResult) {
        throw new ActionResultNotFoundError(`Action result ${parentResultId} not found`);
      }

      if (!request.targetId || !request.targetType) {
        request.targetId = parentResult.targetId;
        request.targetType = parentResult.targetType as EntityType;
      }

      if (parentResult.workflowNodeExecutionId) {
        const nodeExecution = await this.prisma.workflowNodeExecution.findUnique({
          where: {
            nodeExecutionId: parentResult.workflowNodeExecutionId,
          },
        });
        if (nodeExecution?.childNodeIds) {
          const childNodeIds = safeParseJSON(nodeExecution.childNodeIds) as string[];
          const mediaNodeExecution = await this.prisma.workflowNodeExecution.findFirst({
            where: {
              nodeId: { in: childNodeIds },
              status: 'waiting',
              nodeType: mediaType as CanvasNodeType,
              executionId: nodeExecution.executionId,
            },
            orderBy: {
              createdAt: 'asc',
            },
          });
          if (mediaNodeExecution?.entityId) {
            const nodeData: CanvasNode = safeParseJSON(mediaNodeExecution.nodeData);
            nodeExecutionToUpdate = {
              nodeExecutionId: mediaNodeExecution.nodeExecutionId,
              nodeData,
            };
          }
        }
      }
    }

    try {
      const result = await this.doGenerate(user, request);

      // Update workflow node execution status to finish if exists
      if (nodeExecutionToUpdate && result.outputUrl && result.storageKey) {
        await this.prisma.workflowNodeExecution.update({
          where: {
            nodeExecutionId: nodeExecutionToUpdate.nodeExecutionId,
          },
          data: {
            title: prompt,
            entityId: nodeExecutionToUpdate.nodeData.data?.entityId || '',
            status: 'finish',
            nodeData: JSON.stringify({
              ...nodeExecutionToUpdate.nodeData,
              data: {
                ...nodeExecutionToUpdate.nodeData.data,
                title: prompt,
                entityId: nodeExecutionToUpdate.nodeData.data?.entityId || '',
                metadata: {
                  ...nodeExecutionToUpdate.nodeData.data?.metadata,
                  [`${mediaType}Url`]: result.outputUrl,
                  [`${mediaType}StorageKey`]: result.storageKey,
                },
              },
            }),
          },
        });
      }

      return result;
    } catch (error) {
      // Update workflow node execution status to failed if exists
      if (nodeExecutionToUpdate) {
        try {
          await this.prisma.workflowNodeExecution.update({
            where: {
              nodeExecutionId: nodeExecutionToUpdate.nodeExecutionId,
            },
            data: {
              status: 'failed',
            },
          });
        } catch (updateError) {
          this.logger.error(
            `Failed to update workflow node execution status to failed: ${updateError.message}`,
          );
        }
      }
      throw error;
    }
  }

  /**
   * Execute synchronous media generation tasks
   * @param user User Information
   * @param result ActionResult record
   * @param request Media Generation Request
   */
  private async executeGenerate(
    user: User,
    result: ActionResult,
    request: MediaGenerateRequest,
  ): Promise<MediaGenerationResult> {
    const { title, mediaType, provider, parentResultId, parentResultVersion } = request;
    const { pk, resultId, targetId } = result;
    try {
      // Update status to executing
      await this.prisma.actionResult.update({
        where: { pk },
        data: {
          status: 'executing',
        },
      });

      const mediaProvider = await this.providerService.findProvider(user, {
        enabled: true,
        isGlobal: true,
        category: 'mediaGeneration',
        providerKey: provider,
      });

      const input = request.input;

      this.logger.log(`input: ${JSON.stringify(input)}`);

      let url = '';

      // Generate media based on provider type
      const providerKey = provider;

      let originalResult = null;

      if (providerKey === 'replicate') {
        // Use Replicate provider
        const replicate = new Replicate({
          auth: mediaProvider?.apiKey ?? '',
        });

        const output = await replicate.run(
          request.model as `${string}/${string}` | `${string}/${string}:${string}`,
          { input },
        );

        url = this.getUrlFromReplicateOutput(output);
      } else if (providerKey === 'fal') {
        // Use Fal provider
        fal.config({
          credentials: mediaProvider?.apiKey,
        });

        originalResult = await fal.subscribe(request.model, {
          input: input,
          logs: false,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
              update.logs?.map((log) => log.message).forEach(console.log);
            }
          },
        });

        url = this.getUrlFromFalResult(originalResult);
      } else {
        throw new Error(`Unsupported provider: ${providerKey}`);
      }

      // Infer filename and content type from URL
      const { filename, contentType } = this.inferFileInfoFromUrl(url, title, mediaType);

      const file = await this.driveService.createDriveFile(user, {
        name: filename,
        type: contentType,
        externalUrl: url,
        canvasId: targetId,
        source: 'agent',
        resultId: parentResultId,
        resultVersion: parentResultVersion,
      });

      // Update status to completed, saving the storage information inside the system
      await this.prisma.actionResult.update({
        where: { pk },
        data: {
          status: 'finish',
        },
      });

      return {
        file: driveFilePO2DTO(file),
        resultId,
        originalResult,
      };
    } catch (error) {
      this.logger.error(`Media generation failed for ${resultId}: ${error.stack}`);

      // Update status to failed
      await this.prisma.actionResult.update({
        where: { pk },
        data: {
          status: 'failed',
          errors: JSON.stringify([error instanceof Error ? error.message : 'Unknown error']),
        },
      });
    }
  }

  private getUrlFromReplicateOutput(output: any): string {
    // Check for model_file property
    if (output?.model_file ?? false) {
      return output.model_file;
    }
    // Check for wav property
    if (output?.wav ?? false) {
      return output.wav;
    }
    // Check for mesh_paint property
    if (output?.mesh_paint ?? false) {
      return output.mesh_paint;
    }
    // Check if output is an array and return the first element if exists
    if (Array.isArray(output) && output?.[0] !== undefined) {
      return output[0];
    }
    // Fallback: return output as string (or empty string if undefined)
    return output ?? '';
  }

  private async getFromReplicate(
    model: string,
    input: Record<string, any>,
    apiKey: string,
  ): Promise<any> {
    const url = 'https://api.replicate.com/v1/predictions';

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    };

    const data = {
      version: model,
      input: input,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit request: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
  private async pollFromFal(
    model: string,
    baseModel: string,
    input: Record<string, any>,
    apiKey: string,
  ): Promise<any> {
    const url = `https://queue.fal.run/${model}`;

    const headers = {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      // Submit the initial request
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit request: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      const requestId = responseData.request_id;

      if (!requestId) {
        throw new Error('No request ID received from fal');
      }

      // Poll for completion
      const statusUrl = `https://queue.fal.run/${baseModel}/requests/${requestId}/status`;
      const responseUrl = `https://queue.fal.run/${baseModel}/requests/${requestId}`;

      let status = responseData.status;
      const maxAttempts = 60; // 5 minutes with 5-second intervals
      let attempts = 0;

      while (status !== 'COMPLETED' && status !== 'FAILED' && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;

        const pollResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            Authorization: `Key ${apiKey}`,
          },
        });

        if (!pollResponse.ok) {
          throw new Error(
            `Failed to poll status: ${pollResponse.status} ${pollResponse.statusText}`,
          );
        }

        const statusData = await pollResponse.json();
        status = statusData.status;

        if (status === 'FAILED') {
          throw new Error(`Request failed: ${statusData.error || 'Unknown error'}`);
        }
      }

      if (status !== 'COMPLETED') {
        throw new Error('Request timed out');
      }

      // Get the final result
      const finalResponse = await fetch(responseUrl, {
        method: 'GET',
        headers: {
          Authorization: `Key ${apiKey}`,
        },
      });

      if (!finalResponse.ok) {
        throw new Error(
          `Failed to get result: ${finalResponse.status} ${finalResponse.statusText}`,
        );
      }

      return await finalResponse.json();
    } catch (error) {
      this.logger.error(
        `Error generating media with fal: ${error instanceof Error ? error.stack : error}`,
      );
      throw error;
    }
  }

  async getFromFal(model: string, input: Record<string, any>, apiKey: string): Promise<any> {
    const url = `https://queue.fal.run/${model}`;

    const headers = {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit request: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private getUrlFromFalResult(result: any): string {
    if (result?.data?.audio?.url) return result.data.audio.url;
    if (result?.data?.video?.url) return result.data.video.url;
    if (result?.data?.image?.url) return result.data.image.url;
    if (result?.data?.model_glb?.url) return result.data.model_glb.url;
    if (result?.data?.model_mesh?.url) return result.data.model_mesh.url;

    if (result?.data?.audios?.[0]?.url) return result.data.audios[0].url;
    if (result?.data?.videos?.[0]?.url) return result.data.videos[0].url;
    if (result?.data?.images?.[0]?.url) return result.data.images[0].url;

    return '';
  }

  /**
   * Infer filename and content type from URL
   * @param url The URL to parse
   * @param title Title to use as base filename if provided
   * @param fallbackMediaType Fallback media type if URL parsing fails
   * @returns Object containing filename and contentType
   */
  private inferFileInfoFromUrl(
    url: string,
    title: string,
    fallbackMediaType: string,
  ): { filename: string; contentType: string } {
    if (!url) {
      const extension = mime.getExtension(fallbackMediaType) || fallbackMediaType;
      const baseName = title
        ? title.replace(/\.[a-zA-Z0-9]+(?:\?.*)?$/, '')
        : `media_${Date.now()}`;
      return {
        filename: `${baseName}.${extension}`,
        contentType: fallbackMediaType,
      };
    }

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Extract filename from URL path
      const urlFilename = pathname.split('/').pop() || '';

      // Extract extension from filename
      const extensionMatch = urlFilename.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
      const extension = extensionMatch ? extensionMatch[1].toLowerCase() : '';

      // Map extension to content type
      const contentType = mime.getType(extension) || fallbackMediaType;

      // Generate filename: use title if provided, otherwise use URL filename or fallback
      let baseFilename: string;
      if (title) {
        // Strip possible file extension from title
        const cleanTitle = title.replace(/\.[a-zA-Z0-9]+(?:\?.*)?$/, '');
        // Use title and infer proper extension from content type
        const inferredExtension = mime.getExtension(contentType) || extension || fallbackMediaType;
        baseFilename = `${cleanTitle}.${inferredExtension}`;
      } else {
        // Fallback to URL-based filename generation
        baseFilename = urlFilename || `media_${Date.now()}`;
        if (!baseFilename.includes('.')) {
          const inferredExtension =
            mime.getExtension(contentType) || extension || fallbackMediaType;
          baseFilename = `${baseFilename}.${inferredExtension}`;
        }
      }

      return { filename: baseFilename, contentType };
    } catch (error) {
      this.logger.warn(`Failed to parse URL for file info: ${url}`, error);
      const extension = mime.getExtension(fallbackMediaType) || fallbackMediaType;
      const baseName = title
        ? title.replace(/\.[a-zA-Z0-9]+(?:\?.*)?$/, '')
        : `media_${Date.now()}`;
      return {
        filename: `${baseName}.${extension}`,
        contentType: fallbackMediaType,
      };
    }
  }

  /**
   * Helper method to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Poll for action result completion with timeout
   * @param resultId Result ID to poll
   * @param mediaType Media type for timeout calculation
   * @returns Action result when completed
   */
  private async pollActionResult(
    resultId: string,
    mediaType: string,
  ): Promise<{ outputUrl: string; storageKey: string }> {
    const timeout =
      this.timeoutConfig[mediaType as keyof typeof this.timeoutConfig] ?? this.timeoutConfig.image;
    const startTime = Date.now();

    this.logger.log(`Starting polling for ${mediaType} generation, timeout: ${timeout}ms`);

    while (Date.now() - startTime < timeout) {
      // Wait for polling interval
      await this.sleep(this.pollInterval);

      // Check status
      const actionResult = await this.prisma.actionResult.findFirst({
        where: { resultId },
        orderBy: { version: 'desc' },
      });

      if (!actionResult) {
        throw new Error(`ActionResult not found for resultId: ${resultId}`);
      }

      // Check if completed
      if (actionResult.status === 'finish') {
        this.logger.log(`Media generation completed for ${resultId}`);
        return {
          outputUrl: actionResult.outputUrl,
          storageKey: actionResult.storageKey,
        };
      }

      // Check if failed
      if (actionResult.status === 'failed') {
        const errors = actionResult.errors ? safeParseJSON(actionResult.errors) : [];
        const errorMessage = Array.isArray(errors) ? errors.join(', ') : String(errors);
        throw new Error(`Media generation failed: ${errorMessage}`);
      }

      // Continue polling if still executing or waiting
      this.logger.debug(`Media generation status for ${resultId}: ${actionResult.status}`);
    }

    // Timeout reached
    throw new Error(`Media generation timeout after ${timeout / 1000}s`);
  }
}
