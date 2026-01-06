/**
 * Input for image processing
 * At least one of buffer, filePath, or url must be provided
 */
export interface ImageInput {
  /** Image binary data (preferred for upload) */
  buffer?: Buffer;

  /** Local file path (alternative to buffer) */
  filePath?: string;

  /** Remote URL (will be downloaded if buffer not provided) */
  url?: string;

  /** Refly storage key for the image */
  storageKey?: string;

  /** MIME type of the image (e.g., 'image/jpeg', 'image/png') */
  mimeType: string;

  /** Display name for the file */
  name?: string;

  /** Cache key for deduplication (e.g., driveFileId) */
  cacheKey?: string;
}

/**
 * Reference to a file uploaded to Gemini File API
 */
export interface GeminiFileRef {
  /** Gemini File API URI (e.g., "files/abc123") */
  uri: string;

  /** MIME type of the uploaded file */
  mimeType: string;

  /** Display name set during upload */
  displayName?: string;

  /** When the file expires in Gemini (typically 48 hours) */
  expiresAt?: Date;

  /** File size in bytes */
  sizeBytes?: number;
}

/**
 * Request for image interpretation
 */
export interface InterpretRequest {
  /** Images to interpret */
  images: ImageInput[];

  /** User's query for context-aware interpretation */
  query?: string;

  /** Maximum characters for interpretation output */
  maxChars?: number;
}

/**
 * Result of image interpretation
 */
export interface InterpretResult {
  /** Text interpretations of the images */
  interpretations: string[];

  /** Cached file references for potential reuse by vision_read tool */
  fileRefs: GeminiFileRef[];
}

/**
 * Configuration for GeminiMultimodalClient
 */
export interface MultimodalClientConfig {
  /** Google AI API Key (for Google AI Studio) */
  apiKey?: string;

  /** GCP Project ID (for Vertex AI) */
  projectId?: string;

  /** GCP Location/Region (for Vertex AI, e.g., "us-central1") */
  location?: string;

  /** Model ID to use (default: "gemini-2.5-flash") */
  modelId?: string;
}

/**
 * Options for GeminiFileStore
 */
export interface FileStoreOptions {
  /** Maximum number of files to cache (default: 100) */
  maxFiles?: number;

  /** TTL in minutes before cache entries expire (default: 45) */
  ttlMinutes?: number;
}

/**
 * Provider interface for compatibility with existing provider system
 */
export interface BaseProvider {
  providerKey: string;
  apiKey?: string;
  baseUrl?: string;
  extraParams?: string;
}

/**
 * Prompt template options for image interpretation
 */
export interface InterpretationPromptOptions {
  query?: string;
  maxChars?: number;
  imageCount: number;
}

/**
 * Options for vision tool prompts
 */
export interface VisionToolPromptOptions {
  intent: string;
  maxChars?: number;
}

// ============================================================================
// Generic Media Input Types
// ============================================================================

/**
 * Generic media input for all modalities
 * Used for automatic inline vs File API selection based on size
 */
export interface MediaInput {
  /** Media binary data */
  buffer?: Buffer;

  /** Local file path */
  filePath?: string;

  /** Remote URL */
  url?: string;

  /** MIME type of the media */
  mimeType: string;

  /** Cache key for File API deduplication */
  cacheKey?: string;

  /** Display name */
  name?: string;
}

/**
 * Inline data for Gemini API (base64 encoded)
 */
export interface InlineData {
  mimeType: string;
  data: string; // base64
}

// ============================================================================
// Video Processing Types
// ============================================================================

/**
 * Video-specific input with YouTube URL support
 */
export interface VideoInput extends MediaInput {
  /** YouTube URL (Gemini native support) */
  youtubeUrl?: string;
}

/**
 * Video interpretation request
 */
export interface VideoInterpretRequest {
  /** Video input (file or YouTube URL) */
  video: VideoInput;

  /** User's query */
  query?: string;

  /** Analysis mode */
  mode?: 'general' | 'transcript' | 'timeline';

  /** Frame sampling rate (default: 1fps) */
  fps?: number;

  /** Start offset (e.g., "10s") */
  startOffset?: string;

  /** End offset (e.g., "60s") */
  endOffset?: string;
}

/**
 * Timestamp marker in video
 */
export interface TimestampMarker {
  /** Timestamp in MM:SS format */
  timestamp: string;

  /** Description at this timestamp */
  description: string;
}

/**
 * Video interpretation result
 */
export interface VideoInterpretResult {
  /** Analysis text */
  analysis: string;

  /** Detected timestamps (for timeline mode) */
  timestamps?: TimestampMarker[];

  /** Cached file reference */
  fileRef?: GeminiFileRef;
}

// ============================================================================
// Document Processing Types
// ============================================================================

/**
 * Document interpretation request
 */
export interface DocumentInterpretRequest {
  /** Document input (PDF) */
  document: MediaInput;

  /** User's query */
  query?: string;

  /** Analysis mode */
  mode?: 'summary' | 'extract' | 'qa';

  /** Page range to process */
  pageRange?: {
    start?: number;
    end?: number;
  };
}

/**
 * Extracted table data
 */
export interface TableData {
  /** Table title or caption */
  title?: string;

  /** Table headers */
  headers: string[];

  /** Table rows */
  rows: string[][];

  /** Page number where table was found */
  pageNumber?: number;
}

/**
 * Document structure information
 */
export interface DocumentStructure {
  /** Document title */
  title?: string;

  /** Table of contents / sections */
  sections: Array<{
    title: string;
    pageNumber?: number;
    level: number;
  }>;

  /** Total page count */
  pageCount: number;
}

/**
 * Document interpretation result
 */
export interface DocumentInterpretResult {
  /** Analysis text */
  analysis: string;

  /** Extracted tables (for extract mode) */
  tables?: TableData[];

  /** Document structure */
  structure?: DocumentStructure;

  /** Cached file reference */
  fileRef?: GeminiFileRef;
}

// ============================================================================
// Audio Understanding Types
// ============================================================================

/**
 * Audio interpretation request
 */
export interface AudioInterpretRequest {
  /** Audio input */
  audio: MediaInput;

  /** User's query */
  query?: string;

  /** Analysis mode */
  mode?: 'transcription' | 'summary' | 'qa' | 'speaker_diarization';

  /** Expected language of the audio */
  language?: string;
}

/**
 * Transcript segment with timing
 */
export interface TranscriptSegment {
  /** Start time (MM:SS format) */
  start: string;

  /** End time (MM:SS format) */
  end: string;

  /** Transcribed text */
  text: string;

  /** Speaker identifier (for diarization) */
  speaker?: string;
}

/**
 * Full transcript result
 */
export interface TranscriptResult {
  /** Full transcribed text */
  text: string;

  /** Segments with timing */
  segments?: TranscriptSegment[];

  /** Detected language */
  detectedLanguage?: string;
}

/**
 * Speaker segment for diarization
 */
export interface SpeakerSegment {
  /** Speaker identifier */
  speaker: string;

  /** Start time */
  start: string;

  /** End time */
  end: string;

  /** Spoken text */
  text: string;
}

/**
 * Audio interpretation result
 */
export interface AudioInterpretResult {
  /** Analysis text */
  analysis: string;

  /** Transcript (for transcription mode) */
  transcript?: TranscriptResult;

  /** Speaker segments (for diarization mode) */
  speakers?: SpeakerSegment[];

  /** Cached file reference */
  fileRef?: GeminiFileRef;
}

// ============================================================================
// Batch Processing Types
// ============================================================================

/**
 * Batch document interpretation request
 */
export interface BatchDocumentInterpretRequest {
  /** Multiple document inputs (PDF) */
  documents: MediaInput[];

  /** User's query */
  query?: string;

  /** Analysis mode */
  mode?: 'summary' | 'extract' | 'qa';
}

/**
 * Batch document interpretation result
 */
export interface BatchDocumentInterpretResult {
  /** Combined analysis text for all documents */
  analysis: string;

  /** Individual results per document (optional, for debugging) */
  individualResults?: Array<{
    name?: string;
    analysis: string;
  }>;

  /** Cached file references */
  fileRefs: GeminiFileRef[];
}

/**
 * Batch audio interpretation request
 */
export interface BatchAudioInterpretRequest {
  /** Multiple audio inputs */
  audios: MediaInput[];

  /** User's query */
  query?: string;

  /** Analysis mode */
  mode?: 'transcription' | 'summary' | 'qa' | 'speaker_diarization';

  /** Expected language of the audio */
  language?: string;
}

/**
 * Batch audio interpretation result
 */
export interface BatchAudioInterpretResult {
  /** Combined analysis text for all audio files */
  analysis: string;

  /** Individual results per audio (optional) */
  individualResults?: Array<{
    name?: string;
    analysis: string;
    transcript?: TranscriptResult;
  }>;

  /** Cached file references */
  fileRefs: GeminiFileRef[];
}

/**
 * Batch video interpretation request
 */
export interface BatchVideoInterpretRequest {
  /** Multiple video inputs */
  videos: VideoInput[];

  /** User's query */
  query?: string;

  /** Analysis mode */
  mode?: 'general' | 'transcript' | 'timeline';
}

/**
 * Batch video interpretation result
 */
export interface BatchVideoInterpretResult {
  /** Combined analysis text for all videos */
  analysis: string;

  /** Individual results per video (optional) */
  individualResults?: Array<{
    name?: string;
    analysis: string;
    timestamps?: TimestampMarker[];
  }>;

  /** Cached file references */
  fileRefs: GeminiFileRef[];
}

// ============================================================================
// Speech Generation (TTS) Types
// ============================================================================

/** Available TTS voice names */
export type TTSVoiceName =
  | 'Aoede'
  | 'Charon'
  | 'Fenrir'
  | 'Kore'
  | 'Puck'
  | 'Enceladus'
  | 'Iapetus'
  | 'Umbriel'
  | 'Algieba'
  | 'Autonoe'
  | 'Callirrhoe'
  | 'Despina'
  | 'Erinome'
  | 'Gacrux'
  | 'Leda'
  | 'Orus'
  | 'Pegasi'
  | 'Schedar'
  | 'Sulafat'
  | 'Vindemiatrix'
  | 'Zephyr'
  | 'Achernar'
  | 'Zubenelgenubi'
  | 'Pulcherrima'
  | 'Achird'
  | 'Rasalgethi'
  | 'Sadachbia'
  | 'Sadaltager'
  | 'Sadalsuud';

/**
 * Speech generation request
 */
export interface SpeechGenerateRequest {
  /** Text to convert to speech */
  text: string;

  /** Voice name (default: Kore) */
  voiceName?: TTSVoiceName | string;

  /** Language code (e.g., "en-US", "zh-CN") */
  language?: string;
}

/**
 * Multi-speaker configuration
 */
export interface MultiSpeakerConfig {
  /** Speaker name (used in text) */
  speaker: string;

  /** Voice for this speaker */
  voiceName: TTSVoiceName | string;
}

/**
 * Multi-speaker speech generation request
 */
export interface MultiSpeakerRequest {
  /** Text with speaker annotations */
  text: string;

  /** Speaker configurations (max 2) */
  speakers: MultiSpeakerConfig[];

  /** Language code */
  language?: string;
}

/**
 * Speech generation result
 */
export interface SpeechGenerateResult {
  /** Generated audio data (PCM 24kHz 16-bit mono) */
  audioBuffer: Buffer;

  /** Output MIME type */
  mimeType: 'audio/wav';

  /** Estimated duration in milliseconds */
  durationMs: number;

  /** File ID after upload to Drive */
  fileId?: string;

  /** File name */
  fileName?: string;
}

// ============================================================================
// Extended Error Codes
// ============================================================================

/**
 * Extended error codes for all multimodal operations
 */
export enum MultimodalErrorCode {
  // Configuration errors
  NO_API_KEY = 'MM_NO_API_KEY',
  INVALID_CONFIG = 'MM_INVALID_CONFIG',

  // Upload errors
  UPLOAD_FAILED = 'MM_UPLOAD_FAILED',
  FILE_TOO_LARGE = 'MM_FILE_TOO_LARGE',
  UNSUPPORTED_TYPE = 'MM_UNSUPPORTED_TYPE',

  // Processing errors
  GENERATION_FAILED = 'MM_GENERATION_FAILED',
  RATE_LIMITED = 'MM_RATE_LIMITED',
  QUOTA_EXCEEDED = 'MM_QUOTA_EXCEEDED',

  // File access errors
  FILE_NOT_FOUND = 'MM_FILE_NOT_FOUND',
  DOWNLOAD_FAILED = 'MM_DOWNLOAD_FAILED',
  FILE_EXPIRED = 'MM_FILE_EXPIRED',

  // Video-specific errors
  VIDEO_TOO_LONG = 'MM_VIDEO_TOO_LONG',
  INVALID_YOUTUBE_URL = 'MM_INVALID_YOUTUBE_URL',

  // Document-specific errors
  DOCUMENT_TOO_LARGE = 'MM_DOCUMENT_TOO_LARGE',
  TOO_MANY_PAGES = 'MM_TOO_MANY_PAGES',

  // Audio-specific errors
  AUDIO_TOO_LONG = 'MM_AUDIO_TOO_LONG',

  // TTS-specific errors
  TTS_TEXT_TOO_LONG = 'MM_TTS_TEXT_TOO_LONG',
  UNSUPPORTED_VOICE = 'MM_UNSUPPORTED_VOICE',
  TTS_GENERATION_FAILED = 'MM_TTS_GENERATION_FAILED',
}

/**
 * Custom error class for multimodal operations
 */
export class MultimodalError extends Error {
  constructor(
    message: string,
    public readonly code: MultimodalErrorCode,
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MultimodalError';
  }
}

// ============================================================================
// Token Usage Types for Multimodal Operations
// ============================================================================

/**
 * Modality types for billing differentiation
 */
export type MultimodalityType = 'image' | 'video' | 'audio' | 'document' | 'speech';

/**
 * Token usage metadata from Gemini API responses
 */
export interface MultimodalTokenUsage {
  /** Number of input/prompt tokens consumed */
  promptTokens: number;

  /** Number of output/completion tokens generated */
  outputTokens: number;

  /** Total tokens (prompt + output) */
  totalTokens: number;

  /** Cached content tokens (if context caching used) */
  cachedContentTokens?: number;

  /** Model ID used for this request */
  modelId?: string;

  /** Modality type for billing categorization */
  modalityType: MultimodalityType;
}

/**
 * Extended result types with token usage
 */
export interface InterpretResultWithUsage extends InterpretResult {
  tokenUsage?: MultimodalTokenUsage;
}

export interface VideoInterpretResultWithUsage extends VideoInterpretResult {
  tokenUsage?: MultimodalTokenUsage;
}

export interface DocumentInterpretResultWithUsage extends DocumentInterpretResult {
  tokenUsage?: MultimodalTokenUsage;
}

export interface AudioInterpretResultWithUsage extends AudioInterpretResult {
  tokenUsage?: MultimodalTokenUsage;
}

export interface SpeechGenerateResultWithUsage extends SpeechGenerateResult {
  tokenUsage?: MultimodalTokenUsage;
}

// Batch result types with token usage
export interface BatchDocumentInterpretResultWithUsage extends BatchDocumentInterpretResult {
  tokenUsage?: MultimodalTokenUsage;
}

export interface BatchAudioInterpretResultWithUsage extends BatchAudioInterpretResult {
  tokenUsage?: MultimodalTokenUsage;
}

export interface BatchVideoInterpretResultWithUsage extends BatchVideoInterpretResult {
  tokenUsage?: MultimodalTokenUsage;
}
