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

export interface FalImageParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export const FalImageToolsetDefinition: ToolsetDefinition = {
  key: 'fal_image',
  domain: 'https://fal.ai/',
  labelDict: {
    en: 'Image Generation',
    'zh-CN': '图像生成',
  },
  descriptionDict: {
    en: 'Generate or edit image, support Seedream（generate/edit）、Nano Banana（generate/edit） model.',
    'zh-CN': '生成或编辑图像，支持 Seedream（生成/编辑）、Nano Banana（生成/编辑） 模型。',
  },
  tools: [
    {
      name: 'seedream_generate_image',
      descriptionDict: {
        en: 'Generate image content with Seedream.',
        'zh-CN': '使用 Seedream 生成图像内容。',
      },
    },
    {
      name: 'seedream_edit_image',
      descriptionDict: {
        en: 'Edit image content with Seedream.',
        'zh-CN': '使用 Seedream 编辑图像内容。',
      },
    },
    {
      name: 'nano_banana_edit_image',
      descriptionDict: {
        en: 'Edit image content with Nano Banana.',
        'zh-CN': '使用 Nano Banana 编辑图像内容。',
      },
    },
    {
      name: 'nano_banana_generate_image',
      descriptionDict: {
        en: 'Generate image content with Nano Banana.',
        'zh-CN': '使用 Nano Banana 生成图像内容。',
      },
    },
  ],
};

export class SeedreamGenerateImage extends AgentBaseTool<FalImageParams> {
  name = 'seedream_generate_image';
  toolsetKey = FalImageToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate image, accept chinese and english.'),
    image_size: z
      .enum([
        'square',
        'square_hd',
        'portrait_4_3',
        'portrait_16_9',
        'landscape_4_3',
        'landscape_16_9',
      ])
      .describe('The size of the generated image. Width and height must be between 1024 and 4096.'),
  });

  description =
    'A new-generation image creation model ByteDance, Seedream 4.0 i2i integrates image edit capabilities into a single, unified architecture.';

  protected params: FalImageParams;

  constructor(params: FalImageParams) {
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
        mediaType: 'image',
        prompt: input.prompt,
        model: 'fal-ai/bytedance/seedream/v4/text-to-image',
        provider: 'fal',
        input,
        unitCost: 5,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated image with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating image',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating image',
      };
    }
  }
}

export class SeedreamEditImage extends AgentBaseTool<FalImageParams> {
  name = 'seedream_edit_image';
  toolsetKey = FalImageToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate image, accept chinese and english.'),
    image_size: z
      .enum([
        'square',
        'square_hd',
        'portrait_4_3',
        'portrait_16_9',
        'landscape_4_3',
        'landscape_16_9',
      ])
      .describe('The size of the generated image. Width and height must be between 1024 and 4096.'),
    image_urls: z
      .array(z.string())
      .describe(
        'List of URLs of input images for editing. Presently, up to 10 image inputs are allowed. If over 10 images are sent, only the last 10 will be used.',
      ),
  });

  description =
    'A new-generation image creation model ByteDance, Seedream 4.0 integrates image generation and image editing capabilities into a single, unified architecture.';

  protected params: FalImageParams;

  constructor(params: FalImageParams) {
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
      const image_urls = await reflyService.batchProcessURL(input.image_urls);
      const result = await reflyService.generateMedia(user, {
        mediaType: 'image',
        prompt: input.prompt,
        model: 'fal-ai/bytedance/seedream/v4/edit',
        provider: 'fal',
        input: {
          ...input,
          image_urls,
        },
        unitCost: 6,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated image with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating image',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating image',
      };
    }
  }
}

export class NanoBananaEditImage extends AgentBaseTool<FalImageParams> {
  name = 'nano_banana_edit_image';
  toolsetKey = FalImageToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to edit image, accept only english.'),
    image_urls: z.array(z.string()).describe('List of URLs of input images for editing.'),
  });

  description = "Google's state-of-the-art image generation and editing model";

  protected params: FalImageParams;

  constructor(params: FalImageParams) {
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
      const image_urls = await reflyService.batchProcessURL(input.image_urls);
      const result = await reflyService.generateMedia(user, {
        mediaType: 'image',
        prompt: input.prompt,
        model: 'fal-ai/nano-banana/edit',
        provider: 'fal',
        input: {
          ...input,
          image_urls,
        },
        unitCost: 6,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully edited image with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error editing image',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while editing image',
      };
    }
  }
}

export class NanoBananaGenerateImage extends AgentBaseTool<FalImageParams> {
  name = 'nano_banana_generate_image';
  toolsetKey = FalImageToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate image, accept only english.'),
  });

  description = "Google's state-of-the-art image generation and editing model";

  protected params: FalImageParams;

  constructor(params: FalImageParams) {
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
        mediaType: 'image',
        prompt: input.prompt,
        model: 'fal-ai/nano-banana',
        provider: 'fal',
        input,
        unitCost: 6,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated image with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating image',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating image',
      };
    }
  }
}

export class FalImageToolset extends AgentBaseToolset<FalImageParams> {
  toolsetKey = FalImageToolsetDefinition.key;
  tools = [
    SeedreamGenerateImage,
    SeedreamEditImage,
    NanoBananaEditImage,
    NanoBananaGenerateImage,
  ] satisfies readonly AgentToolConstructor<FalImageParams>[];
}
