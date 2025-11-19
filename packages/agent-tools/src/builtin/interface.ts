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
  CanvasNode,
  FishAudioTextToSpeechRequest,
  FishAudioTextToSpeechResponse,
  FishAudioSpeechToTextRequest,
  FishAudioSpeechToTextResponse,
  HeyGenGenerateVideoRequest,
  HeyGenGenerateVideoResponse,
  DriveFile,
  UpsertDriveFileRequest,
} from '@refly/openapi-schema';
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
  addNodeToCanvasWithoutCanvasId: (
    user: User,
    node: Pick<CanvasNode, 'type' | 'data'> & Partial<Pick<CanvasNode, 'id'>>,
    connectTo?: any,
    options?: { autoLayout?: boolean },
  ) => Promise<void>;
  genImageID: () => Promise<string>;
  // Generate JWT token for user (same as AuthService.login)
  generateJwtToken: (user: User) => Promise<string>;

  generateMedia: (user: User, req: MediaGenerateRequest) => Promise<MediaGenerationResult>;
  getActionResult(user: User, param: GetActionResultData['query']): Promise<any>;

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

  textToSpeech: (
    user: User,
    request: FishAudioTextToSpeechRequest,
  ) => Promise<FishAudioTextToSpeechResponse>;
  speechToText: (
    user: User,
    request: FishAudioSpeechToTextRequest,
  ) => Promise<FishAudioSpeechToTextResponse>;

  // HeyGen video generation methods
  generateVideo: (
    user: User,
    request: HeyGenGenerateVideoRequest,
  ) => Promise<HeyGenGenerateVideoResponse>;
}
