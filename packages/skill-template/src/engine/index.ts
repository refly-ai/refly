import { SkillRunnableConfig } from '../base';
import { ChatDeepSeek, ChatDeepSeekInput } from './chat-deepseek';
import { Document } from '@langchain/core/documents';
import {
  CreateLabelClassRequest,
  CreateLabelClassResponse,
  CreateLabelInstanceRequest,
  CreateLabelInstanceResponse,
  CreateResourceResponse,
  GetResourceDetailResponse,
  SearchRequest,
  SearchResponse,
  UpdateResourceResponse,
  UpsertResourceRequest,
  User,
  UpsertCanvasRequest,
  CreateCanvasResponse,
  ResourceType,
  InMemorySearchResponse,
  SearchOptions,
  WebSearchRequest,
  WebSearchResponse,
  ListCanvasesData,
  AddReferencesRequest,
  AddReferencesResponse,
  DeleteReferencesRequest,
  DeleteReferencesResponse,
  GetResourceDetailData,
  BatchCreateResourceResponse,
  SearchResult,
  RerankResponse,
  BatchWebSearchRequest,
  GetDocumentDetailData,
  UpsertDocumentRequest,
  ListDocumentsData,
  CreateDocumentResponse,
  GetDocumentDetailResponse,
  ListDocumentsResponse,
  ListCanvasesResponse,
  DeleteCanvasResponse,
  DeleteCanvasRequest,
  DeleteDocumentResponse,
  DeleteDocumentRequest,
  ExtractRequest,
  ExtractResponse,
} from '@refly-packages/openapi-schema';

// TODO: unify with frontend
export type ContentNodeType =
  | 'resource'
  | 'document'
  | 'extensionWeblink'
  | 'resourceSelection'
  | 'documentSelection';

export interface NodeMeta {
  title: string;
  nodeType: ContentNodeType;
  url?: string;
  canvasId?: string;
  resourceId?: string;
  resourceType?: ResourceType;
  [key: string]: any; // any other fields
}

export interface ReflyService {
  createCanvas: (user: User, req: UpsertCanvasRequest) => Promise<CreateCanvasResponse>;
  listCanvases: (user: User, param: ListCanvasesData['query']) => Promise<ListCanvasesResponse>;
  deleteCanvas: (user: User, req: DeleteCanvasRequest) => Promise<DeleteCanvasResponse>;
  getDocumentDetail: (
    user: User,
    req: GetDocumentDetailData['query'],
  ) => Promise<GetDocumentDetailResponse>;
  createDocument: (user: User, req: UpsertDocumentRequest) => Promise<CreateDocumentResponse>;
  listDocuments: (user: User, param: ListDocumentsData['query']) => Promise<ListDocumentsResponse>;
  deleteDocument: (user: User, req: DeleteDocumentRequest) => Promise<DeleteDocumentResponse>;
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
  createLabelClass: (user: User, req: CreateLabelClassRequest) => Promise<CreateLabelClassResponse>;
  createLabelInstance: (
    user: User,
    req: CreateLabelInstanceRequest,
  ) => Promise<CreateLabelInstanceResponse>;
  webSearch: (
    user: User,
    req: WebSearchRequest | BatchWebSearchRequest,
  ) => Promise<WebSearchResponse>;
  search: (user: User, req: SearchRequest, options?: SearchOptions) => Promise<SearchResponse>;
  rerank: (
    query: string,
    results: SearchResult[],
    options?: { topN?: number; relevanceThreshold?: number },
  ) => Promise<RerankResponse>;
  extract: (user: User, req: ExtractRequest) => Promise<ExtractResponse>;
  addReferences: (user: User, req: AddReferencesRequest) => Promise<AddReferencesResponse>;
  deleteReferences: (user: User, req: DeleteReferencesRequest) => Promise<DeleteReferencesResponse>;
  inMemorySearchWithIndexing: (
    user: User,
    options: {
      content: string | Document<any> | Array<Document<any>>;
      query?: string;
      k?: number;
      filter?: (doc: Document<NodeMeta>) => boolean;
      needChunk?: boolean;
      additionalMetadata?: Record<string, any>;
    },
  ) => Promise<InMemorySearchResponse>;
}

export interface SkillEngineOptions {
  defaultModel?: string;
}

export interface Logger {
  /**
   * Write an 'error' level log.
   */
  error(message: any, stack?: string, context?: string): void;
  error(message: any, ...optionalParams: [...any, string?, string?]): void;
  /**
   * Write a 'log' level log.
   */
  log(message: any, context?: string): void;
  log(message: any, ...optionalParams: [...any, string?]): void;
  /**
   * Write a 'warn' level log.
   */
  warn(message: any, context?: string): void;
  warn(message: any, ...optionalParams: [...any, string?]): void;
  /**
   * Write a 'debug' level log.
   */
  debug(message: any, context?: string): void;
  debug(message: any, ...optionalParams: [...any, string?]): void;
}

export class SkillEngine {
  private config: SkillRunnableConfig;

  constructor(
    public logger: Logger,
    public service: ReflyService,
    private options?: SkillEngineOptions,
  ) {
    this.options = {
      defaultModel: 'openai/gpt-4o-mini',
      ...options,
    };
  }

  configure(config: SkillRunnableConfig) {
    this.config = config;
  }

  chatModel(params?: Partial<ChatDeepSeekInput>): ChatDeepSeek {
    return new ChatDeepSeek({
      model: this.config?.configurable?.modelInfo?.name || this.options.defaultModel,
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: process.env.OPENROUTER_API_KEY && 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://refly.ai',
          'X-Title': 'Refly',
        },
      },
      ...params,
      include_reasoning: true,
    });
  }
}
