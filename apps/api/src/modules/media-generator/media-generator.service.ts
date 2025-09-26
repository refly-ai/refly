import { Injectable, Logger } from '@nestjs/common';
import {
  User,
  MediaGenerateRequest,
  MediaGenerateResponse,
  CreditBilling,
  //MediaGenerationModelConfig,
  EntityType,
  CanvasNodeType,
} from '@refly/openapi-schema';

import { ModelUsageQuotaExceeded /*ProviderItemNotFoundError*/ } from '@refly/errors';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_SYNC_MEDIA_CREDIT_USAGE } from '../../utils/const';
import { SyncMediaCreditUsageJobData } from '../subscription/subscription.dto';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { CreditService } from '../credit/credit.service';
import { ProviderService } from '../provider/provider.service';
import { PromptProcessorService } from './prompt-processor.service';
import { genActionResultID, genMediaID, safeParseJSON } from '@refly/utils';
import { fal } from '@fal-ai/client';
import Replicate from 'replicate';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { ActionResult } from '../../generated/client';
//import { providerItemPO2DTO } from '../provider/provider.dto';

@Injectable()
export class MediaGeneratorService {
  private readonly logger = new Logger(MediaGeneratorService.name);

  // Timeout configurations for different media types (in milliseconds)
  private readonly timeoutConfig = {
    image: 90 * 1000, // 90 seconds for images
    audio: 5 * 60 * 1000, // 5 minutes for audio
    video: 10 * 60 * 1000, // 10 minutes for video
  };

  // Polling interval (in milliseconds)
  private readonly pollInterval = 2000; // 2 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
    private readonly credit: CreditService,
    private readonly providerService: ProviderService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly promptProcessor: PromptProcessorService,
    @InjectQueue(QUEUE_SYNC_MEDIA_CREDIT_USAGE)
    private readonly mediaCreditUsageReportQueue: Queue<SyncMediaCreditUsageJobData>,
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
        const config: any = JSON.parse(providerItem.config || '{}');
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

  /**
   * Start asynchronous media generation task
   * @param user User Information
   * @param request Media Generation Request
   * @returns Response containing resultId or completed result if wait is true
   */
  async generate(user: User, request: MediaGenerateRequest): Promise<MediaGenerateResponse> {
    try {
      const { mediaType, model, prompt, providerItemId, wait, parentResultId } = request;
      let { targetType, targetId } = request;

      // If no model or providerItemId is specified, try to get user's default configuration
      let finalModel = model;
      let finalProviderItemId = providerItemId;

      if (!finalModel) {
        this.logger.log(
          `No model or providerItemId specified for ${mediaType} generation, using user's default configuration`,
        );
        const defaultConfig = await this.getUserDefaultMediaModel(user, mediaType);
        if (defaultConfig) {
          finalModel = finalModel ?? defaultConfig.model;
          finalProviderItemId = finalProviderItemId ?? defaultConfig.providerItemId;
          this.logger.log(
            `Using default ${mediaType} model: ${finalModel} with providerItemId: ${finalProviderItemId}`,
          );
        } else {
          this.logger.warn(`No default ${mediaType} model configured for user ${user.uid}`);
          return {
            success: false,
            errMsg: `No media generation model configured for ${mediaType}. Please configure a model first using the settings.`,
          };
        }
      } else {
        this.logger.log(
          `Using specified ${mediaType} model: ${finalModel} with providerItemId: ${finalProviderItemId}`,
        );
      }

      this.logger.log(`Validating ${mediaType} generation request for user ${user.uid}`);

      let mediaId = '';

      // If parentResultId is provided, use the targetId and targetType from the parent result
      if (parentResultId) {
        const parentResult = await this.prisma.actionResult.findFirst({
          select: {
            targetId: true,
            targetType: true,
            workflowNodeExecutionId: true,
            workflowExecutionId: true,
          },
          where: { resultId: parentResultId },
          orderBy: { version: 'desc' },
        });

        if (!parentResult) {
          this.logger.warn(`Parent result ${parentResultId} not found`);
        } else {
          if (!targetId || !targetType) {
            targetId = parentResult.targetId;
            targetType = parentResult.targetType as EntityType;
          }

          if (parentResult.workflowExecutionId) {
            const nodeExecution = await this.prisma.workflowNodeExecution.findUnique({
              where: {
                nodeExecutionId: parentResult.workflowNodeExecutionId,
              },
            });
            if (nodeExecution?.childNodeIds) {
              const childNodeIds = safeParseJSON(nodeExecution.childNodeIds) as string[];
              const docNodeExecution = await this.prisma.workflowNodeExecution.findFirst({
                where: {
                  nodeId: { in: childNodeIds },
                  status: 'waiting',
                  nodeType: mediaType as CanvasNodeType,
                },
                orderBy: {
                  createdAt: 'asc',
                },
              });
              if (docNodeExecution) {
                mediaId = docNodeExecution.entityId;
              }
            }
          }
        }
      }
      const resultId = request.resultId || genActionResultID();

      // Creating an ActionResult Record
      const result = await this.prisma.actionResult.create({
        data: {
          resultId,
          uid: user.uid,
          type: 'media',
          title: `${mediaType} generation: ${prompt.substring(0, 50)}...`,
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

      // Start media generation asynchronously
      this.executeGenerate(user, result, finalRequest, mediaId).catch((error) => {
        this.logger.error(`Media generation failed for ${resultId}:`, error);
      });

      // If wait is true, execute synchronously and return result
      if (wait) {
        // Poll for completion
        try {
          const result = await this.pollActionResult(resultId, mediaType);
          return {
            success: true,
            resultId,
            outputUrl: result.outputUrl,
            storageKey: result.storageKey,
          };
        } catch (error) {
          this.logger.error(`Synchronous media generation failed for ${resultId}:`, error);
          return {
            success: false,
            errMsg: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      return {
        success: true,
        resultId,
      };
    } catch (error) {
      this.logger.error('Media generation initialization failed:', error);
      return {
        success: false,
        errMsg: error instanceof Error ? error.message : 'Unknown error',
      };
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
    mediaId?: string,
  ): Promise<void> {
    const { mediaType, provider } = request;
    const { pk, resultId, parentResultId, title, targetType, targetId } = result;
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

      const creditBilling: CreditBilling = {
        unitCost: request.unitCost,
        unit: 'product',
        minCharge: request.unitCost,
      };

      if (creditBilling) {
        const creditUsageResult = await this.credit.checkRequestCreditUsage(user, creditBilling);
        this.logger.log('creditUsageResult', creditUsageResult);
        if (!creditUsageResult.canUse) {
          throw new ModelUsageQuotaExceeded(`credit not available: ${creditUsageResult.message}`);
        }
      }

      const input = request.input;

      this.logger.log(`input: ${JSON.stringify(input)}`);

      let url = '';

      // Generate media based on provider type
      const providerKey = provider;

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

        const result = await fal.subscribe(request.model, {
          input: input,
          logs: false,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
              update.logs?.map((log) => log.message).forEach(console.log);
            }
          },
        });

        url = this.getUrlFromFalResult(result);
      } else {
        throw new Error(`Unsupported provider: ${providerKey}`);
      }

      const uploadResult = await this.miscService.dumpFileFromURL(user, {
        url: url,
        entityId: resultId,
        entityType: 'mediaResult',
        visibility: 'private',
      });

      // Update status to completed, saving the storage information inside the system
      await this.prisma.actionResult.update({
        where: { pk },
        data: {
          status: 'finish',
          outputUrl: uploadResult.url, // Using system internal URL
          storageKey: uploadResult.storageKey, // Save storage key
        },
      });

      if (parentResultId && targetType === 'canvas' && targetId) {
        const entityId = mediaId || genMediaID(mediaType);
        await this.canvasSyncService.addNodeToCanvas(
          user,
          targetId,
          {
            type: mediaType,
            data: {
              title,
              entityId,
              metadata: {
                resultId,
                storageKey: uploadResult.storageKey,
                [`${mediaType}Url`]: uploadResult.url,
                modelInfo: {
                  name: request.model,
                  label: request.model,
                  provider: provider,
                  providerItemId: request.providerItemId,
                },
                parentResultId,
              },
            },
          },
          [{ type: 'skillResponse', entityId: parentResultId }],
          { autoLayout: true },
        );
      }

      if (this.mediaCreditUsageReportQueue && creditBilling) {
        const basicUsageData = {
          uid: user.uid,
          resultId,
        };
        const mediaCreditUsage: SyncMediaCreditUsageJobData = {
          ...basicUsageData,
          creditBilling,
          timestamp: new Date(),
        };

        await this.mediaCreditUsageReportQueue.add(
          `media_credit_usage_report:${resultId}`,
          mediaCreditUsage,
        );
      }
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

  private async buildInputObject(
    user: User,
    request: MediaGenerateRequest,
    supportedLanguages: string[],
  ): Promise<Record<string, any>> {
    if (
      !request?.inputParameters ||
      (Array.isArray(request.inputParameters) && request.inputParameters.length === 0)
    ) {
      const languageDetection = await this.promptProcessor.detectLanguage(request?.prompt);
      // Check if supportedLanguages is empty or undefined for backward compatibility
      const shouldTranslate =
        !languageDetection.isEnglish &&
        Array.isArray(supportedLanguages) &&
        supportedLanguages.length > 0 &&
        !supportedLanguages.includes(languageDetection.language);

      if (shouldTranslate) {
        const translatedPrompt = await this.promptProcessor.translateToEnglish(
          request?.prompt,
          languageDetection.language,
        );
        request.prompt = translatedPrompt.translatedPrompt;
      }
      return {
        prompt: request?.prompt ?? '', // Base field
      };
    }

    const input: Record<string, any> = {};
    if (Array.isArray(request?.inputParameters)) {
      for (const param of request.inputParameters) {
        if (param?.name && param?.value !== undefined) {
          // Skip empty values (empty string or empty array)
          if (param.value === '' || (Array.isArray(param.value) && param.value.length === 0)) {
            continue;
          }

          // Handle URL type parameters by converting storage keys to external URLs
          if (param.type === 'url') {
            if (Array.isArray(param.value)) {
              // Handle array of storage keys
              const urls = await this.miscService.generateImageUrls(user, param.value as string[]);
              input[param.name] = urls;
            } else {
              // Handle single storage key
              const urls = await this.miscService.generateImageUrls(user, [param.value as string]);
              input[param.name] = urls?.[0] ?? '';
            }
          } else if (param.type === 'text') {
            const languageDetection = await this.promptProcessor.detectLanguage(
              param.value as string,
            );
            // Check if supportedLanguages is empty or undefined for backward compatibility
            const shouldTranslate =
              !languageDetection.isEnglish &&
              Array.isArray(supportedLanguages) &&
              supportedLanguages.length > 0 &&
              !supportedLanguages.includes(languageDetection.language);

            if (!shouldTranslate) {
              input[param.name] = param.value;
            } else {
              const translatedPrompt = await this.promptProcessor.translateToEnglish(
                param.value as string,
                languageDetection.language,
              );
              input[param.name] = translatedPrompt.translatedPrompt;
            }
          } else {
            input[param.name] = param.value;
          }
        }
      }
    }

    return input;
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
        if (!actionResult.outputUrl || !actionResult.storageKey) {
          throw new Error('Media generation completed but output data is missing');
        }

        this.logger.log(`Media generation completed for ${resultId}`);
        return {
          outputUrl: actionResult.outputUrl,
          storageKey: actionResult.storageKey,
        };
      }

      // Check if failed
      if (actionResult.status === 'failed') {
        const errors = actionResult.errors ? JSON.parse(actionResult.errors) : [];
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
