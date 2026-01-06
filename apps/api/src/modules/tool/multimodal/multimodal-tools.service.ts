/**
 * MultimodalToolsService - Unified service for all Gemini multimodal tools
 * Provides: Video Understanding, Document Processing, Audio Understanding, Speech Generation (TTS)
 *
 * Uses SDK client directly without registering individual interpreter services as providers.
 */

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { GeminiClientService, GeminiClientInstance } from './gemini/client.service';
import { GeminiFileStoreService } from './gemini/file-store.service';
import { ImageInterpreterService } from './gemini/image.service';
import { VideoInterpreterService } from './gemini/video.service';
import { DocumentInterpreterService } from './gemini/document.service';
import { AudioInterpreterService } from './gemini/audio.service';
import { SpeechGeneratorService } from './gemini/speech.service';
import type {
  // Image types
  ImageInput,
  InterpretRequest,
  InterpretResultWithUsage,
  // Video types
  VideoInput,
  VideoInterpretRequest,
  VideoInterpretResultWithUsage,
  // Document types
  MediaInput,
  DocumentInterpretRequest,
  DocumentInterpretResultWithUsage,
  TableData,
  DocumentStructure,
  // Audio types
  AudioInterpretRequest,
  AudioInterpretResultWithUsage,
  TranscriptResult,
  SpeakerSegment,
  // TTS types
  SpeechGenerateRequest,
  SpeechGenerateResultWithUsage,
  MultiSpeakerRequest,
  TTSVoiceName,
  // Common types
  GeminiFileRef,
} from './gemini/types';

/**
 * Unified service for multimodal AI tools powered by Gemini
 */
@Injectable()
export class MultimodalToolsService {
  private videoInterpreter: VideoInterpreterService;
  private documentInterpreter: DocumentInterpreterService;
  private audioInterpreter: AudioInterpreterService;
  private speechGenerator: SpeechGeneratorService;

  constructor(
    private readonly logger: PinoLogger,
    private readonly geminiClientService: GeminiClientService,
    private readonly fileStoreService: GeminiFileStoreService,
    private readonly imageInterpreter: ImageInterpreterService,
  ) {
    this.logger.setContext(MultimodalToolsService.name);

    // Initialize interpreter services with file store (they don't need to be NestJS providers)
    this.videoInterpreter = new VideoInterpreterService(this.logger, this.fileStoreService);
    this.documentInterpreter = new DocumentInterpreterService(this.logger, this.fileStoreService);
    this.audioInterpreter = new AudioInterpreterService(this.logger, this.fileStoreService);
    this.speechGenerator = new SpeechGeneratorService(this.logger);
  }

  /**
   * Get the Gemini client instance
   */
  private getClient(): GeminiClientInstance {
    return this.geminiClientService.getClient();
  }

  // ============================================================================
  // Image Understanding (delegates to existing ImageInterpreterService)
  // ============================================================================

  /**
   * Interpret images and return structured text descriptions
   */
  async interpretImages(request: InterpretRequest): Promise<InterpretResultWithUsage> {
    return this.imageInterpreter.interpret(this.getClient(), request);
  }

  /**
   * Interpret a single image
   */
  async interpretImage(image: ImageInput, options?: { query?: string }): Promise<string> {
    return this.imageInterpreter.interpretOne(this.getClient(), image, options);
  }

  // ============================================================================
  // Video Understanding
  // ============================================================================

  /**
   * Analyze video content
   * Supports file uploads and YouTube URLs
   */
  async analyzeVideo(request: VideoInterpretRequest): Promise<VideoInterpretResultWithUsage> {
    this.logger.info({ mode: request.mode }, 'Analyzing video');
    return this.videoInterpreter.interpret(this.getClient(), request);
  }

  /**
   * Analyze video from file
   */
  async analyzeVideoFile(
    video: VideoInput,
    options?: { query?: string; mode?: 'general' | 'transcript' | 'timeline' },
  ): Promise<VideoInterpretResultWithUsage> {
    return this.analyzeVideo({
      video,
      query: options?.query,
      mode: options?.mode || 'general',
    });
  }

  /**
   * Analyze YouTube video
   */
  async analyzeYouTube(
    youtubeUrl: string,
    options?: { query?: string; mode?: 'general' | 'transcript' | 'timeline' },
  ): Promise<VideoInterpretResultWithUsage> {
    return this.analyzeVideo({
      video: { youtubeUrl, mimeType: 'video/*' },
      query: options?.query,
      mode: options?.mode || 'general',
    });
  }

  /**
   * Extract content at a specific timestamp
   */
  async extractVideoTimestamp(
    video: VideoInput,
    timestamp: string,
    query?: string,
  ): Promise<string> {
    return this.videoInterpreter.extractAtTimestamp(this.getClient(), video, timestamp, query);
  }

  // ============================================================================
  // Document Processing
  // ============================================================================

  /**
   * Analyze document (PDF) content
   */
  async analyzeDocument(
    request: DocumentInterpretRequest,
  ): Promise<DocumentInterpretResultWithUsage> {
    this.logger.info({ mode: request.mode }, 'Analyzing document');
    return this.documentInterpreter.interpret(this.getClient(), request);
  }

  /**
   * Summarize a document
   */
  async summarizeDocument(
    document: MediaInput,
    options?: { query?: string; pageRange?: { start?: number; end?: number } },
  ): Promise<string> {
    const result = await this.analyzeDocument({
      document,
      query: options?.query,
      mode: 'summary',
      pageRange: options?.pageRange,
    });
    return result.analysis;
  }

  /**
   * Extract tables from a document
   */
  async extractDocumentTables(document: MediaInput): Promise<TableData[]> {
    return this.documentInterpreter.extractTables(this.getClient(), document);
  }

  /**
   * Extract document structure (TOC, sections)
   */
  async extractDocumentStructure(document: MediaInput): Promise<DocumentStructure> {
    return this.documentInterpreter.extractStructure(this.getClient(), document);
  }

  /**
   * Answer a question about a document
   */
  async askDocumentQuestion(document: MediaInput, question: string): Promise<string> {
    return this.documentInterpreter.answerQuestion(this.getClient(), document, question);
  }

  // ============================================================================
  // Audio Understanding
  // ============================================================================

  /**
   * Analyze audio content
   */
  async analyzeAudio(request: AudioInterpretRequest): Promise<AudioInterpretResultWithUsage> {
    this.logger.info({ mode: request.mode }, 'Analyzing audio');
    return this.audioInterpreter.interpret(this.getClient(), request);
  }

  /**
   * Transcribe audio content
   */
  async transcribeAudio(
    audio: MediaInput,
    options?: { language?: string },
  ): Promise<TranscriptResult> {
    return this.audioInterpreter.transcribe(this.getClient(), audio, options);
  }

  /**
   * Summarize audio content
   */
  async summarizeAudio(audio: MediaInput, options?: { query?: string }): Promise<string> {
    return this.audioInterpreter.summarize(this.getClient(), audio, options);
  }

  /**
   * Detect and label speakers in audio
   */
  async detectAudioSpeakers(audio: MediaInput): Promise<SpeakerSegment[]> {
    return this.audioInterpreter.detectSpeakers(this.getClient(), audio);
  }

  /**
   * Answer a question about audio content
   */
  async askAudioQuestion(audio: MediaInput, question: string): Promise<string> {
    return this.audioInterpreter.answerQuestion(this.getClient(), audio, question);
  }

  // ============================================================================
  // Speech Generation (TTS)
  // ============================================================================

  /**
   * Generate speech from text
   */
  async generateSpeech(request: SpeechGenerateRequest): Promise<SpeechGenerateResultWithUsage> {
    this.logger.info({ voiceName: request.voiceName }, 'Generating speech');
    return this.speechGenerator.generate(this.getClient(), request);
  }

  /**
   * Generate speech with default settings
   */
  async textToSpeech(
    text: string,
    options?: { voice?: TTSVoiceName; language?: string },
  ): Promise<SpeechGenerateResultWithUsage> {
    return this.generateSpeech({
      text,
      voiceName: options?.voice,
      language: options?.language,
    });
  }

  /**
   * Generate multi-speaker speech
   */
  async generateMultiSpeakerSpeech(
    request: MultiSpeakerRequest,
  ): Promise<SpeechGenerateResultWithUsage> {
    this.logger.info({ speakerCount: request.speakers.length }, 'Generating multi-speaker speech');
    return this.speechGenerator.generateMultiSpeaker(this.getClient(), request);
  }

  /**
   * Get available TTS voices
   */
  getAvailableVoices(): TTSVoiceName[] {
    return this.speechGenerator.getAvailableVoices();
  }

  /**
   * Check if a voice name is valid
   */
  isValidVoice(voice: string): boolean {
    return this.speechGenerator.isValidVoice(voice);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Upload a file to Gemini File API for reuse
   * Returns a file reference that can be used in multiple requests
   */
  async uploadFile(input: MediaInput): Promise<GeminiFileRef> {
    return this.fileStoreService.uploadFile(input);
  }

  /**
   * Check if Gemini API is configured and available
   */
  isAvailable(): boolean {
    try {
      this.getClient();
      return true;
    } catch {
      return false;
    }
  }
}
