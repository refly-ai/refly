/**
 * Lambda Task and Result DTOs
 *
 * These types define the message envelope format for communication between
 * the API server and Lambda functions via SQS.
 */

// ============================================================================
// Task Types
// ============================================================================

export type LambdaTaskType =
  | 'document-ingest'
  | 'image-transform'
  | 'document-render'
  | 'video-analyze';

export type LambdaJobStatus = 'pending' | 'processing' | 'success' | 'failed';

export type LambdaStorageType = 'temporary' | 'permanent';

// ============================================================================
// Task Envelope (API Server -> Lambda)
// ============================================================================

export interface LambdaTaskEnvelope<TPayload> {
  version: 'v1';
  type: LambdaTaskType;
  jobId: string;
  uid: string;
  payload: TPayload;
  meta: {
    createdAt: string; // ISO 8601
    traceId?: string;
  };
}

// ============================================================================
// Result Envelope (Lambda -> API Server)
// ============================================================================

export interface LambdaResultEnvelope<TPayload> {
  version: 'v1';
  type: LambdaTaskType;
  jobId: string;
  status: 'success' | 'failed';
  payload?: TPayload;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  meta: {
    processingTimeMs: number;
    lambdaRequestId?: string;
  };
}

// ============================================================================
// Task-Specific Payloads
// ============================================================================

export interface OutputFile {
  key: string;
  name: string;
  mimeType: string;
  size: number;
  metadata?: Record<string, unknown>;
}

// Document Ingest
export interface DocumentIngestTaskPayload {
  /** S3 input location */
  s3Input: {
    bucket: string;
    key: string;
  };
  /** S3 output location */
  s3Output: {
    bucket: string;
    prefix: string;
  };
  fileId?: string;
  contentType: string;
  name?: string;
  // todo: ocr and extractImages are not available yet
  options?: {
    extractImages?: boolean;
    ocrEnabled?: boolean;
    outputFormat?: 'markdown' | 'text' | 'json';
    maxPages?: number;
  };
}

export interface DocumentIngestResultPayload {
  /** Primary document output */
  document: OutputFile;
  /** Extracted images */
  images?: OutputFile[];
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    contentSizeBytes?: number;
    title?: string;
  };
}

// Image Transform
export interface ImageTransformTaskPayload {
  /** S3 input location */
  s3Input: {
    bucket: string;
    key: string;
  };
  /** S3 output location */
  s3Output: {
    bucket: string;
    prefix: string;
  };
  fileId?: string;
  name?: string;
  options?: {
    format?: 'webp' | 'jpeg' | 'png';
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
}

export interface ImageTransformResultPayload {
  /** Transformed image output */
  image: OutputFile;
  /** Thumbnail output */
  thumbnail?: OutputFile;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
  };
}

// Document Render (Export)
export interface DocumentRenderTaskPayload {
  /** S3 input location */
  s3Input: {
    bucket: string;
    key: string;
  };
  /** S3 output location */
  s3Output: {
    bucket: string;
    prefix: string;
  };
  fileId?: string;
  name?: string;
  options?: {
    format?: 'pdf' | 'docx';
    template?: string;
    pageSize?: 'A4' | 'Letter';
  };
}

export interface DocumentRenderResultPayload {
  /** Rendered document output */
  document: OutputFile;
  metadata?: {
    pageCount?: number;
    format?: string;
  };
}

// Video Analyze
export interface VideoAnalyzeTaskPayload {
  /** S3 input location */
  s3Input: {
    bucket: string;
    key: string;
  };
  /** S3 output location */
  s3Output: {
    bucket: string;
    prefix: string;
  };
  fileId?: string;
  name?: string;
  options?: {
    frameCount?: number;
    frameFormat?: 'jpeg' | 'png';
    extractAudio?: boolean;
    maxDuration?: number;
  };
}

export interface VideoAnalyzeResultPayload {
  /** Thumbnail image */
  thumbnail?: OutputFile;
  /** Extracted audio (if extractAudio enabled) */
  audio?: OutputFile;
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    codec?: string;
  };
}

// ============================================================================
// Dispatch Parameters (API Layer)
// ============================================================================

export interface DispatchDocumentIngestParams {
  uid: string;
  /** Related drive file ID */
  fileId: string;
  /** Action result ID for linking back */
  resultId?: string;
  /** Action result version for linking back */
  resultVersion?: number;
  /** S3 input location */
  s3Input: {
    bucket: string;
    key: string;
  };
  /** S3 output bucket */
  outputBucket: string;
  contentType: string;
  name?: string;
  options?: DocumentIngestTaskPayload['options'];
}

export interface DispatchImageTransformParams {
  uid: string;
  fileId: string;
  /** Action result ID for linking back */
  resultId?: string;
  /** Action result version for linking back */
  resultVersion?: number;
  /** S3 input location */
  s3Input: {
    bucket: string;
    key: string;
  };
  /** S3 output bucket */
  outputBucket: string;
  name?: string;
  options?: ImageTransformTaskPayload['options'];
}

export interface DispatchDocumentRenderParams {
  uid: string;
  fileId: string;
  /** Action result ID for linking back */
  resultId?: string;
  /** Action result version for linking back */
  resultVersion?: number;
  /** S3 input location */
  s3Input: {
    bucket: string;
    key: string;
  };
  /** S3 output bucket */
  outputBucket: string;
  name?: string;
  format: 'pdf' | 'docx';
  options?: Omit<DocumentRenderTaskPayload['options'], 'format'>;
}

export interface DispatchVideoAnalyzeParams {
  uid: string;
  fileId: string;
  /** Action result ID for linking back */
  resultId?: string;
  /** Action result version for linking back */
  resultVersion?: number;
  /** S3 input location */
  s3Input: {
    bucket: string;
    key: string;
  };
  /** S3 output bucket */
  outputBucket: string;
  name?: string;
  options?: VideoAnalyzeTaskPayload['options'];
}

// ============================================================================
// Lambda Job Record (DB Model interface)
// ============================================================================

export interface LambdaJobRecord {
  jobId: string;
  type: LambdaTaskType;
  uid: string;
  status: LambdaJobStatus;
  name?: string;
  mimeType?: string;
  storageKey?: string;
  storageType: LambdaStorageType;
  fileId?: string;
  resultId?: string;
  resultVersion?: number;
  error?: string;
  durationMs?: number;
  metadata?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Result Handler Types
// ============================================================================

export interface ResultHandlerContext {
  jobId: string;
  type: LambdaTaskType;
  uid: string;
  fileId?: string;
  resultId?: string;
  resultVersion?: number;
}

export type ResultPayload =
  | DocumentIngestResultPayload
  | ImageTransformResultPayload
  | DocumentRenderResultPayload
  | VideoAnalyzeResultPayload;

// ============================================================================
// Effective Status (Computed from status + storageType)
// ============================================================================
