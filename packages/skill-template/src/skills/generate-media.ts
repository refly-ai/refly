import { z } from 'zod';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import {
  Icon,
  SkillTemplateConfigDefinition,
  MediaGenerateRequest,
  Artifact,
} from '@refly/openapi-schema';
import { StateGraphArgs, StateGraph, START, END } from '@langchain/langgraph';
import { GraphState } from '../scheduler/types';
import { Runnable } from '@langchain/core/runnables';
import { SystemMessage } from '@langchain/core/messages';
import { MediaProviderNotConfiguredError, MediaModelNotConfiguredError } from '@refly/errors';

/**
 * Interface for log argument objects used in processLogArgs
 */
interface LogArgs {
  [key: string]: string | number | boolean | undefined | null;
}

export class GenerateMedia extends BaseSkill {
  name = 'generateMedia';

  icon: Icon = { type: 'emoji', value: '🎬' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'mediaType',
        inputMode: 'select',
        defaultValue: 'image',
        labelDict: {
          en: 'Media Type',
          'zh-CN': '媒体类型',
        },
        descriptionDict: {
          en: 'Type of media to generate',
          'zh-CN': '要生成的媒体类型',
        },
        options: [
          { value: 'image', labelDict: { en: 'Image', 'zh-CN': '图片' } },
          { value: 'video', labelDict: { en: 'Video', 'zh-CN': '视频' } },
          { value: 'audio', labelDict: { en: 'Audio', 'zh-CN': '音频' } },
        ],
      },
    ],
  };

  description =
    'Generate multimedia content including images, videos, and audio using external generation services with real-time progress tracking';

  schema = z.object({
    query: z.string().describe('The prompt for media generation'),
    mediaFiles: z.array(z.string()).optional().describe('Reference media files for the generation'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  /**
   * Decode HTML entities to prevent encoding issues in log messages
   */
  private decodeHtmlEntities(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&#x2F;': '/',
      '&#x27;': "'",
      '&#x3D;': '=',
      '&#x26;': '&',
      '&#x3C;': '<',
      '&#x3E;': '>',
      '&#x22;': '"',
      '&#x60;': '`',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&nbsp;': ' ',
    };

    let decodedText = text;
    for (const [entity, char] of Object.entries(htmlEntities)) {
      decodedText = decodedText.replace(new RegExp(entity, 'g'), char);
    }

    return decodedText;
  }

  /**
   * Process log arguments to decode HTML entities and prevent template variable issues
   */
  private processLogArgs(args: LogArgs): LogArgs {
    const processed: LogArgs = {};

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        processed[key] = this.decodeHtmlEntities(value);
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  generateMedia = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { query: stateQuery } = state;
    const { tplConfig, user } = config.configurable;

    // Get the media generation query from state.query (passed by pilot engine)
    const query = stateQuery || '';

    if (!query) {
      throw new Error('A prompt is required for media generation');
    }

    // Parse parameters from query string (for pilot system compatibility)
    const parsedParams = this.parseQueryParameters(query);

    // Intelligently infer media type from query content
    const inferredMediaType = this.inferMediaTypeFromQuery(query);

    // Determine final media type with priority: explicit param > inferred > config default > fallback default
    const mediaType = (parsedParams.mediaType ||
      inferredMediaType ||
      String(tplConfig?.mediaType?.value ?? 'image')) as 'image' | 'video' | 'audio';

    // Log media type detection process for debugging
    this.engine.logger.log(
      `Media type detection: explicit="${parsedParams.mediaType || 'none'}", inferred="${inferredMediaType || 'none'}", final="${mediaType}"`,
    );
    const quality = parsedParams.quality || String(tplConfig?.quality?.value ?? 'high');

    const { provider, model, providerItemId } =
      (await this.engine.service.getUserMediaConfig(user, mediaType)) || {};

    if (!provider) {
      throw new MediaProviderNotConfiguredError();
    }

    if (!model) {
      throw new MediaModelNotConfiguredError();
    }

    // Clean the query by removing parameter specifications
    const cleanedQuery = this.cleanQueryFromParameters(query);

    config.metadata.step = { name: 'generateMedia' };

    // Optimize prompt based on media type and configuration
    const optimizedPrompt = this.optimizePrompt(cleanedQuery, mediaType, {
      ...tplConfig,
      // Override with parsed parameters
      mediaType: { value: mediaType },
      providerItemId: { value: providerItemId },
      model: { value: model },
      quality: { value: quality },
    });

    this.engine.logger.log(`Generating ${mediaType} with prompt: ${optimizedPrompt}`);

    // Emit initial event for progress tracking
    this.emitEvent(
      {
        event: 'log',
        log: {
          key: 'media.generating',
          titleArgs: this.processLogArgs({
            mediaType,
          }),
          descriptionArgs: this.processLogArgs({
            mediaType,
            prompt: cleanedQuery,
            provider,
            model: model || 'auto-selected',
            quality,
          }),
        },
      },
      config,
    );

    try {
      // Get resultId first to create artifact
      const generateResponse = await this.engine.service?.generateMedia?.(
        config.configurable?.user,
        {
          mediaType,
          prompt: optimizedPrompt,
          model: model || undefined,
          providerItemId,
        },
      );

      if (!generateResponse?.resultId) {
        throw new Error('Failed to start media generation');
      }

      const { resultId } = generateResponse;

      // Emit artifact event to create canvas node
      const artifact: Artifact = {
        type: mediaType,
        entityId: resultId,
        title: cleanedQuery || `Generated ${this.getMediaTypeDisplayName(mediaType)}`,
      };

      this.emitEvent(
        {
          event: 'artifact',
          artifact,
        },
        config,
      );

      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'media.api.request',
            descriptionArgs: this.processLogArgs({
              provider,
              model: model || 'auto-selected',
              mediaType,
            }),
          },
        },
        config,
      );

      // Poll for media generation completion
      const result = await this.pollMediaGenerationCompletion(
        resultId,
        mediaType,
        cleanedQuery,
        config,
      );

      if (!result.success) {
        throw new Error(result.error || 'Media generation failed');
      }

      const responseMessage = {
        content: `${this.getMediaTypeDisplayName(mediaType)} generated successfully!

**Generation Details:**
- Media Type: ${this.getMediaTypeDisplayName(mediaType)}
- Prompt: ${optimizedPrompt}
- Provider: ${provider}
- Model: ${model || 'auto-selected'}
- Quality: ${quality}
- Generation Time: ${result.elapsedTime}
- Output URL: ${result.outputUrl}

The ${mediaType} has been generated and is ready for use.`,
        metadata: {
          contentType: mediaType,
          generationConfig: {
            mediaType,
            provider,
            model,
            quality,
            prompt: optimizedPrompt,
          },
          outputUrl: result.outputUrl,
          storageKey: result.storageKey,
          resultId: result.resultId,
        },
      };

      return { messages: [new SystemMessage(responseMessage)] };
    } catch (error) {
      const errorMessage = `${this.getMediaTypeDisplayName(mediaType)} generation failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;

      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'media.error',
            titleArgs: this.processLogArgs({
              mediaType,
            }),
            descriptionArgs: this.processLogArgs({
              error: errorMessage,
            }),
          },
        },
        config,
      );

      throw new Error(errorMessage);
    }
  };

  private async pollMediaGenerationCompletion(
    resultId: string,
    mediaType: 'image' | 'video' | 'audio',
    cleanedQuery: string,
    config: SkillRunnableConfig,
  ): Promise<any> {
    try {
      const user = config.configurable?.user;
      if (!user) {
        throw new Error('User not found in configuration');
      }

      // Configure timeout based on media type
      const timeoutConfig = {
        image: 90 * 1000, // 90 seconds for images
        audio: 5 * 60 * 1000, // 5 minutes for audio
        video: 10 * 60 * 1000, // 10 minutes for video
      };

      const timeout = timeoutConfig[mediaType] || 90 * 1000;
      const pollInterval = 2000; // 2 seconds
      const startTime = Date.now();

      this.engine.logger.log(`Starting polling for ${mediaType} generation, timeout: ${timeout}ms`);

      // Emit initial progress
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'media.started',
            titleArgs: this.processLogArgs({
              mediaType,
            }),
            descriptionArgs: this.processLogArgs({
              mediaType,
              resultId,
            }),
          },
        },
        config,
      );

      // Polling loop with real status checks
      while (Date.now() - startTime < timeout) {
        // Wait for polling interval
        await this.sleep(pollInterval);

        // Check status
        const actionResultResponse = await this.engine.service.getActionResult(user, { resultId });

        if (!actionResultResponse) {
          throw new Error(actionResultResponse?.errCode || 'Failed to get action result');
        }
        const actionResult = actionResultResponse;

        // Calculate progress based on elapsed time and media type
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(Math.floor((elapsed / timeout) * 90) + 5, 95);

        // Emit progress event
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: 'media.progress',
              titleArgs: this.processLogArgs({
                mediaType,
              }),
              descriptionArgs: this.processLogArgs({
                progress: estimatedProgress,
                mediaType,
              }),
            },
          },
          config,
        );

        // Check if completed
        if (actionResult.status === 'finish') {
          // Emit artifact completion event with media URL
          const completedArtifact: Artifact = {
            type: mediaType,
            entityId: resultId,
            title: cleanedQuery || `Generated ${this.getMediaTypeDisplayName(mediaType)}`,
            status: 'finish',
            metadata: {
              [`${mediaType}Url`]: actionResult.outputUrl,
              storageKey: actionResult.storageKey,
            },
          };

          this.emitEvent(
            {
              event: 'artifact',
              artifact: completedArtifact,
            },
            config,
          );

          // Emit completion event
          this.emitEvent(
            {
              event: 'log',
              log: {
                key: 'media.completed',
                titleArgs: this.processLogArgs({
                  mediaType,
                }),
                descriptionArgs: this.processLogArgs({
                  mediaType,
                  url: actionResult.outputUrl,
                  elapsedTime: `${Math.round((Date.now() - startTime) / 1000)}s`,
                }),
              },
            },
            config,
          );

          this.engine.logger.log(`Media generation completed for ${resultId}`);

          // Return success result with real data
          const elapsedTime = `${Math.round((Date.now() - startTime) / 1000)}s`;
          return {
            success: true,
            resultId,
            status: 'completed',
            mediaType,
            outputUrl: actionResult.outputUrl,
            storageKey: actionResult.storageKey,
            elapsedTime,
          };
        }

        // Check if failed
        if (actionResult.status === 'failed') {
          const errors = actionResult.errors || [];
          this.engine.logger.error(
            `Media generation failed for ${resultId}: ${JSON.stringify(errors)}`,
          );

          const errorMessage = Array.isArray(errors) ? errors.join(', ') : String(errors);
          throw new Error(`Media generation failed: ${errorMessage}`);
        }

        // Continue polling if still executing or waiting
        this.engine.logger.debug(`Media generation status for ${resultId}: ${actionResult.status}`);
      }

      // Timeout reached
      this.engine.logger.warn(`Media generation timeout for ${resultId} after ${timeout}ms`);
      throw new Error(
        `Media generation timeout after ${timeout / 1000}s. Use resultId "${resultId}" to check status later`,
      );
    } catch (error) {
      console.error(error);
      this.engine.logger.error(`Error in media generation: ${error?.message || error}`);
      throw error;
    }
  }

  private async callMediaGenerationService(
    params: MediaGenerateRequest,
    config: SkillRunnableConfig,
  ): Promise<any> {
    try {
      const user = config.configurable?.user;
      if (!user) {
        throw new Error('User not found in configuration');
      }

      this.engine.logger.log(
        `Calling ${params.mediaType} generation with model ${params.model || 'auto-selected'}`,
      );

      // Start media generation
      const generateResponse = await this.engine.service?.generateMedia?.(user, params);

      if (!generateResponse.resultId) {
        throw new Error(
          generateResponse ? String(generateResponse.resultId) : 'Failed to start media generation',
        );
      }

      const { resultId } = generateResponse;

      // Configure timeout based on media type
      const timeoutConfig = {
        image: 90 * 1000, // 90 seconds for images
        audio: 5 * 60 * 1000, // 5 minutes for audio
        video: 10 * 60 * 1000, // 10 minutes for video
      };

      const timeout = timeoutConfig[params.mediaType] || 90 * 1000;
      const pollInterval = 2000; // 2 seconds
      const startTime = Date.now();

      this.engine.logger.log(
        `Starting polling for ${params.mediaType} generation, timeout: ${timeout}ms`,
      );

      // Emit initial progress
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'media.started',
            titleArgs: this.processLogArgs({
              mediaType: params.mediaType,
            }),
            descriptionArgs: this.processLogArgs({
              mediaType: params.mediaType,
              resultId,
            }),
          },
        },
        config,
      );

      // Polling loop with real status checks
      while (Date.now() - startTime < timeout) {
        // Wait for polling interval
        await this.sleep(pollInterval);

        // Check status
        const actionResultResponse = await this.engine.service.getActionResult(user, { resultId });

        if (!actionResultResponse) {
          throw new Error(actionResultResponse?.errCode || 'Failed to get action result');
        }
        const actionResult = actionResultResponse;

        // Calculate progress based on elapsed time and media type
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(Math.floor((elapsed / timeout) * 90) + 5, 95);

        // Emit progress event
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: 'media.progress',
              titleArgs: this.processLogArgs({
                mediaType: params.mediaType,
              }),
              descriptionArgs: this.processLogArgs({
                progress: estimatedProgress,
                mediaType: params.mediaType,
              }),
            },
          },
          config,
        );

        // Check if completed
        if (actionResult.status === 'finish') {
          // Emit completion event
          this.emitEvent(
            {
              event: 'log',
              log: {
                key: 'media.completed',
                titleArgs: this.processLogArgs({
                  mediaType: params.mediaType,
                }),
                descriptionArgs: this.processLogArgs({
                  mediaType: params.mediaType,
                  url: actionResult.outputUrl,
                  elapsedTime: `${Math.round((Date.now() - startTime) / 1000)}s`,
                }),
              },
            },
            config,
          );

          this.engine.logger.log(`Media generation completed for ${resultId}`);

          // Return success result with real data
          const elapsedTime = `${Math.round((Date.now() - startTime) / 1000)}s`;
          return {
            success: true,
            resultId,
            status: 'completed',
            mediaType: params.mediaType,
            prompt: params.prompt,
            model: params.model,
            providerItemId: params.providerItemId,
            outputUrl: actionResult.outputUrl,
            storageKey: actionResult.storageKey,
            elapsedTime,
          };
        }

        // Check if failed
        if (actionResult.status === 'failed') {
          const errors = actionResult.errors || [];
          this.engine.logger.error(
            `Media generation failed for ${resultId}: ${JSON.stringify(errors)}`,
          );

          const errorMessage = Array.isArray(errors) ? errors.join(', ') : String(errors);
          throw new Error(`Media generation failed: ${errorMessage}`);
        }

        // Continue polling if still executing or waiting
        this.engine.logger.debug(`Media generation status for ${resultId}: ${actionResult.status}`);
      }

      // Timeout reached
      this.engine.logger.warn(`Media generation timeout for ${resultId} after ${timeout}ms`);
      throw new Error(
        `Media generation timeout after ${timeout / 1000}s. Use resultId "${resultId}" to check status later`,
      );
    } catch (error) {
      console.error(error);
      this.engine.logger.error(`Error in media generation: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Helper method to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Intelligently infer media type from query content
   * Analyzes keywords and context to determine the intended media type
   */
  private inferMediaTypeFromQuery(query: string): 'image' | 'video' | 'audio' | null {
    const lowerQuery = query.toLowerCase();

    // Image keywords (most common)
    const imageKeywords = [
      'image',
      'photo',
      'picture',
      'illustration',
      'drawing',
      'artwork',
      'design',
      'poster',
      'banner',
      'logo',
      'icon',
      'graphic',
      'visual',
      'diagram',
      '图片',
      '图像',
      '照片',
      '插图',
      '设计',
      '海报',
      '标志',
      '图标',
      '示意图',
    ];

    // Video keywords
    const videoKeywords = [
      'video',
      'movie',
      'animation',
      'clip',
      'footage',
      'demo',
      'demonstration',
      'commercial',
      'trailer',
      'short film',
      'motion',
      'animated',
      '视频',
      '动画',
      '短片',
      '演示',
      '录像',
      '影片',
      '动态',
    ];

    // Audio keywords
    const audioKeywords = [
      'audio',
      'music',
      'song',
      'sound',
      'voice',
      'speech',
      'narration',
      'podcast',
      'soundtrack',
      'background music',
      'sound effect',
      'jingle',
      '音频',
      '音乐',
      '声音',
      '语音',
      '音效',
      '背景音',
      '播客',
      '配音',
    ];

    // Count keyword matches for each type
    const imageScore = imageKeywords.filter((keyword) => lowerQuery.includes(keyword)).length;
    const videoScore = videoKeywords.filter((keyword) => lowerQuery.includes(keyword)).length;
    const audioScore = audioKeywords.filter((keyword) => lowerQuery.includes(keyword)).length;

    // Return the type with the highest score
    if (videoScore > imageScore && videoScore > audioScore) {
      return 'video';
    }
    if (audioScore > imageScore && audioScore > videoScore) {
      return 'audio';
    }
    if (imageScore > 0) {
      return 'image';
    }

    // If no clear keywords found, return null (will use default)
    return null;
  }

  /**
   * Parse parameters from query string for pilot system compatibility
   * Supports formats like "mediaType: image", "provider: replicate", etc.
   */
  private parseQueryParameters(query: string): Record<string, string> {
    const params: Record<string, string> = {};

    // Match patterns like "mediaType: image", "provider: replicate", etc.
    const paramPattern = /(\w+):\s*(\w+)/g;
    const matches = Array.from(query.matchAll(paramPattern));

    for (const match of matches) {
      const [, key, value] = match;
      params[key] = value;
    }

    return params;
  }

  /**
   * Remove parameter specifications from query to get clean prompt
   */
  private cleanQueryFromParameters(query: string): string {
    // Remove patterns like "mediaType: image", "provider: replicate", etc.
    return query
      .replace(/\b\w+:\s*\w+\b/g, '') // Remove parameter specifications
      .replace(/,\s*,/g, ',') // Remove double commas
      .replace(/^\s*,\s*|\s*,\s*$/g, '') // Remove leading/trailing commas
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private getMediaTypeDisplayName(mediaType: string): string {
    switch (mediaType) {
      case 'image':
        return 'Image';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      default:
        return 'Media';
    }
  }

  private optimizePrompt(query: string, mediaType: string, tplConfig: any): string {
    let optimizedPrompt = query;

    switch (mediaType) {
      case 'image':
        optimizedPrompt = this.optimizeImagePrompt(query, {
          aspectRatio: String(tplConfig?.aspectRatio?.value ?? '1:1'),
          style: String(tplConfig?.style?.value ?? 'realistic'),
          quality: String(tplConfig?.quality?.value ?? 'high'),
        });
        break;
      case 'video':
        optimizedPrompt = this.optimizeVideoPrompt(query, {
          duration: Number(tplConfig?.duration?.value ?? 5),
          fps: Number(tplConfig?.fps?.value ?? 24),
          quality: String(tplConfig?.quality?.value ?? 'high'),
        });
        break;
      case 'audio':
        optimizedPrompt = this.optimizeAudioPrompt(query, {
          audioType: String(tplConfig?.audioType?.value ?? 'music'),
          duration: Number(tplConfig?.audioDuration?.value ?? 30),
          quality: String(tplConfig?.quality?.value ?? 'high'),
        });
        break;
    }

    return optimizedPrompt;
  }

  private optimizeImagePrompt(
    query: string,
    config: { aspectRatio: string; style: string; quality: string },
  ): string {
    let optimizedPrompt = query;

    // Add style context
    switch (config.style) {
      case 'realistic':
        optimizedPrompt += ', photorealistic, high detail, natural lighting';
        break;
      case 'artistic':
        optimizedPrompt += ', artistic style, creative composition, expressive';
        break;
      case 'cartoon':
        optimizedPrompt += ', cartoon style, bright colors, simplified forms';
        break;
      case 'anime':
        optimizedPrompt += ', anime style, vibrant colors, detailed character design';
        break;
      case 'abstract':
        optimizedPrompt += ', abstract art, geometric forms, conceptual';
        break;
    }

    // Add quality context
    switch (config.quality) {
      case 'standard':
        optimizedPrompt += ', good quality';
        break;
      case 'high':
        optimizedPrompt += ', high quality, detailed, sharp';
        break;
      case 'ultra':
        optimizedPrompt += ', ultra high quality, extremely detailed, professional photography';
        break;
    }

    // Add aspect ratio context
    if (config.aspectRatio === '16:9') {
      optimizedPrompt += ', wide composition, panoramic view';
    } else if (config.aspectRatio === '9:16') {
      optimizedPrompt += ', vertical composition, portrait orientation';
    } else if (config.aspectRatio === '1:1') {
      optimizedPrompt += ', square composition, balanced layout';
    }

    optimizedPrompt += ', professional quality, well-composed';
    return optimizedPrompt;
  }

  private optimizeVideoPrompt(
    query: string,
    config: { duration: number; fps: number; quality: string },
  ): string {
    let optimizedPrompt = query;

    // Add video-specific context
    optimizedPrompt += ', cinematic, smooth motion, high-quality video';

    // Add duration context
    if (config.duration <= 5) {
      optimizedPrompt += ', quick action, dynamic movement';
    } else if (config.duration <= 15) {
      optimizedPrompt += ', smooth transitions, steady pacing';
    } else {
      optimizedPrompt += ', extended sequence, detailed storytelling';
    }

    // Add quality context
    switch (config.quality) {
      case 'standard':
        optimizedPrompt += ', good video quality';
        break;
      case 'high':
        optimizedPrompt += ', high-definition, crisp details';
        break;
      case 'ultra':
        optimizedPrompt += ', ultra-high-definition, professional cinematography';
        break;
    }

    return optimizedPrompt;
  }

  private optimizeAudioPrompt(
    query: string,
    config: { audioType: string; duration: number; quality: string },
  ): string {
    let optimizedPrompt = query;

    // Add audio type context
    switch (config.audioType) {
      case 'music':
        optimizedPrompt += ', musical composition, harmonious, melodic';
        break;
      case 'speech':
        optimizedPrompt += ', clear voice, natural speech, articulate';
        break;
      case 'sound_effect':
        optimizedPrompt += ', realistic sound effect, crisp audio';
        break;
      case 'ambient':
        optimizedPrompt += ', ambient soundscape, atmospheric, immersive';
        break;
    }

    // Add quality context
    switch (config.quality) {
      case 'standard':
        optimizedPrompt += ', good audio quality';
        break;
      case 'high':
        optimizedPrompt += ', high-fidelity audio, clear sound';
        break;
      case 'ultra':
        optimizedPrompt += ', studio-quality audio, professional recording';
        break;
    }

    return optimizedPrompt;
  }

  toRunnable(): Runnable<any, any> {
    const workflow = new StateGraph<BaseSkillState>({
      channels: this.graphState,
    }).addNode('generateMedia', this.generateMedia);

    workflow.addEdge(START, 'generateMedia');
    workflow.addEdge('generateMedia', END);

    return workflow.compile();
  }
}
