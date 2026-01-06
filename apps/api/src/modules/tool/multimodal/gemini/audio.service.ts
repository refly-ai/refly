/**
 * AudioInterpreterService - Analyzes audio content using Gemini multimodal API
 * Supports transcription, summarization, Q&A, and speaker diarization
 */

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { GeminiClientInstance } from './client.service';
import { GeminiFileStoreService } from './file-store.service';
import { buildAudioAnalysisPrompt } from './prompts';
import type {
  MediaInput,
  AudioInterpretRequest,
  BatchAudioInterpretRequest,
  TranscriptResult,
  TranscriptSegment,
  SpeakerSegment,
  GeminiFileRef,
  AudioInterpretResultWithUsage,
  BatchAudioInterpretResultWithUsage,
  MultimodalTokenUsage,
} from './types';
import { MultimodalError, MultimodalErrorCode } from './types';

/**
 * Service for interpreting audio content using Gemini multimodal API
 */
@Injectable()
export class AudioInterpreterService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly fileStoreService: GeminiFileStoreService,
  ) {
    this.logger.setContext(AudioInterpreterService.name);
  }

  /**
   * Interpret audio content and return structured analysis with token usage
   */
  async interpret(
    client: GeminiClientInstance,
    request: AudioInterpretRequest,
  ): Promise<AudioInterpretResultWithUsage> {
    const { audio, query, mode = 'transcription', language } = request;

    // Validate audio input
    if (!audio.buffer && !audio.filePath && !audio.url) {
      throw new MultimodalError(
        'Audio input must have buffer, filePath, or url',
        MultimodalErrorCode.INVALID_CONFIG,
        false,
      );
    }

    // Validate MIME type
    const supportedAudioTypes = [
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/aiff',
      'audio/aac',
      'audio/ogg',
      'audio/flac',
    ];
    if (!supportedAudioTypes.includes(audio.mimeType)) {
      throw new MultimodalError(
        `Unsupported audio type: ${audio.mimeType}. Supported types: ${supportedAudioTypes.join(', ')}`,
        MultimodalErrorCode.UNSUPPORTED_TYPE,
        false,
      );
    }

    // Always use File API for audio files
    let fileRef: GeminiFileRef;
    try {
      fileRef = await this.fileStoreService.uploadFile({
        buffer: audio.buffer,
        filePath: audio.filePath,
        url: audio.url,
        mimeType: audio.mimeType,
        name: audio.name,
        cacheKey: audio.cacheKey,
      });
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to upload audio: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.UPLOAD_FAILED,
        true,
      );
    }

    // Build analysis prompt
    const prompt = buildAudioAnalysisPrompt({ query, mode, language });

    // Generate analysis using File API
    try {
      const result = await client.generateFromFiles(prompt, [fileRef]);

      // Parse result based on mode
      let transcript: TranscriptResult | undefined;
      let speakers: SpeakerSegment[] | undefined;

      if (mode === 'transcription') {
        transcript = this.parseTranscript(result.text);
      } else if (mode === 'speaker_diarization') {
        speakers = this.parseSpeakerSegments(result.text);
        transcript = {
          text: result.text,
          segments: speakers.map((s) => ({
            start: s.start,
            end: s.end,
            text: s.text,
            speaker: s.speaker,
          })),
        };
      }

      // Build token usage from response metadata
      const tokenUsage: MultimodalTokenUsage | undefined = result.usageMetadata
        ? {
            promptTokens: result.usageMetadata.promptTokenCount,
            outputTokens: result.usageMetadata.candidatesTokenCount,
            totalTokens: result.usageMetadata.totalTokenCount,
            cachedContentTokens: result.usageMetadata.cachedContentTokenCount,
            modalityType: 'audio',
          }
        : undefined;

      return {
        analysis: result.text,
        transcript,
        speakers,
        fileRef,
        tokenUsage,
      };
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to analyze audio: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Transcribe audio content
   */
  async transcribe(
    client: GeminiClientInstance,
    audio: MediaInput,
    options?: { language?: string },
  ): Promise<TranscriptResult> {
    const result = await this.interpret(client, {
      audio,
      mode: 'transcription',
      language: options?.language,
    });

    return (
      result.transcript || {
        text: result.analysis,
        segments: [],
      }
    );
  }

  /**
   * Summarize audio content
   */
  async summarize(
    client: GeminiClientInstance,
    audio: MediaInput,
    options?: { query?: string },
  ): Promise<string> {
    const result = await this.interpret(client, {
      audio,
      query: options?.query,
      mode: 'summary',
    });

    return result.analysis;
  }

  /**
   * Detect and label speakers in audio
   */
  async detectSpeakers(client: GeminiClientInstance, audio: MediaInput): Promise<SpeakerSegment[]> {
    const result = await this.interpret(client, {
      audio,
      mode: 'speaker_diarization',
    });

    return result.speakers || [];
  }

  /**
   * Answer a question about the audio content
   */
  async answerQuestion(
    client: GeminiClientInstance,
    audio: MediaInput,
    question: string,
  ): Promise<string> {
    const result = await this.interpret(client, {
      audio,
      query: question,
      mode: 'qa',
    });

    return result.analysis;
  }

  /**
   * Batch interpret multiple audio files in a single API call
   * Always uses File API for audio files (per design requirement)
   */
  async batchInterpret(
    client: GeminiClientInstance,
    request: BatchAudioInterpretRequest,
  ): Promise<BatchAudioInterpretResultWithUsage> {
    const { audios, query, mode = 'transcription', language } = request;

    if (!audios || audios.length === 0) {
      throw new MultimodalError(
        'At least one audio file is required',
        MultimodalErrorCode.INVALID_CONFIG,
        false,
      );
    }

    // Supported audio types
    const supportedAudioTypes = [
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/aiff',
      'audio/aac',
      'audio/ogg',
      'audio/flac',
    ];

    // Validate all audio files
    for (const audio of audios) {
      if (!audio.buffer && !audio.filePath && !audio.url) {
        throw new MultimodalError(
          'Each audio input must have buffer, filePath, or url',
          MultimodalErrorCode.INVALID_CONFIG,
          false,
        );
      }

      if (!supportedAudioTypes.includes(audio.mimeType)) {
        throw new MultimodalError(
          `Unsupported audio type: ${audio.mimeType}. Supported types: ${supportedAudioTypes.join(', ')}`,
          MultimodalErrorCode.UNSUPPORTED_TYPE,
          false,
        );
      }
    }

    const fileRefs: GeminiFileRef[] = [];
    const audioNames: (string | undefined)[] = [];

    // Upload all audio files to File API (always use File API for audio)
    for (const audio of audios) {
      audioNames.push(audio.name);
      try {
        const fileRef = await this.fileStoreService.uploadFile({
          buffer: audio.buffer,
          filePath: audio.filePath,
          url: audio.url,
          mimeType: audio.mimeType,
          name: audio.name,
          cacheKey: audio.cacheKey,
        });
        fileRefs.push(fileRef);
      } catch (error) {
        if (error instanceof MultimodalError) {
          throw error;
        }
        throw new MultimodalError(
          `Failed to upload audio ${audio.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
          MultimodalErrorCode.UPLOAD_FAILED,
          true,
        );
      }
    }

    // Build batch analysis prompt
    const prompt = this.buildBatchPrompt(audios.length, query, mode, language, audioNames);

    // Generate analysis
    try {
      const result = await client.generateFromFiles(prompt, fileRefs);

      // Build token usage from response metadata
      const tokenUsage: MultimodalTokenUsage | undefined = result.usageMetadata
        ? {
            promptTokens: result.usageMetadata.promptTokenCount,
            outputTokens: result.usageMetadata.candidatesTokenCount,
            totalTokens: result.usageMetadata.totalTokenCount,
            cachedContentTokens: result.usageMetadata.cachedContentTokenCount,
            modalityType: 'audio',
          }
        : undefined;

      return {
        analysis: result.text,
        fileRefs,
        tokenUsage,
      };
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to analyze audio files: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Build prompt for batch audio analysis
   */
  private buildBatchPrompt(
    audioCount: number,
    query: string | undefined,
    mode: 'transcription' | 'summary' | 'qa' | 'speaker_diarization',
    language: string | undefined,
    audioNames: (string | undefined)[],
  ): string {
    const audioList = audioNames
      .map((name, i) => `${i + 1}. ${name || `Audio ${i + 1}`}`)
      .join('\n');

    const basePrompt = buildAudioAnalysisPrompt({ query, mode, language });

    return `You are analyzing ${audioCount} audio file${audioCount > 1 ? 's' : ''}.

## Audio Files
${audioList}

${basePrompt}

Provide a unified analysis covering all audio files. When referencing specific content, indicate which audio file it comes from.`;
  }

  /**
   * Parse transcript from analysis output
   */
  private parseTranscript(content: string): TranscriptResult {
    const segments: TranscriptSegment[] = [];

    // Match patterns like [00:15] text or [00:15 - 00:30] text
    const timestampRegex =
      /\[(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-\s*(\d{1,2}:\d{2}(?::\d{2})?))?\]\s*(.+?)(?=\[|\n\n|$)/gs;

    let fullText = '';

    for (const match of content.matchAll(timestampRegex)) {
      const start = match[1];
      const end = match[2] || this.incrementTimestamp(start, 5); // Default 5 second segments
      const text = match[3].trim();

      segments.push({ start, end, text });
      fullText += `${text} `;
    }

    // If no timestamps found, return the whole content as text
    if (segments.length === 0) {
      return {
        text: content,
        segments: [],
      };
    }

    return {
      text: fullText.trim(),
      segments,
    };
  }

  /**
   * Parse speaker segments from diarization output
   */
  private parseSpeakerSegments(content: string): SpeakerSegment[] {
    const segments: SpeakerSegment[] = [];

    // Match patterns like "Speaker 1 [00:15 - 00:30]: text" or "说话者1 [00:15 - 00:30]: text"
    const speakerRegex =
      /(?:Speaker\s*(\d+)|说话者\s*(\d+))\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)\]:\s*(.+?)(?=(?:Speaker|说话者)|\n\n|$)/gis;

    for (const match of content.matchAll(speakerRegex)) {
      const speakerNum = match[1] || match[2];
      const speaker = `Speaker ${speakerNum}`;
      const start = match[3];
      const end = match[4];
      const text = match[5].trim();

      segments.push({ speaker, start, end, text });
    }

    // Alternative pattern: just speaker labels without timestamps
    if (segments.length === 0) {
      const simpleRegex =
        /(?:Speaker\s*(\d+)|说话者\s*(\d+)):\s*(.+?)(?=(?:Speaker|说话者)|\n\n|$)/gis;
      let segmentIndex = 0;

      for (const match of content.matchAll(simpleRegex)) {
        const speakerNum = match[1] || match[2];
        const speaker = `Speaker ${speakerNum}`;
        const text = match[3].trim();

        // Generate approximate timestamps
        const startSeconds = segmentIndex * 10;
        const endSeconds = startSeconds + 10;

        segments.push({
          speaker,
          start: this.formatTimestamp(startSeconds),
          end: this.formatTimestamp(endSeconds),
          text,
        });
        segmentIndex++;
      }
    }

    return segments;
  }

  /**
   * Increment a timestamp by a given number of seconds
   */
  private incrementTimestamp(timestamp: string, seconds: number): string {
    const parts = timestamp.split(':').map(Number);
    let totalSeconds: number;

    if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      totalSeconds = parts[0] * 60 + parts[1];
    }

    totalSeconds += seconds;
    return this.formatTimestamp(totalSeconds);
  }

  /**
   * Format seconds as MM:SS or HH:MM:SS timestamp
   */
  private formatTimestamp(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
