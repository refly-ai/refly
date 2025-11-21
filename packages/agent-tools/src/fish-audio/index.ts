/**
 * DEPRECATED: This implementation is commented out.
 * FishAudio tools are now loaded from configuration using the adapter pattern.
 * See: apps/api/src/modules/tool/adapters/ for the new implementation.
 */

/*
import {
  User,
  ToolsetDefinition,
  FishAudioTextToSpeechRequest,
  FishAudioSpeechToTextRequest,
  FishAudioTextToSpeechResponse,
  FishAudioSpeechToTextResponse,
} from '@refly/openapi-schema';
import { ToolParams } from '@langchain/core/tools';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { z } from 'zod/v3';
import { RunnableConfig } from '@langchain/core/runnables';

export interface ReflyService {
  textToSpeech: (
    user: User,
    req: FishAudioTextToSpeechRequest,
  ) => Promise<FishAudioTextToSpeechResponse>;
  speechToText: (
    user: User,
    req: FishAudioSpeechToTextRequest,
  ) => Promise<FishAudioSpeechToTextResponse>;
}
export interface FishAudioParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export const FishAudioToolsetDefinition: ToolsetDefinition = {
  key: 'fish_audio',
  domain: 'https://fish.audio/',
  labelDict: {
    en: 'Fish Audio',
    'zh-CN': 'Fish 音频',
  },
  descriptionDict: {
    en: 'Voice cloning, text-to-speech, and speech-to-text powered by Fish Audio SDK',
    'zh-CN': '基于 Fish Audio SDK 的语音克隆、文本转语音和语音转文本',
  },
  tools: [
    {
      name: 'text_to_speech',
      descriptionDict: {
        en: 'Convert text to speech with voice cloning support',
        'zh-CN': '将文本转换为语音，支持语音克隆',
      },
    },
    {
      name: 'speech_to_text',
      descriptionDict: {
        en: 'Transcribe audio files to text',
        'zh-CN': '将音频文件转录为文本',
      },
    },
  ],
};

export class TextToSpeech extends AgentBaseTool<FishAudioParams> {
  name = 'text_to_speech';
  toolsetKey = FishAudioToolsetDefinition.key;

  schema = z.object({
    text: z.string().describe('The text content to convert to speech'),
    referenceId: z
      .string()
      .optional()
      .describe('Voice model ID to use for generation, leave empty unless user assigned'),
    referenceStorageKeys: z
      .array(z.string())
      .optional()
      .describe('Storage keys of reference audio files for voice cloning'),
    referenceTranscripts: z
      .array(z.string())
      .optional()
      .describe('Transcripts for reference audio files (same order as referenceStorageKeys)'),
    format: z
      .enum(['mp3', 'wav', 'opus', 'pcm'])
      .optional()
      .default('mp3')
      .describe('Output audio format'),
    chunkLength: z
      .number()
      .default(200)
      .optional()
      .describe('Characters per processing chunk (100-300)'),
    prosody: z
      .string()
      .optional()
      .describe('Prosody settings in SSML format to adjust speech characteristics'),
    temperature: z
      .number()
      .default(0.7)
      .optional()
      .describe('Generation randomness (0.0-1.0, default 0.7)'),
    topP: z
      .number()
      .default(0.7)
      .optional()
      .describe('Token diversity control (0.0-1.0, default 0.7)'),
  });

  description = `Convert text to speech using Fish Audio's voice cloning technology.
Supports voice cloning with reference audio, multiple output formats (mp3, wav, opus, pcm),
and emotional expression. Ideal for generating natural-sounding speech with custom voices.`;

  protected params: FishAudioParams;

  constructor(params: FishAudioParams) {
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
      // Check if Fish Audio service is available
      if (!reflyService) {
        return {
          status: 'error',
          error: 'Fish Audio service is not available',
          summary:
            'Fish Audio service is not configured. Please set FISH_AUDIO_API_KEY environment variable.',
        };
      }

      // Build references array if provided
      const references =
        input.referenceStorageKeys?.map((entityId, index) => ({
          entityId,
          text: input.referenceTranscripts?.[index],
        })) || [];

      const request: FishAudioTextToSpeechRequest = {
        mediaType: 'audio',
        prompt: input.text,
        text: input.text,
        referenceId: input.referenceId,
        references: references.length > 0 ? references : undefined,
        format: input.format || 'mp3',
        chunkLength: input.chunkLength,
        temperature: input.temperature,
        topP: input.topP,
        parentResultId: config.configurable?.resultId,
        parentResultVersion: config.configurable?.version,
      };
      const result = await reflyService.textToSpeech(user, request);
      if (result.status === 'success') {
        // Calculate credit cost based on audio duration
        // Fish Audio pricing: ~$0.02 per 1000 characters or ~$0.10 per minute
        let creditCost = 14; // fallback default (0.02 * 140 * 5 chars avg per word)
        if (result.data?.duration) {
          // $0.10 per minute * 140 credits per USD
          const minutes = result.data.duration / 60;
          const usdCost = minutes * 0.1;
          creditCost = Math.ceil(usdCost * 140);
        }

        const summary = `✅ **Result:**
🆔 Audio Entity ID: ${result?.data?.entityId} (Use this ID to reference this audio in other tools)
🔊 Audio URL: ${result?.data?.audioUrl}
⏱️ Duration: ${result?.data?.duration}s
📁 Format: ${result?.data?.format || input.format || 'mp3'}
💾 Size: ${result?.data?.size ? `${(result.data.size / 1024).toFixed(2)} KB` : 'N/A'}`;

        return {
          status: 'success',
          data: {
            audioUrl: result?.data?.audioUrl,
            storageKey: result?.data?.storageKey,
            entityId: result?.data?.entityId,
            duration: result?.data?.duration,
            format: result?.data?.format,
            size: result?.data?.size,
            parentResultId: config.configurable?.resultId,
            parentResultVersion: config.configurable?.version,
          },
          summary,
          creditCost,
        };
      }

      // Extract error messages from the response errors array
      const errorMessage =
        result.errors?.map((err) => `[${err.code}] ${err.message}`).join('; ') ||
        'Text-to-speech generation failed';

      return {
        status: 'error',
        error: errorMessage,
        summary: `❌ **Error:**\n${errorMessage}`,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error occurred while generating speech';
      return {
        status: 'error',
        error: 'Error generating speech',
        summary: `❌ **Error:**\n${errorMsg}`,
      };
    }
  }
}

export class SpeechToText extends AgentBaseTool<FishAudioParams> {
  name = 'speech_to_text';
  toolsetKey = FishAudioToolsetDefinition.key;

  schema = z.object({
    storageKey: z.string().describe('Storage key of the audio file to transcribe'),
    language: z
      .string()
      .optional()
      .describe('Language code (e.g., "en", "zh", "es"). Leave empty for auto-detection'),
    ignoreTimestamps: z
      .boolean()
      .optional()
      .describe('Skip timestamp processing for faster results'),
  });

  description = `Transcribe audio files to text using Fish Audio's speech recognition.
Supports multiple languages with auto-detection, returns timestamped segments, and handles
various audio formats (MP3, WAV, M4A, OGG, FLAC, AAC). Maximum file size: 100MB, duration: 60 minutes.`;

  protected params: FishAudioParams;

  constructor(params: FishAudioParams) {
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

      const request: FishAudioSpeechToTextRequest = {
        entityId: input.storageKey,
        language: input.language,
        ignoreTimestamps: input.ignoreTimestamps,
      };

      const result = await reflyService.speechToText(user, request);

      if (result.status === 'success') {
        // Calculate credit cost based on audio duration
        // Fish Audio STT pricing: ~$0.006 per minute
        let creditCost = 7; // fallback default (0.05 * 140)
        if (result.data?.duration) {
          // $0.006 per minute * 140 credits per USD
          const minutes = result.data.duration / 60;
          const usdCost = minutes * 0.006;
          creditCost = Math.ceil(usdCost * 140);
        }

        const transcriptionText = result?.data?.text ?? '';
        const textPreview =
          transcriptionText.length > 100
            ? `${transcriptionText.substring(0, 100)}...`
            : transcriptionText;

        // TODO: generate a product node
        const summary = `✅ **Result:**
📝 Transcription: ${textPreview}
⏱️ Duration: ${result?.data?.duration}s
🎙️ Segments: ${result?.data?.segments?.length || 0}`;

        return {
          status: 'success',
          data: {
            text: result?.data?.text,
            duration: result?.data?.duration,
            segments: result?.data?.segments,
            parentResultId: config.configurable?.resultId,
            parentResultVersion: config.configurable?.version,
          },
          summary,
          creditCost,
        };
      }

      // Extract error messages from the response errors array
      const errorMessage =
        result.errors?.map((err) => `[${err.code}] ${err.message}`).join('; ') ||
        'Speech-to-text transcription failed';

      return {
        status: 'error',
        error: errorMessage,
        summary: `❌ **Error:**\n${errorMessage}`,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error occurred while transcribing audio';
      return {
        status: 'error',
        error: 'Error transcribing audio',
        summary: `**Error:**\n${errorMsg}`,
      };
    }
  }
}

export class FishAudioToolset extends AgentBaseToolset<FishAudioParams> {
  toolsetKey = FishAudioToolsetDefinition.key;
  tools = [TextToSpeech, SpeechToText] satisfies readonly AgentToolConstructor<FishAudioParams>[];
}
*/
