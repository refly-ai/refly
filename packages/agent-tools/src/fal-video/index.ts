import {
  User,
  MediaGenerateRequest,
  MediaGenerateResponse,
  ToolsetDefinition,
} from '@refly/openapi-schema';
import { ToolParams } from '@langchain/core/tools';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';

export interface ReflyService {
  generateMedia: (user: User, req: MediaGenerateRequest) => Promise<MediaGenerateResponse>;
  processURL: (url: string) => Promise<string>;
  batchProcessURL: (urls: string[]) => Promise<string[]>;
}

export interface FalVideoParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export const FalVideoToolsetDefinition: ToolsetDefinition = {
  key: 'fal_video',
  domain: 'https://fal.ai/',
  labelDict: {
    en: 'Video Generation',
    'zh-CN': '视频生成',
  },
  descriptionDict: {
    en: 'Generate or edit video, support Seedance、Veo3、Kling、Wan multiple video models.',
    'zh-CN': '生成或编辑视频，支持 Seedance、Veo3、Kling、Wan 多种视频模型。',
  },
  tools: [
    {
      name: 'seedance_generate_video',
      descriptionDict: {
        en: 'Generate video content from text with Seedance.',
        'zh-CN': '使用 Seedance 从文本生成视频内容。',
      },
    },
    {
      name: 'seedance_refrence_video',
      descriptionDict: {
        en: 'Generate video content from image with Seedance.',
        'zh-CN': '使用 Seedance 从图片生成视频内容。',
      },
    },
    {
      name: 'veo3_generate_video',
      descriptionDict: {
        en: 'Generate video content from text with Veo 3.',
        'zh-CN': '使用 Veo 3 生成视频内容。',
      },
    },
    {
      name: 'veo3_fast_generate_video',
      descriptionDict: {
        en: 'Generate video content from text with Veo 3 Fast.',
        'zh-CN': '使用 Veo 3 Fast 生成视频内容。',
      },
    },
    {
      name: 'veo3_refrence_video',
      descriptionDict: {
        en: 'Generate video content from image with Veo 3.',
        'zh-CN': '使用 Veo 3 从图片生成视频内容。',
      },
    },
    {
      name: 'veo3_fast_refrence_video',
      descriptionDict: {
        en: 'Generate video content from image with Veo 3 Fast.',
        'zh-CN': '使用 Veo 3 Fast 从图片生成视频内容。',
      },
    },
    {
      name: 'kling_generate_video',
      descriptionDict: {
        en: 'Generate video content from text with Kling.',
        'zh-CN': '使用 Kling 生成视频内容。',
      },
    },
    {
      name: 'kling_refrence_video',
      descriptionDict: {
        en: 'Generate video content from image with Kling.',
        'zh-CN': '使用 Kling 从图片生成视频内容。',
      },
    },
    {
      name: 'wan_generate_video',
      descriptionDict: {
        en: 'Generate video content from text with Wan.',
        'zh-CN': '使用 Wan 生成视频内容。',
      },
    },
    {
      name: 'wan_refrence_video',
      descriptionDict: {
        en: 'Generate video content from image with Wan.',
        'zh-CN': '使用 Wan 从图片生成视频内容。',
      },
    },
    {
      name: 'wan_edit_video',
      descriptionDict: {
        en: 'Edit video content with Wan.',
        'zh-CN': '使用 Wan 编辑视频内容。',
      },
    },
  ],
};

export class SeedanceGenerateVideo extends AgentBaseTool<FalVideoParams> {
  name = 'seedance_generate_video';
  toolsetKey = FalVideoToolsetDefinition.key;

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

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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

export class SeedanceRefrenceVideo extends AgentBaseTool<FalVideoParams> {
  name = 'seedance_refrence_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video.accept chinese and english.'),
    image_url: z.string().describe('The URL of the input image.'),
    aspect_ratio: z
      .enum(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'auto'])
      .default('auto')
      .describe('The aspect ratio of the generated video Default value: "auto"'),
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

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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

export class Veo3GenerateVideo extends AgentBaseTool<FalVideoParams> {
  name = 'veo3_generate_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video, accept only english.'),
    negative_prompt: z
      .string()
      .describe('The negative prompt to generate video, accept only english.'),
    enhance_prompt: z
      .boolean()
      .default(true)
      .describe('Whether to enhance the video generation Default value: true'),
    aspect_ratio: z
      .enum(['16:9', '9:16', '1:1'])
      .default('16:9')
      .describe(
        'The aspect ratio of the generated video. If it is set to 1:1, the video will be outpainted. Default value: "16:9""',
      ),
    resolution: z
      .enum(['720p', '1080p'])
      .default('720p')
      .describe('The resolution of the generated video Default value: "720p"'),
    duration: z
      .enum(['4s', '6s', '8s'])
      .default('8s')
      .describe('The duration of the generated video in seconds Default value: "8s"'),
    auto_fix: z
      .boolean()
      .default(true)
      .describe(
        'Whether to automatically attempt to fix prompts that fail content policy or other validation checks by rewriting them Default value: true',
      ),
    generate_audio: z
      .boolean()
      .default(true)
      .describe(
        'Whether to generate audio for the video. If false, %33 less credits will be used. Default value: true',
      ),
  });

  description =
    'Veo 3 by Google, the most advanced AI video generation model in the world. With sound on!';

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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
        model: 'fal-ai/veo3',
        provider: 'fal',
        input,
        unitCost: 840,
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

export class Veo3FastGenerateVideo extends AgentBaseTool<FalVideoParams> {
  name = 'veo3_fast_generate_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video, accept only english.'),
    negative_prompt: z
      .string()
      .describe('The negative prompt to generate video, accept only english.'),
    enhance_prompt: z
      .boolean()
      .default(true)
      .describe('Whether to enhance the video generation Default value: true'),
    aspect_ratio: z
      .enum(['16:9', '9:16', '1:1'])
      .default('16:9')
      .describe(
        'The aspect ratio of the generated video. If it is set to 1:1, the video will be outpainted. Default value: "16:9""',
      ),
    resolution: z
      .enum(['720p', '1080p'])
      .default('720p')
      .describe('The resolution of the generated video Default value: "720p"'),
    duration: z
      .enum(['4s', '6s', '8s'])
      .default('8s')
      .describe('The duration of the generated video in seconds Default value: "8s"'),
    auto_fix: z
      .boolean()
      .default(true)
      .describe(
        'Whether to automatically attempt to fix prompts that fail content policy or other validation checks by rewriting them Default value: true',
      ),
    generate_audio: z
      .boolean()
      .default(true)
      .describe(
        'Whether to generate audio for the video. If false, %33 less credits will be used. Default value: true',
      ),
  });

  description =
    'Veo 3 Fast by Google, the fastest video generation model in the world. With sound on!';

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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
        model: 'fal-ai/veo3/fast',
        provider: 'fal',
        input,
        unitCost: 448,
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

export class Veo3RefrenceVideo extends AgentBaseTool<FalVideoParams> {
  name = 'veo3_refrence_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video, accept only english.'),
    image_url: z.string().describe('The URL of the input image.'),
    aspect_ratio: z
      .enum(['16:9', '9:16', '1:1'])
      .default('16:9')
      .describe(
        'The aspect ratio of the generated video. If it is set to 1:1, the video will be outpainted. Default value: "16:9""',
      ),
    resolution: z
      .enum(['auto', '720p', '1080p'])
      .default('auto')
      .describe('The resolution of the generated video Default value: "auto"'),
    generate_audio: z
      .boolean()
      .default(true)
      .describe(
        'Whether to generate audio for the video. If false, %33 less credits will be used. Default value: true',
      ),
  });

  description = 'Veo 3 is the latest state-of-the art video generation model from Google DeepMind';

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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
        model: 'fal-ai/veo3/image-to-video',
        provider: 'fal',
        input: {
          ...input,
          image_url,
        },
        unitCost: 840,
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

export class Veo3FastRefrenceVideo extends AgentBaseTool<FalVideoParams> {
  name = 'veo3_fast_refrence_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video, accept only english.'),
    image_url: z.string().describe('The URL of the input image.'),
  });

  description =
    'Veo 3 Fast is the latest state-of-the art video generation model from Google DeepMind';

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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
        model: 'fal-ai/veo3/fast/image-to-video',
        provider: 'fal',
        input: {
          ...input,
          image_url,
        },
        unitCost: 448,
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

export class KlingGenerateVideo extends AgentBaseTool<FalVideoParams> {
  name = 'kling_generate_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video, accept chinese and english.'),
    duration: z
      .enum(['5', '10'])
      .default('5')
      .describe('The duration of the generated video in seconds Default value: "5"'),
    aspect_ratio: z
      .enum(['16:9', '9:16', '1:1'])
      .default('16:9')
      .describe(
        'The aspect ratio of the generated video. If it is set to 1:1, the video will be outpainted. Default value: "16:9""',
      ),
    negative_prompt: z
      .string()
      .describe('The negative prompt to generate video, accept chinese and english.'),
    cfg_scale: z
      .number()
      .max(1)
      .min(0)
      .default(0.5)
      .describe(
        'The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt. Default value: 0.5',
      ),
  });

  description =
    'Kling 2.1 Master: The premium endpoint for Kling 2.1, designed for top-tier image-to-video generation with unparalleled motion fluidity, cinematic visuals, and exceptional prompt precision.';

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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
        model: 'fal-ai/kling-video/v2.1/master/text-to-video',
        provider: 'fal',
        input,
        unitCost: 140,
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

export class KlingRefrenceVideo extends AgentBaseTool<FalVideoParams> {
  name = 'kling_refrence_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video, accept chinese and english.'),
    image_url: z.string().describe('The URL of the input image.'),
    duration: z
      .enum(['5', '10'])
      .default('5')
      .describe('The duration of the generated video in seconds Default value: "5"'),
    negative_prompt: z
      .string()
      .describe('The negative prompt to generate video, accept chinese and english.'),
    cfg_scale: z
      .number()
      .max(1)
      .min(0)
      .default(0.5)
      .describe(
        'The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt. Default value: 0.5',
      ),
  });

  description =
    'Kling 2.1 Master: The premium endpoint for Kling 2.1, designed for top-tier image-to-video generation with unparalleled motion fluidity, cinematic visuals, and exceptional prompt precision.';

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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
        model: 'fal-ai/kling-video/v2.1/master/image-to-video',
        provider: 'fal',
        input: {
          ...input,
          image_url,
        },
        unitCost: 140,
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

export class WanGenerateVideo extends AgentBaseTool<FalVideoParams> {
  name = 'wan_generate_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video, accept chinese and english.'),
    negative_prompt: z
      .string()
      .describe('The negative prompt to generate video, accept chinese and english.'),
    resolution: z
      .enum(['auto', '480p', '580p', '720p'])
      .default('auto')
      .describe(
        'Resolution of the generated video (auto, 480p, 580p, or 720p). Default value: "auto"',
      ),
    aspect_ratio: z
      .enum(['16:9', '9:16', '1:1'])
      .default('16:9')
      .describe('Aspect ratio of the generated video (16:9 or 9:16 or 1:1). Default value: "16:9"'),
  });

  description =
    'Wan-2.2 text-to-video is a video model that generates high-quality videos with high visual quality and motion diversity from text prompts.';

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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
        model: 'fal-ai/wan/v2.2-a14b/text-to-video',
        provider: 'fal',
        input,
        unitCost: 40,
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

export class WanRefrenceVideo extends AgentBaseTool<FalVideoParams> {
  name = 'wan_refrence_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video, accept chinese and english.'),
    image_url: z.string().describe('The URL of the input image.'),
    end_image_url: z.string().optional().describe('The URL of the end image.'),
    aspect_ratio: z
      .enum(['16:9', '9:16', '1:1'])
      .default('16:9')
      .describe('Aspect ratio of the generated video (16:9 or 9:16 or 1:1). Default value: "16:9"'),
    resolution: z
      .enum(['auto', '480p', '580p', '720p'])
      .default('auto')
      .describe(
        'Resolution of the generated video (auto, 480p, 580p, or 720p). Default value: "auto"',
      ),
    negative_prompt: z
      .string()
      .describe('The negative prompt to generate video, accept chinese and english.'),
  });

  description =
    'Wan-2.2 image-to-video is a video model that generates high-quality videos with high visual quality and motion diversity from image prompts.';

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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
      const inputObject: Record<string, any> = {};
      inputObject.prompt = input.prompt;
      inputObject.image_url = image_url;
      if (input.end_image_url) {
        inputObject.end_image_url = await reflyService.processURL(input.end_image_url);
      }

      const result = await reflyService.generateMedia(user, {
        mediaType: 'video',
        prompt: input.prompt,
        model: 'fal-ai/wan/v2.2-a14b/image-to-video',
        provider: 'fal',
        input: inputObject,
        unitCost: 40,
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

export class WanEditVideo extends AgentBaseTool<FalVideoParams> {
  name = 'wan_edit_video';
  toolsetKey = FalVideoToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate video, accept chinese and english.'),
    video_url: z.string().describe('The URL of the input video.'),
  });

  description =
    'Wan-2.2 video-to-video is a video model that generates high-quality videos with high visual quality and motion diversity from text prompts and source videos.';

  protected params: FalVideoParams;

  constructor(params: FalVideoParams) {
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
      input.video_url = await reflyService.processURL(input.video_url);
      const result = await reflyService.generateMedia(user, {
        mediaType: 'video',
        prompt: input.prompt,
        model: 'fal-ai/wan/v2.2-a14b/video-to-video',
        provider: 'fal',
        input,
        unitCost: 40,
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

export class FalVideoToolset extends AgentBaseToolset<FalVideoParams> {
  toolsetKey = FalVideoToolsetDefinition.key;
  tools = [
    SeedanceGenerateVideo,
    SeedanceRefrenceVideo,
    Veo3GenerateVideo,
    Veo3FastGenerateVideo,
    Veo3RefrenceVideo,
    Veo3FastRefrenceVideo,
    KlingGenerateVideo,
    KlingRefrenceVideo,
    WanGenerateVideo,
    WanRefrenceVideo,
    WanEditVideo,
  ] satisfies readonly AgentToolConstructor<FalVideoParams>[];
}
