/**
 * SpeechGeneratorService - Text-to-Speech generation using Gemini TTS API
 * Outputs PCM audio (24kHz, 16-bit, mono) and auto-uploads to Drive
 */

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { GeminiClientInstance } from './client.service';
import type {
  MultiSpeakerRequest,
  SpeechGenerateRequest,
  TTSVoiceName,
  SpeechGenerateResultWithUsage,
  MultimodalTokenUsage,
} from './types';
import { MultimodalError, MultimodalErrorCode } from './types';

/** Default TTS voice */
const DEFAULT_VOICE: TTSVoiceName = 'Kore';

/** TTS model for Gemini */
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

/** Maximum text length (approximate token limit) */
const MAX_TEXT_LENGTH = 100000; // ~32k tokens

/** Available TTS voices */
const AVAILABLE_VOICES: TTSVoiceName[] = [
  'Aoede',
  'Charon',
  'Fenrir',
  'Kore',
  'Puck',
  'Enceladus',
  'Iapetus',
  'Umbriel',
  'Algieba',
  'Autonoe',
  'Callirrhoe',
  'Despina',
  'Erinome',
  'Gacrux',
  'Leda',
  'Orus',
  'Pegasi',
  'Schedar',
  'Sulafat',
  'Vindemiatrix',
  'Zephyr',
  'Achernar',
  'Zubenelgenubi',
  'Pulcherrima',
  'Achird',
  'Rasalgethi',
  'Sadachbia',
  'Sadaltager',
  'Sadalsuud',
];

/**
 * Service for generating speech from text using Gemini TTS API
 */
@Injectable()
export class SpeechGeneratorService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SpeechGeneratorService.name);
  }

  /**
   * Generate speech from text
   * Returns audio buffer and metadata with token usage
   */
  async generate(
    client: GeminiClientInstance,
    request: SpeechGenerateRequest,
  ): Promise<SpeechGenerateResultWithUsage> {
    const { text, voiceName = DEFAULT_VOICE, language: _language } = request;

    // Validate text length
    if (text.length > MAX_TEXT_LENGTH) {
      throw new MultimodalError(
        `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`,
        MultimodalErrorCode.TTS_TEXT_TOO_LONG,
        false,
        { maxLength: MAX_TEXT_LENGTH, actualLength: text.length },
      );
    }

    // Validate voice name
    if (!this.isValidVoice(voiceName)) {
      throw new MultimodalError(
        `Unsupported voice: ${voiceName}. Available voices: ${AVAILABLE_VOICES.join(', ')}`,
        MultimodalErrorCode.UNSUPPORTED_VOICE,
        false,
      );
    }

    try {
      const genAI = client.getClient();

      const result = await genAI.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName as string,
              },
            },
          },
        } as Record<string, unknown>,
      });

      // Extract audio data from response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioData = this.extractAudioData(result as unknown);

      if (!audioData) {
        throw new MultimodalError(
          'No audio data in TTS response',
          MultimodalErrorCode.TTS_GENERATION_FAILED,
          true,
        );
      }

      const audioBuffer = Buffer.from(audioData, 'base64');
      const durationMs = this.estimateDuration(audioBuffer);

      // For TTS, track input character count as "prompt tokens" (chars / 4 approximation)
      // Output is audio, so outputTokens = 0
      const tokenUsage: MultimodalTokenUsage = {
        promptTokens: Math.ceil(text.length / 4), // Approximate token count from chars
        outputTokens: 0, // Audio output doesn't have text tokens
        totalTokens: Math.ceil(text.length / 4),
        modalityType: 'speech',
      };

      return {
        audioBuffer,
        mimeType: 'audio/wav',
        durationMs,
        tokenUsage,
      };
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `TTS generation failed: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.TTS_GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Generate multi-speaker speech
   * Text should contain speaker annotations like "Speaker 1: Hello"
   */
  async generateMultiSpeaker(
    client: GeminiClientInstance,
    request: MultiSpeakerRequest,
  ): Promise<SpeechGenerateResultWithUsage> {
    const { text, speakers, language: _language } = request;

    // Validate speaker count (max 2 per Gemini API)
    if (speakers.length > 2) {
      throw new MultimodalError(
        'Maximum 2 speakers are supported for multi-speaker TTS.',
        MultimodalErrorCode.INVALID_CONFIG,
        false,
      );
    }

    // Validate text length
    if (text.length > MAX_TEXT_LENGTH) {
      throw new MultimodalError(
        `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`,
        MultimodalErrorCode.TTS_TEXT_TOO_LONG,
        false,
      );
    }

    // Validate voice names
    for (const speaker of speakers) {
      if (!this.isValidVoice(speaker.voiceName as TTSVoiceName)) {
        throw new MultimodalError(
          `Unsupported voice for ${speaker.speaker}: ${speaker.voiceName}`,
          MultimodalErrorCode.UNSUPPORTED_VOICE,
          false,
        );
      }
    }

    try {
      const genAI = client.getClient();

      // Build multi-speaker config
      const multiSpeakerConfig = {
        voiceConfigs: speakers.map((s) => ({
          speaker: s.speaker,
          prebuiltVoiceConfig: {
            voiceName: s.voiceName as string,
          },
        })),
      };

      const result = await genAI.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: multiSpeakerConfig,
          },
        } as Record<string, unknown>,
      });

      const audioData = this.extractAudioData(result as unknown);

      if (!audioData) {
        throw new MultimodalError(
          'No audio data in multi-speaker TTS response',
          MultimodalErrorCode.TTS_GENERATION_FAILED,
          true,
        );
      }

      const audioBuffer = Buffer.from(audioData, 'base64');
      const durationMs = this.estimateDuration(audioBuffer);

      // For TTS, track input character count as "prompt tokens" (chars / 4 approximation)
      // Output is audio, so outputTokens = 0
      const tokenUsage: MultimodalTokenUsage = {
        promptTokens: Math.ceil(text.length / 4), // Approximate token count from chars
        outputTokens: 0, // Audio output doesn't have text tokens
        totalTokens: Math.ceil(text.length / 4),
        modalityType: 'speech',
      };

      return {
        audioBuffer,
        mimeType: 'audio/wav',
        durationMs,
        tokenUsage,
      };
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Multi-speaker TTS generation failed: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.TTS_GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Get list of available voices
   */
  getAvailableVoices(): TTSVoiceName[] {
    return [...AVAILABLE_VOICES];
  }

  /**
   * Check if a voice name is valid
   */
  isValidVoice(voice: TTSVoiceName | string): boolean {
    return AVAILABLE_VOICES.includes(voice as TTSVoiceName);
  }

  /**
   * Extract audio data from Gemini response
   */
  private extractAudioData(result: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data: string };
        }>;
      };
    }>;
  }): string | null {
    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      return null;
    }

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      return null;
    }

    const inlineData = parts[0]?.inlineData;
    return inlineData?.data || null;
  }

  /**
   * Estimate audio duration from PCM buffer
   * PCM format: 24kHz, 16-bit, mono
   */
  private estimateDuration(buffer: Buffer): number {
    // WAV header is typically 44 bytes
    const headerSize = 44;
    const dataSize = buffer.length - headerSize;

    // 24kHz sample rate, 16-bit (2 bytes per sample), mono (1 channel)
    const bytesPerSecond = 24000 * 2 * 1;
    const durationSeconds = dataSize / bytesPerSecond;

    return Math.round(durationSeconds * 1000); // Return in milliseconds
  }
}
