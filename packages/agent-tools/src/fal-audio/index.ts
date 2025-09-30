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
}

export interface FalAudioParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export const FalAudioToolsetDefinition: ToolsetDefinition = {
  key: 'fal_audio',
  domain: 'https://fal.ai/',
  labelDict: {
    en: 'Audio Generation',
    'zh-CN': '音频生成',
  },
  descriptionDict: {
    en: 'Generate high-quality speech and voiceover, support VibeVoice、ElevenLabs Dialogue、MiniMax Speech model.',
    'zh-CN': '生成高质量语音与配音，支持 VibeVoice、ElevenLabs Dialogue、MiniMax Speech 模型。',
  },
  tools: [
    {
      name: 'vibevoice_generate_audio',
      descriptionDict: {
        en: "Generate long, expressive multi-voice speech using Microsoft's powerful TTS.",
        'zh-CN': '使用 Microsoft 的强大 TTS 生成长、表达性的多语音演讲。',
      },
    },
    {
      name: 'elevenlabs_dialogue_generate_audio',
      descriptionDict: {
        en: 'Generate realistic audio dialogues using Eleven-v3 from ElevenLabs.',
        'zh-CN': '使用 ElevenLabs 的 Eleven-v3 生成真实的音频对话。',
      },
    },
    {
      name: 'minimax_speech_generate_audio',
      descriptionDict: {
        en: 'Generate fast speech from text prompts and different voices using the MiniMax Speech-02 Turbo model, which leverages advanced AI techniques to create high-quality text-to-speech.',
        'zh-CN': '使用 Minimax 的 Minimax Speech-02 Turbo 模型生成快速语音。',
      },
    },
  ],
};

export class VibeVoiceGenerateAudio extends AgentBaseTool<FalAudioParams> {
  name = 'vibevoice_generate_audio';
  toolsetKey = FalAudioToolsetDefinition.key;

  schema = z.object({
    script: z
      .string()
      .describe(
        "The script to convert to speech up to 25 minutes. You can use it to generate a whole podcast without splitting it into segments. Can be formatted with 'Speaker X:' prefixes for multi-speaker dialogues. supports up to four speakers at once, match the speakers and speaker's language. example: \"Speaker 0: VibeVoice is now available on Fal. Isn't that right, Carter?\nSpeaker 1: That's right Frank, and it supports up to four speakers at once. Try it now!\"",
      ),
    speakers: z
      .array(
        z.object({
          preset: z
            .enum([
              'Alice [EN]',
              'Carter [EN]',
              'Frank [EN]',
              'Mary [EN] (Background Music)',
              'Maya [EN]',
              'Anchen [ZH] (Background Music)',
              'Bowen [ZH]',
              'Xinran [ZH]',
            ])
            .describe('Preset of the speaker, match the speakers and language in the script'),
        }),
      )
      .describe(
        'List of speakers to use for the script. If not provided, will be inferred from the script or voice samples. supports up to four speakers at once, example: [{ preset: "Alice [EN]" }, { preset: "Carter [EN]" }]',
      ),
    cfg_scale: z
      .number()
      .describe(
        'CFG (Classifier-Free Guidance) scale for generation. Higher values increase adherence to text. Default value: 1.3',
      )
      .default(1.3),
  });

  description =
    "Generate long, expressive multi-voice speech using Microsoft's powerful TTS.You can use it to generate a whole podcast without splitting it into segments.";

  protected params: FalAudioParams;

  constructor(params: FalAudioParams) {
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
        mediaType: 'audio',
        prompt: input.script,
        model: 'fal-ai/vibevoice/7b',
        provider: 'fal',
        input,
        unitCost: 140,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated audio with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating media',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating media',
      };
    }
  }
}

export class ElevenLabsDialogueGenerateAudio extends AgentBaseTool<FalAudioParams> {
  name = 'elevenlabs_dialogue_generate_audio';
  toolsetKey = FalAudioToolsetDefinition.key;

  schema = z.object({
    inputs: z
      .array(
        z.object({
          text: z
            .string()
            .describe(
              'Text to convert to speech example1: "[applause] Thank you all for coming tonight! Today we have a very special guest with us. " example2: "[gulps] ... [strong canadian accent] [excited] Hello everyone! Thank you all for having me tonight on this special day. "',
            ),
          voice: z
            .enum([
              'Aria',
              'Charlotte',
              'Roger',
              'Sarah',
              'Laura',
              'Charlie',
              'George',
              'Callum',
              'River',
              'Liam',
              'Alice',
              'Matilda',
              'Will',
              'Jessica',
              'Eric',
              'Chris',
              'Brian',
              'Daniel',
              'Lily',
              'Bill',
            ])
            .describe('The name of the voice to be used for the generation.'),
        }),
      )
      .describe(
        'A list of dialogue inputs, each containing text and a voice ID which will be converted into speech. example: ["{"text": "[applause] Thank you all for coming tonight! Today we have a very special guest with us.","voice": "Aria"},{"text": "[gulps] ... [strong canadian accent] [excited] Hello everyone! Thank you all for having me tonight on this special day.","voice": "Charlotte"}] ',
      ),
  });

  description =
    'Generate realistic audio dialogues using Eleven-v3 from ElevenLabs. You can use it to generate a whole podcast without splitting it into segments.';

  protected params: FalAudioParams;

  constructor(params: FalAudioParams) {
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
        mediaType: 'audio',
        prompt: '',
        model: 'fal-ai/elevenlabs/text-to-dialogue/eleven-v3',
        provider: 'fal',
        input,
        unitCost: 70,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated audio with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating media',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating media',
      };
    }
  }
}

export class MinimaxSpeechGenerateAudio extends AgentBaseTool<FalAudioParams> {
  name = 'minimax_speech_generate_audio';
  toolsetKey = FalAudioToolsetDefinition.key;

  schema = z.object({
    text: z
      .string()
      .describe(
        'Text to convert to speech (max 5000 characters, minimum 1 non-whitespace character)',
      ),
    voice_setting: z
      .object({
        voice_id: z
          .enum([
            'Wise_Woman',
            'Friendly_Person',
            'Inspirational_girl',
            'Deep_Voice_Man',
            'Calm_Woman',
            'Casual_Guy',
            'Lively_Girl',
            'Patient_Man',
            'Young_Knight',
            'Determined_Man',
            'Lovely_Girl',
            'Decent_Boy',
            'Imposing_Manner',
            'Elegant_Man',
            'Abbess',
            'Sweet_Girl_2',
            'Exuberant_Girl',
          ])
          .describe('Preset of the speaker, match the speakers and language in the text'),
        speed: z
          .number()
          .describe('Speed of the speech. Default value: 1. range: 0.5-2.0')
          .default(1),
        vol: z
          .number()
          .describe('Volume of the speech. Default value: 1. range: 0.01-10')
          .default(1),
        pitch: z
          .number()
          .describe('Pitch of the speech. Default value: 0. range: -12-12')
          .default(0),
        emotion: z
          .enum(['happy', 'sad', 'angry', 'fearful', 'neutral', 'disgusted', 'surprised'])
          .describe('Emotion of the speech. Default value: neutral')
          .default('neutral'),
        english_normalization: z
          .boolean()
          .describe(
            'Enables English text normalization to improve number reading performance, with a slight increase in latency. Default value: false',
          )
          .default(false),
      })
      .describe('Voice setting for the generation'),
    language_boost: z
      .enum([
        'Chinese',
        'Chinese,Yue',
        'English',
        'Japanese',
        'Korean',
        'French',
        'German',
        'Spanish',
        'Russian',
        'Italian',
        'Turkish',
        'Portuguese',
        'Vietnamese',
        'Indonesian',
        'Thai',
        'Arabic',
        'Mongolian',
        'Persian',
        'Vietnamese',
        'auto',
      ])
      .describe('Enhance recognition of specified languages and dialects. Default value: auto')
      .optional()
      .default('auto'),
  });

  description =
    "Generate long, expressive multi-voice speech using Microsoft's powerful TTS. You can use it to generate a whole podcast without splitting it into segments.";

  protected params: FalAudioParams;

  constructor(params: FalAudioParams) {
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
        mediaType: 'audio',
        prompt: input.text,
        model: 'fal-ai/minimax/preview/speech-2.5-turbo',
        provider: 'fal',
        input,
        unitCost: 35,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated audio with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating media',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating media',
      };
    }
  }
}

export class FalAudioToolset extends AgentBaseToolset<FalAudioParams> {
  toolsetKey = FalAudioToolsetDefinition.key;
  tools = [
    VibeVoiceGenerateAudio,
    ElevenLabsDialogueGenerateAudio,
    MinimaxSpeechGenerateAudio,
  ] satisfies readonly AgentToolConstructor<FalAudioParams>[];
}
