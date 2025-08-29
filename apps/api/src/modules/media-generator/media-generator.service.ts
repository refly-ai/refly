import { Injectable, Logger } from '@nestjs/common';
import {
  User,
  MediaGenerateRequest,
  MediaGenerateResponse,
  CreditBilling,
  MediaGenerationModelConfig,
} from '@refly/openapi-schema';

import { ModelUsageQuotaExceeded, ProviderItemNotFoundError } from '@refly/errors';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_SYNC_MEDIA_CREDIT_USAGE } from '../../utils/const';
import { SyncMediaCreditUsageJobData } from '../subscription/subscription.dto';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { CreditService } from '../credit/credit.service';
import { ProviderService } from '../provider/provider.service';
import { PromptProcessorService } from './prompt-processor.service';
import { genActionResultID } from '@refly/utils';
import { fal } from '@fal-ai/client';
import Replicate from 'replicate';

@Injectable()
export class MediaGeneratorService {
  private readonly logger = new Logger(MediaGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
    private readonly credit: CreditService,
    private readonly providerService: ProviderService,
    private readonly promptProcessor: PromptProcessorService,
    @InjectQueue(QUEUE_SYNC_MEDIA_CREDIT_USAGE)
    private readonly mediaCreditUsageReportQueue: Queue<SyncMediaCreditUsageJobData>,
  ) {}

  /**
   * Start asynchronous media generation task (synchronous version)
   * @param user User Information
   * @param request Media Generation Request
   * @returns Response containing resultId
   */
  async generate(user: User, request: MediaGenerateRequest): Promise<MediaGenerateResponse> {
    try {
      const resultId = request.resultId || genActionResultID();

      const { mediaType, model, prompt, targetType, targetId, providerItemId } = request;

      // Creating an ActionResult Record
      await this.prisma.actionResult.create({
        data: {
          resultId,
          uid: user.uid,
          type: 'media',
          title: `${mediaType} generation: ${prompt.substring(0, 50)}...`,
          modelName: model,
          targetType,
          targetId,
          providerItemId,
          status: 'waiting',
          input: JSON.stringify(request),
          version: 0,
        },
      });

      // Perform media generation asynchronously
      this.executeGenerate(user, resultId, request).catch((error) => {
        this.logger.error(`Media generation failed for ${resultId}:`, error);
      });

      return {
        success: true,
        resultId,
      };
    } catch (error) {
      this.logger.error('Media generation initialization failed:', error);
      return {
        success: false,
      };
    }
  }

  /**
   * Execute synchronous media generation tasks
   * @param user User Information
   * @param resultId Result ID
   * @param request Media Generation Request
   */
  private async executeGenerate(
    user: User,
    resultId: string,
    request: MediaGenerateRequest,
  ): Promise<void> {
    try {
      // Update status to executing
      await this.prisma.actionResult.update({
        where: { resultId_version: { resultId, version: 0 } },
        data: {
          status: 'executing',
        },
      });

      const providerItem = await this.providerService.findProviderItemById(
        user,
        request.providerItemId,
      );

      const config = JSON.parse(providerItem?.config) as MediaGenerationModelConfig;

      if (!providerItem) {
        throw new ProviderItemNotFoundError(`provider item ${request.providerItemId} not found`);
      }

      const creditBilling: CreditBilling = providerItem?.creditBilling
        ? JSON.parse(providerItem?.creditBilling)
        : undefined;

      if (creditBilling) {
        const creditUsageResult = await this.credit.checkRequestCreditUsage(user, creditBilling);
        this.logger.log('creditUsageResult', creditUsageResult);
        if (!creditUsageResult.canUse) {
          throw new ModelUsageQuotaExceeded(`credit not available: ${creditUsageResult.message}`);
        }
      }

      const input = await this.buildInputObject(user, request, config.supportedLanguages);
      let url = '';

      // Generate media based on provider type
      const providerKey = providerItem?.provider?.providerKey;

      if (providerKey === 'replicate') {
        // Use Replicate provider
        const replicate = new Replicate({
          auth: providerItem?.provider?.apiKey ?? '',
        });

        const output = await replicate.run(
          request.model as `${string}/${string}` | `${string}/${string}:${string}`,
          { input },
        );

        url = this.getUrlFromReplicateOutput(output);
      } else if (providerKey === 'fal') {
        // Use Fal provider
        fal.config({
          credentials: providerItem.provider.apiKey,
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
        where: { resultId_version: { resultId, version: 0 } },
        data: {
          status: 'finish',
          outputUrl: uploadResult.url, // Using system internal URL
          storageKey: uploadResult.storageKey, // Save storage key
        },
      });

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
        where: { resultId_version: { resultId, version: 0 } },
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
    if (!request?.inputParameters) {
      const languageDetection = await this.promptProcessor.detectLanguage(request?.prompt);
      if (languageDetection.isEnglish || !supportedLanguages.includes(languageDetection.language)) {
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
            if (
              languageDetection.isEnglish /*||
              !supportedLanguages.includes(languageDetection.language)*/
            ) {
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
}
