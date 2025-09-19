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

export interface GenerateImageFalParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export const GenerateImageFalToolsetDefinition: ToolsetDefinition = {
  key: 'generate_image_fal',
  domain: 'https://fal.ai/',
  labelDict: {
    en: 'Generate Image with FAL',
    'zh-CN': '使用 FAL 生成图像',
  },
  descriptionDict: {
    en: 'Generate image content with FAL.',
    'zh-CN': '使用 FAL 生成图像内容。',
  },
  tools: [
    {
      name: 'generate_image_with_seedream_t2i_fal',
      descriptionDict: {
        en: 'Generate image content with Seedream.',
        'zh-CN': '使用 Seedream 生成图像内容。',
      },
    },
    {
      name: 'generate_image_with_seedream_i2i_fal',
      descriptionDict: {
        en: 'Edit image content with Seedream.',
        'zh-CN': '使用 Seedream 编辑图像内容。',
      },
    },
  ],
};

export class GenerateImageWithSeedreamT2IFal extends AgentBaseTool<GenerateImageFalParams> {
  name = 'generate_image_with_seedream_t2i_fal';
  toolsetKey = GenerateImageFalToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate image.accept chinese and english.'),
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

  protected params: GenerateImageFalParams;

  constructor(params: GenerateImageFalParams) {
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

export class GenerateImageWithSeedreamI2IFal extends AgentBaseTool<GenerateImageFalParams> {
  name = 'generate_image_with_seedream_i2i_fal';
  toolsetKey = GenerateImageFalToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate image.accept chinese and english.'),
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

  protected params: GenerateImageFalParams;

  constructor(params: GenerateImageFalParams) {
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

export class GenerateImageFalToolset extends AgentBaseToolset<GenerateImageFalParams> {
  toolsetKey = GenerateImageFalToolsetDefinition.key;
  tools = [
    GenerateImageWithSeedreamT2IFal,
    GenerateImageWithSeedreamI2IFal,
  ] satisfies readonly AgentToolConstructor<GenerateImageFalParams>[];
}
