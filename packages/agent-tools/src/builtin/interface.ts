import {
  CreateResourceResponse,
  GetResourceDetailResponse,
  SearchRequest,
  SearchResponse,
  UpdateResourceResponse,
  UpsertResourceRequest,
  User,
  Document,
  CodeArtifact,
  UpsertCanvasRequest,
  CreateCanvasResponse,
  InMemorySearchResponse,
  SearchOptions,
  WebSearchRequest,
  WebSearchResponse,
  ListCanvasesData,
  GetResourceDetailData,
  BatchCreateResourceResponse,
  SearchResult,
  RerankResponse,
  BatchWebSearchRequest,
  GetDocumentDetailData,
  UpsertDocumentRequest,
  ListDocumentsData,
  GetDocumentDetailResponse,
  ListCanvasesResponse,
  DeleteCanvasResponse,
  DeleteCanvasRequest,
  DeleteDocumentRequest,
  MediaGenerateRequest,
  MediaGenerationResult,
  GetActionResultData,
  SendEmailRequest,
  BaseResponse,
  UpsertCodeArtifactRequest,
  UploadResponse,
  FileVisibility,
  EntityType,
  SandboxExecuteRequest,
  SandboxExecuteResponse,
  DriveFile,
  UpsertDriveFileRequest,
  WorkflowPlan,
  WorkflowPlanRecord,
} from '@refly/openapi-schema';
import type { WorkflowPatchOperation } from '@refly/canvas-common';
import { Document as LangChainDocument } from '@langchain/core/documents';

export interface ReflyService {
  createCanvas: (user: User, req: UpsertCanvasRequest) => Promise<CreateCanvasResponse>;
  listCanvases: (user: User, param: ListCanvasesData['query']) => Promise<ListCanvasesResponse>;
  deleteCanvas: (user: User, req: DeleteCanvasRequest) => Promise<DeleteCanvasResponse>;
  getDocumentDetail: (
    user: User,
    req: GetDocumentDetailData['query'],
  ) => Promise<GetDocumentDetailResponse>;
  createDocument: (user: User, req: UpsertDocumentRequest) => Promise<Document>;
  listDocuments: (user: User, param: ListDocumentsData['query']) => Promise<Document[]>;
  deleteDocument: (user: User, req: DeleteDocumentRequest) => Promise<void>;
  getResourceDetail: (
    user: User,
    req: GetResourceDetailData['query'],
  ) => Promise<GetResourceDetailResponse>;
  createResource: (user: User, req: UpsertResourceRequest) => Promise<CreateResourceResponse>;
  batchCreateResource: (
    user: User,
    req: UpsertResourceRequest[],
  ) => Promise<BatchCreateResourceResponse>;
  updateResource: (user: User, req: UpsertResourceRequest) => Promise<UpdateResourceResponse>;
  createCodeArtifact: (user: User, req: UpsertCodeArtifactRequest) => Promise<CodeArtifact>;
  webSearch: (
    user: User,
    req: WebSearchRequest | BatchWebSearchRequest,
  ) => Promise<WebSearchResponse>;
  librarySearch: (
    user: User,
    req: SearchRequest,
    options?: SearchOptions,
  ) => Promise<SearchResponse>;
  rerank: (
    user: User,
    query: string,
    results: SearchResult[],
    options?: { topN?: number; relevanceThreshold?: number },
  ) => Promise<RerankResponse>;
  readFile: (user: User, fileId: string) => Promise<DriveFile>;
  listFiles: (
    user: User,
    canvasId: string,
    source?: 'manual' | 'variable' | 'agent',
  ) => Promise<DriveFile[]>;
  writeFile: (user: User, param: UpsertDriveFileRequest) => Promise<DriveFile>;
  inMemorySearchWithIndexing: (
    user: User,
    options: {
      content: string | LangChainDocument<any> | Array<LangChainDocument<any>>;
      query?: string;
      k?: number;
      filter?: (doc: LangChainDocument) => boolean;
      needChunk?: boolean;
      additionalMetadata?: Record<string, any>;
    },
  ) => Promise<InMemorySearchResponse>;

  // New method to crawl URLs and get their content
  crawlUrl: (
    user: User,
    url: string,
  ) => Promise<{ title?: string; content?: string; metadata?: Record<string, any> }>;

  sendEmail: (user: User, req: SendEmailRequest) => Promise<BaseResponse>;
  processURL: (url: string) => Promise<string>;
  batchProcessURL: (urls: string[]) => Promise<string[]>;

  downloadFileFromUrl: (url: string) => Promise<Buffer>;
  downloadFile: (params: { storageKey: string; visibility?: FileVisibility }) => Promise<Buffer>;
  downloadFileToPath: (params: {
    storageKey: string;
    visibility?: FileVisibility;
    extension?: string;
  }) => Promise<string>;
  uploadFile: (
    user: User,
    param: {
      file: {
        buffer: Buffer;
        mimetype?: string;
        originalname: string;
      };
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
      storageKey?: string;
    },
  ) => Promise<UploadResponse['data']>;
  uploadBase64: (
    user: User,
    param: {
      base64: string;
      filename?: string;
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
      storageKey?: string;
    },
  ) => Promise<UploadResponse['data']>;
  genImageID: () => Promise<string>;
  // Generate JWT token for user (same as AuthService.login)
  generateJwtToken: (user: User) => Promise<string>;

  generateMedia: (user: User, req: MediaGenerateRequest) => Promise<MediaGenerationResult>;
  getActionResult(user: User, param: GetActionResultData['query']): Promise<any>;
  createShareForDriveFile: (
    user: User,
    fileId: string,
  ) => Promise<{
    url: string; // Share page URL (for links/previews)
    contentUrl: string; // Direct file content URL (for <img src="">)
    shareId: string;
    driveFile: DriveFile;
  }>;

  getUserMediaConfig(
    user: User,
    mediaType: 'image' | 'audio' | 'video',
    model?: string,
    provider?: string,
  ): Promise<{
    provider: string;
    providerItemId: string;
    model: string;
  } | null>;

  // Sandbox code execution
  execute: (user: User, request: SandboxExecuteRequest) => Promise<SandboxExecuteResponse>;

  // Workflow plan management
  generateWorkflowPlan: (
    user: User,
    params: {
      data: WorkflowPlan;
      copilotSessionId: string;
      resultId: string;
      resultVersion: number;
    },
  ) => Promise<WorkflowPlanRecord>;
  patchWorkflowPlan: (
    user: User,
    params: {
      planId: string;
      operations: WorkflowPatchOperation[];
      resultId: string;
      resultVersion: number;
    },
  ) => Promise<WorkflowPlanRecord>;
  getLatestWorkflowPlan: (
    user: User,
    params: { copilotSessionId: string },
  ) => Promise<WorkflowPlanRecord | null>;
  getWorkflowPlanById: (
    user: User,
    params: { planId: string },
  ) => Promise<WorkflowPlanRecord | null>;

  // Vision AI - Gemini multimodal image analysis
  visionRead?: (
    user: User,
    params: {
      fileId: string;
      query?: string;
      mode?: 'general' | 'ocr' | 'data';
    },
  ) => Promise<{
    success: boolean;
    errCode?: string;
    errMsg?: string;
    data?: {
      analysis: string;
      fileName?: string;
      fileId: string;
    };
  }>;

  // Batch Vision AI - Process multiple images in a single call
  batchVisionRead?: (
    user: User,
    params: {
      fileIds: string[];
      query?: string;
      mode?: 'general' | 'ocr' | 'data';
    },
  ) => Promise<{
    success: boolean;
    errCode?: string;
    errMsg?: string;
    data?: {
      analysis: string;
      fileNames?: string[];
      fileIds: string[];
    };
  }>;

  // Get image data for vision processing (downloads to local temp file)
  getImageData?: (
    user: User,
    fileId: string,
  ) => Promise<{
    filePath: string;
    mimeType: string;
    fileName: string;
  } | null>;

  // Get multimodal client (for internal use by vision tools)
  getMultimodalClient?: () => any;

  // ============================================================================
  // Video Understanding - Gemini multimodal video analysis
  // ============================================================================

  /**
   * Analyze video content (file or YouTube URL)
   */
  videoUnderstanding?: (
    user: User,
    params: {
      /** Video file ID (mutually exclusive with youtubeUrl) */
      fileId?: string;
      /** YouTube URL (mutually exclusive with fileId) */
      youtubeUrl?: string;
      /** Analysis question or focus area */
      query?: string;
      /** Analysis mode */
      mode?: 'general' | 'transcript' | 'timeline';
      /** MIME type / content type (optional, avoids re-querying if provided) */
      contentType?: string;
    },
  ) => Promise<{
    success: boolean;
    errCode?: string;
    errMsg?: string;
    data?: {
      analysis: string;
      timestamps?: Array<{ timestamp: string; description: string }>;
      fileName?: string;
      fileId?: string;
    };
  }>;

  // ============================================================================
  // Document Processing - Gemini multimodal PDF analysis
  // ============================================================================

  /**
   * Process and analyze documents (PDF and other supported formats)
   */
  documentProcessing?: (
    user: User,
    params: {
      /** Document file ID */
      fileId: string;
      /** Analysis question or focus area */
      query?: string;
      /** Processing mode */
      mode?: 'summary' | 'extract' | 'qa';
      /** Page range to process */
      pageRange?: { start?: number; end?: number };
      /** MIME type / content type (optional, avoids re-querying if provided) */
      contentType?: string;
    },
  ) => Promise<{
    success: boolean;
    errCode?: string;
    errMsg?: string;
    data?: {
      analysis: string;
      tables?: Array<{
        title?: string;
        headers: string[];
        rows: string[][];
        pageNumber?: number;
      }>;
      structure?: {
        title?: string;
        pageCount: number;
        sections: Array<{ title: string; level: number; pageNumber?: number }>;
      };
      fileName?: string;
      fileId: string;
    };
  }>;

  // ============================================================================
  // Audio Understanding - Gemini multimodal audio analysis
  // ============================================================================

  /**
   * Analyze audio content (transcription, summarization, Q&A, speaker diarization)
   */
  audioUnderstanding?: (
    user: User,
    params: {
      /** Audio file ID */
      fileId: string;
      /** Analysis question or focus area */
      query?: string;
      /** Analysis mode */
      mode?: 'transcription' | 'summary' | 'qa' | 'speaker_diarization';
      /** Audio language hint */
      language?: string;
      /** MIME type / content type (optional, avoids re-querying if provided) */
      contentType?: string;
    },
  ) => Promise<{
    success: boolean;
    errCode?: string;
    errMsg?: string;
    data?: {
      analysis: string;
      transcript?: {
        text: string;
        segments?: Array<{
          start: string;
          end: string;
          text: string;
          speaker?: string;
        }>;
        detectedLanguage?: string;
      };
      speakers?: Array<{
        speaker: string;
        start: string;
        end: string;
        text: string;
      }>;
      fileName?: string;
      fileId: string;
    };
  }>;

  // ============================================================================
  // Batch Multimodal Processing - Process multiple files in single API calls
  // ============================================================================

  /**
   * Batch video understanding - analyze multiple videos in a single call
   * Always uses File API for video files
   */
  batchVideoUnderstanding?: (
    user: User,
    params: {
      /** Video file IDs */
      fileIds: string[];
      /** YouTube URLs (can be mixed with fileIds) */
      youtubeUrls?: string[];
      /** Analysis question or focus area */
      query?: string;
      /** Analysis mode */
      mode?: 'general' | 'transcript' | 'timeline';
    },
  ) => Promise<{
    success: boolean;
    errCode?: string;
    errMsg?: string;
    data?: {
      analysis: string;
      fileIds: string[];
      fileNames?: string[];
    };
  }>;

  /**
   * Batch document processing - analyze multiple PDFs in a single call
   * Uses File API for documents >= 2MB, inline base64 for smaller documents
   */
  batchDocumentProcessing?: (
    user: User,
    params: {
      /** Document file IDs */
      fileIds: string[];
      /** Analysis question or focus area */
      query?: string;
      /** Processing mode */
      mode?: 'summary' | 'extract' | 'qa';
    },
  ) => Promise<{
    success: boolean;
    errCode?: string;
    errMsg?: string;
    data?: {
      analysis: string;
      fileIds: string[];
      fileNames?: string[];
    };
  }>;

  /**
   * Batch audio understanding - analyze multiple audio files in a single call
   * Always uses File API for audio files
   */
  batchAudioUnderstanding?: (
    user: User,
    params: {
      /** Audio file IDs */
      fileIds: string[];
      /** Analysis question or focus area */
      query?: string;
      /** Analysis mode */
      mode?: 'transcription' | 'summary' | 'qa' | 'speaker_diarization';
      /** Audio language hint */
      language?: string;
    },
  ) => Promise<{
    success: boolean;
    errCode?: string;
    errMsg?: string;
    data?: {
      analysis: string;
      fileIds: string[];
      fileNames?: string[];
    };
  }>;

  // ============================================================================
  // Speech Generation (TTS) - Gemini text-to-speech
  // ============================================================================

  /**
   * Generate speech from text
   * Audio is automatically uploaded to storage
   */
  speechGeneration?: (
    user: User,
    params: {
      /** Text to convert to speech */
      text: string;
      /** Voice name (default: Kore) */
      voice?: string;
      /** Language code (e.g., "en-US", "zh-CN") */
      language?: string;
    },
  ) => Promise<{
    success: boolean;
    errCode?: string;
    errMsg?: string;
    data?: {
      /** File identifier (storageKey) */
      fileId: string;
      /** Generated audio file name */
      fileName: string;
      /** Audio duration in milliseconds */
      durationMs: number;
      /** Storage key for accessing the file */
      storageKey?: string;
    };
  }>;

  /**
   * Get list of available TTS voices
   */
  getAvailableTTSVoices?: () => string[];

  // ============================================================================
  // Get file data for multimodal processing
  // ============================================================================

  /**
   * Get video data for processing (downloads to local temp file)
   */
  getVideoData?: (
    user: User,
    fileId: string,
  ) => Promise<{
    filePath: string;
    mimeType: string;
    fileName: string;
  } | null>;

  /**
   * Get document data for processing (downloads to local temp file)
   */
  getDocumentData?: (
    user: User,
    fileId: string,
  ) => Promise<{
    filePath: string;
    mimeType: string;
    fileName: string;
  } | null>;

  /**
   * Get audio data for processing (downloads to local temp file)
   */
  getAudioData?: (
    user: User,
    fileId: string,
  ) => Promise<{
    filePath: string;
    mimeType: string;
    fileName: string;
  } | null>;
}
