import {
  User,
  MediaGenerateRequest,
  MediaGenerateResponse,
  ToolsetDefinition,
} from '@refly/openapi-schema';
import { ToolParams } from '@langchain/core/tools';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { z } from 'zod/v3';
import { RunnableConfig } from '@langchain/core/runnables';

export interface ReflyService {
  generateMedia: (user: User, req: MediaGenerateRequest) => Promise<MediaGenerateResponse>;
  processURL: (url: string) => Promise<string>;
  batchProcessURL: (urls: string[]) => Promise<string[]>;
}

export interface GenerateVideoFalParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export const GenerateVideoFalToolsetDefinition: ToolsetDefinition = {
  key: 'generate_video_fal',
  domain: 'https://fal.ai/',
  labelDict: {
    en: 'Generate Video with FAL',
    'zh-CN': '使用 FAL 生成视频',
  },
  descriptionDict: {
    en: 'Generate video content with FAL.',
    'zh-CN': '使用 FAL 生成视频内容。',
  },
  tools: [
    {
      name: 'generate_video_with_seedance_t2v_fal',
      descriptionDict: {
        en: 'Seedance 1.0 Pro text to video, a high quality video generation model developed by Bytedance.',
        'zh-CN': '使用 Seedance 从文本生成视频内容。',
      },
    },
    {
      name: 'generate_video_with_seedance_i2v_fal',
      descriptionDict: {
        en: 'Seedance 1.0 Pro image to video, a high quality video generation model developed by Bytedance.',
        'zh-CN': '使用 Seedance 从图片生成视频内容。',
      },
    },
  ],
};

export class GenerateVideoWithSeedanceT2VFal extends AgentBaseTool<GenerateVideoFalParams> {
  name = 'generate_video_with_seedance_t2v_fal';
  toolsetKey = GenerateVideoFalToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video.accept chinese and english.'),
    aspect_ratio: z
      .enum(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'])
      .default('16:9')
      .describe('The aspect ratio of the generated video Default value: "16:9"'),
    resolution: z
      .enum(['480p', '720p', '1080p'])
      .describe(
        'Video resolution - 480p for faster generation, 720p for balance, 1080p for higher quality Default value: "1080p"',
      ),
    duration: z
      .enum(['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
      .default('5')
      .describe('Duration of the video in seconds Default value: "5"'),
    camera_fixed: z
      .boolean()
      .optional()
      .describe('Whether to fix the camera position Default value: "false"'),
  });

  description =
    'A new-generation image creation model ByteDance, Seedream 4.0 i2i integrates image edit capabilities into a single, unified architecture.';

  protected params: GenerateVideoFalParams;

  constructor(params: GenerateVideoFalParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: any,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.generateMedia(user, {
        mediaType: 'video',
        prompt: input.prompt,
        model: 'fal-ai/bytedance/seedance/v1/pro/text-to-video',
        provider: 'fal',
        input,
        unitCost: 62,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated video with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating video',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating video',
      };
    }
  }
}

export class GenerateVideoWithSeedanceI2VFal extends AgentBaseTool<GenerateVideoFalParams> {
  name = 'generate_video_with_seedance_i2v_fal';
  toolsetKey = GenerateVideoFalToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video.accept chinese and english.'),
    image_url: z.string().describe('The URL of the input image.'),
    aspect_ratio: z
      .enum(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'])
      .default('16:9')
      .describe('The aspect ratio of the generated video Default value: "16:9"'),
    resolution: z
      .enum(['480p', '720p', '1080p'])
      .describe(
        'Video resolution - 480p for faster generation, 720p for balance, 1080p for higher quality Default value: "1080p"',
      ),
    duration: z
      .enum(['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
      .default('5')
      .describe('Duration of the video in seconds Default value: "5"'),
    camera_fixed: z
      .boolean()
      .optional()
      .describe('Whether to fix the camera position Default value: "false"'),
  });

  description =
    'A new-generation image creation model ByteDance, Seedream 4.0 integrates image generation and image editing capabilities into a single, unified architecture.';

  protected params: GenerateVideoFalParams;

  constructor(params: GenerateVideoFalParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: any,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const image_url = await reflyService.processURL(input.image_url);
      const result = await reflyService.generateMedia(user, {
        mediaType: 'video',
        prompt: input.prompt,
        model: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
        provider: 'fal',
        input: {
          ...input,
          image_url,
        },
        unitCost: 62,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated video with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating video',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating video',
      };
    }
  }
}

export class GenerateVideoFalToolset extends AgentBaseToolset<GenerateVideoFalParams> {
  toolsetKey = GenerateVideoFalToolsetDefinition.key;
  tools = [
    GenerateVideoWithSeedanceT2VFal,
    GenerateVideoWithSeedanceI2VFal,
  ] satisfies readonly AgentToolConstructor<GenerateVideoFalParams>[];
}
