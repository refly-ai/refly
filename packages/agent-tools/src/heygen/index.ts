/**
 * DEPRECATED: This implementation is commented out.
 * HeyGen tools are now loaded from configuration using the adapter pattern.
 * See: apps/api/src/modules/tool/adapters/ for the new implementation.
 */

/*
import {
  User,
  ToolsetDefinition,
  HeyGenGenerateVideoRequest,
  HeyGenGenerateVideoResponse,
} from '@refly/openapi-schema';
import { ToolParams } from '@langchain/core/tools';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { z } from 'zod/v3';
import { RunnableConfig } from '@langchain/core/runnables';

export interface ReflyService {
  generateVideo: (
    user: User,
    req: HeyGenGenerateVideoRequest,
  ) => Promise<HeyGenGenerateVideoResponse>;
}

export interface HeyGenParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export const HeyGenToolsetDefinition: ToolsetDefinition = {
  key: 'heygen',
  domain: 'https://heygen.com/',
  labelDict: {
    en: 'HeyGen',
    'zh-CN': 'HeyGen 视频生成',
  },
  descriptionDict: {
    en: 'AI avatar video generation powered by HeyGen API',
    'zh-CN': '基于 HeyGen API 的 AI 虚拟人视频生成',
  },
  tools: [
    {
      name: 'generate_video',
      descriptionDict: {
        en: 'Generate avatar video with AI characters',
        'zh-CN': '使用 AI 虚拟人生成视频',
      },
    },
  ],
};

export class GenerateVideo extends AgentBaseTool<HeyGenParams> {
  name = 'generate_video';
  toolsetKey = HeyGenToolsetDefinition.key;

  schema = z.object({
    scenes: z
      .array(
        z.object({
          character: z
            .object({
              avatarId: z
                .string()
                .optional()
                .describe(
                  'HeyGen avatar ID (e.g., "josh_lite3_20230714"). Optional - only provide if user explicitly specifies an avatar. This is NOT a file name or entityId. Get valid avatar IDs from HeyGen platform.',
                ),
              type: z
                .enum(['avatar', 'talking_photo'])
                .optional()
                .default('avatar')
                .describe(
                  'Character type: "avatar" for AI avatar, "talking_photo" for photo-based',
                ),
              avatarStyle: z
                .enum(['normal', 'circle', 'closeUp'])
                .optional()
                .default('normal')
                .describe('Avatar display style: "normal", "circle", or "closeUp"'),
              scale: z.number().min(0).max(5.0).optional().describe('Avatar scale (0-5.0)'),
              offset: z
                .object({
                  x: z.number().optional().describe('Horizontal offset in pixels'),
                  y: z.number().optional().describe('Vertical offset in pixels'),
                })
                .optional()
                .describe('Avatar position offset from default position'),
            })
            .optional()
            .describe(
              'AI character/avatar configuration. Optional - if not provided, only background and voice will be used.',
            ),
          voice: z.object({
            type: z
              .enum(['text', 'audio', 'silence'])
              .describe(
                'Voice type: "text" for text-to-speech, "audio" for pre-recorded audio, "silence" for no audio',
              ),
            voiceId: z
              .string()
              .optional()
              .describe('Voice ID for text-to-speech (required when type is "text")'),
            inputText: z
              .string()
              .optional()
              .describe('Text content to speak (required when type is "text")'),
            audioUrl: z
              .string()
              .optional()
              .describe(
                'Direct HTTP/HTTPS URL to audio file (used when type is "audio", lowest priority)',
              ),
            storageKey: z
              .string()
              .optional()
              .describe(
                'Storage key of the audio file (format: "static/{uuid}"). CRITICAL: You MUST copy the exact "Storage Key" value from the context\'s "Media Items" section - DO NOT construct or modify this value. Takes priority over audioUrl when type is "audio".',
              ),
            speed: z
              .number()
              .min(0.5)
              .max(1.5)
              .optional()
              .describe('Speech speed multiplier (0.5-1.5, default 1.0)'),
            pitch: z
              .number()
              .min(-50)
              .max(50)
              .optional()
              .describe('Voice pitch adjustment (-50 to 50, default 0)'),
            emotion: z.string().optional().describe('Voice emotion/tone (if supported by voice)'),
          }),
          background: z
            .object({
              type: z
                .enum(['color', 'image', 'video'])
                .describe(
                  'Background type: "color" for solid color, "image" for static image, "video" for video background',
                ),
              url: z
                .string()
                .optional()
                .describe('Direct HTTP/HTTPS URL to background image/video file (lowest priority)'),
              storageKey: z
                .string()
                .optional()
                .describe(
                  'Storage key of the background file (format: "static/{uuid}"). CRITICAL: You MUST copy the exact storageKey from context\'s resources metadata - DO NOT construct or modify this value. Takes priority over url.',
                ),
              color: z
                .string()
                .optional()
                .describe(
                  'Background color in hex format (e.g., "#f6f6fc") - only used when type is "color"',
                ),
              playStyle: z
                .enum(['freeze', 'loop', 'fit_to_scene', 'once'])
                .optional()
                .default('fit_to_scene')
                .describe(
                  'Video playback mode (only for type "video"): "freeze" - freeze first frame, "loop" - loop video, "fit_to_scene" - fit video duration to scene, "once" - play once. Default: "fit_to_scene"',
                ),
            })
            .optional()
            .describe(
              'Background configuration. Use this to set custom video/image backgrounds or solid colors. If not provided, uses default HeyGen background.',
            ),
        }),
      )
      .min(1)
      .max(50)
      .describe(
        'Array of video scenes (1-50 items). Each scene represents a segment of the final video with its own character, voice, and background.',
      ),
    dimension: z
      .object({
        width: z.number().default(720).describe('Video width in pixels (default: 720)'),
        height: z.number().default(480).describe('Video height in pixels (default: 480)'),
      })
      .optional()
      .default({ width: 720, height: 480 })
      .describe(
        'Video dimensions (resolution). Default is 720x480 (low quality, faster generation). Common options: 720x480 (SD), 1280x720 (HD), 1920x1080 (Full HD). Higher resolution = longer generation time and higher cost.',
      ),
    aspectRatio: z
      .string()
      .optional()
      .describe(
        'Video aspect ratio (e.g., "16:9" for landscape, "9:16" for portrait, "1:1" for square). If not specified, uses dimension ratio.',
      ),
    test: z
      .boolean()
      .optional()
      .default(false)
      .describe('Test mode (adds watermark, faster generation)'),
    title: z.string().optional().describe('Video title'),
    caption: z.boolean().optional().default(false).describe('Add captions to video'),
    waitForCompletion: z
      .boolean()
      .optional()
      .default(false)
      .describe('Wait for video generation to complete (may take several minutes)'),
  });

  description = `Generate AI avatar videos using HeyGen's video generation API.
Supports multiple avatars, custom voices, text-to-speech, backgrounds, and scene composition.
Returns a video ID that can be used to check generation status or download the completed video.

CRITICAL: USING FILES FROM CONTEXT
When using audio or video files from context, you MUST use storageKey:

For AUDIO files (from "Media Items" section):
1. Find the audio file in context under "## Media Items"
2. Copy the EXACT "Storage Key" value (format: "static/{uuid}.mp3")
3. Use it in voice.storageKey - DO NOT modify, construct, or guess this value

For VIDEO/IMAGE background files (from "Knowledge Base Resources" section):
1. Find the video/image resource in context under "## Knowledge Base Resources"
2. Look for the "metadata" object which contains "storageKey"
3. Copy the EXACT storageKey value (format: "static/{uuid}.mp4")
4. Use it in background.storageKey - DO NOT modify, construct, or guess this value

IMPORTANT FIELD DESCRIPTIONS:

1. character.avatarId:
   - This is a HeyGen platform avatar ID (e.g., "josh_lite3_20230714")
   - It is NOT a file name, NOT a video file, NOT a resource ID
   - Get valid avatar IDs from HeyGen's avatar library
   - If you don't have a valid HeyGen avatar ID, make character optional

2. voice.storageKey (for audio from context):
   - MUST be copied exactly from context's "Media Items" → "Storage Key" field or "Knowledge Base Resources" → metadata → "storageKey"
   - Format: "static/{uuid}.mp3" (e.g., "static/873cd95c-5340-4bd6-b621-da2bc48457f8.mp3")
   - DO NOT construct, guess, or modify this value
   - Priority: storageKey > audioUrl

3. background.storageKey (for video/image from context):
   - MUST be copied exactly from context's "Knowledge Base Resources" → metadata → "storageKey" field or context's "Media Items" → "Storage Key" field
   - Format: "static/{uuid}.mp4" or "static/{uuid}.jpg"
   - DO NOT construct, guess, or modify this value
   - Priority: storageKey > url

Use cases:
- Creating spokesperson videos with AI avatars
- Generating educational content with virtual instructors
- Producing marketing videos with customizable characters
- Building automated video content pipelines
- Adding AI narration to existing video footage`;

  protected params: HeyGenParams;

  constructor(params: HeyGenParams) {
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

      console.log('[HeyGen Tool] _call invoked with input:', JSON.stringify(input, null, 2));
      console.log(
        '[HeyGen Tool] config.configurable:',
        JSON.stringify(config.configurable, null, 2),
      );

      if (!reflyService) {
        return {
          status: 'error',
          error: 'HeyGen service is not available',
          summary:
            'HeyGen service is not configured. Please set HEYGEN_API_KEY environment variable.',
        };
      }

      const scenes: HeyGenGenerateVideoRequest['scenes'] = input.scenes.map((scene, index) => {
        const { character, voice, background } = scene;
        if (!voice) {
          throw new Error(`Scene #${index + 1} is missing voice configuration`);
        }

        console.log(`[HeyGen Tool] Scene #${index + 1} voice configuration:`, {
          type: voice.type,
          storageKey: voice.storageKey,
          audioUrl: voice.audioUrl,
          hasStorageKey: !!voice.storageKey,
        });

        const normalizedScene: HeyGenGenerateVideoRequest['scenes'][number] = {
          voice: {
            type: voice.type ?? 'text',
            ...(voice.type === 'text' && {
              voiceId: voice.voiceId,
              inputText: voice.inputText,
            }),
            ...(voice.type === 'audio' && {
              audioUrl: voice.audioUrl,
              storageKey: voice.storageKey, // Storage key takes priority over audioUrl
            }),
            ...(voice.speed != null && { speed: voice.speed }),
            ...(voice.pitch != null && { pitch: voice.pitch }),
            ...(voice.emotion && { emotion: voice.emotion }),
          },
        };

        console.log(`[HeyGen Tool] Scene #${index + 1} normalized voice:`, normalizedScene.voice);

        if (character) {
          if (!character.avatarId) {
            throw new Error(`Scene #${index + 1} character is missing avatarId`);
          }

          normalizedScene.character = {
            ...character,
            avatarId: character.avatarId,
          };
        }
        if (background) {
          normalizedScene.background = background;
        }

        return normalizedScene;
      });

      // Build request
      const request: HeyGenGenerateVideoRequest = {
        scenes,
        ...(input.dimension && { dimension: input.dimension }),
        ...(input.aspectRatio && { aspectRatio: input.aspectRatio }),
        ...(input.test != null && { test: input.test }),
        ...(input.title && { title: input.title }),
        ...(input.caption != null && { caption: input.caption }),
        ...(input.waitForCompletion != null && { waitForCompletion: input.waitForCompletion }),
        parentResultId: config.configurable?.resultId,
      };

      // Generate video
      const result = await reflyService.generateVideo(user, request);

      if (result.status !== 'success') {
        const errorMessage =
          result.errors?.map((err) => `[${err.code}] ${err.message}`).join('; ') ||
          'Video generation failed';

        return {
          status: 'error',
          error: errorMessage,
          summary: `❌ **Error:**\n${errorMessage}`,
        };
      }
      const videoUrl = result.data?.videoUrl;

      // Calculate credit cost based on video duration
      // HeyGen pricing: $1.00 per minute = 140 credits per minute (100x base + 40% markup)
      let creditCost = 140; // fallback default (1 minute)
      if (result.data?.duration) {
        const minutes = Math.ceil(result.data.duration / 60);
        creditCost = minutes * 140;
      }

      const summary = `✅ **Video Generated Successfully!**
📹 Video URL: ${videoUrl}
⏱️ Duration: ${result.data?.duration || 'N/A'}s
🖼️ Thumbnail: ${result.data?.thumbnailUrl || 'N/A'}`;

      return {
        status: 'success',
        data: {
          videoId: result.data?.videoId,
          status: 'completed',
          videoUrl,
          thumbnailUrl: result.data?.thumbnailUrl,
          duration: result.data?.duration,
          parentResultId: config.configurable?.resultId,
          parentResultVersion: config.configurable?.version,
        },
        summary,
        creditCost,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error occurred while generating video';
      return {
        status: 'error',
        error: 'Error generating video',
        summary: `❌ **Error:**\n${errorMsg}`,
      };
    }
  }
}

export class HeyGenToolset extends AgentBaseToolset<HeyGenParams> {
  toolsetKey = HeyGenToolsetDefinition.key;
  tools = [GenerateVideo] satisfies readonly AgentToolConstructor<HeyGenParams>[];
}
*/
