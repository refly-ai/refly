import { SkillRunnableConfig } from '../base';

import { FakeListChatModel } from '@langchain/core/utils/testing';
import { OpenAIBaseInput } from '@langchain/openai';
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
  ModelScene,
  ListMcpServersData,
  ListMcpServersResponse,
} from '@refly/openapi-schema';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getChatModel } from '@refly/providers';

// TODO: unify with frontend
export type ContentNodeType =
  | 'resource'
  | 'document'
  | 'extensionWeblink'
  | 'resourceSelection'
  | 'documentSelection'
  | 'urlSource';

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
  listMcpServers: (user: User, req: ListMcpServersData['query']) => Promise<ListMcpServersResponse>;

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
    user: User,
    query: string,
    results: SearchResult[],
    options?: { topN?: number; relevanceThreshold?: number },
  ) => Promise<RerankResponse>;
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

  // New method to crawl URLs and get their content
  crawlUrl: (
    user: User,
    url: string,
  ) => Promise<{ title?: string; content?: string; metadata?: Record<string, any> }>;
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
    this.options = options;
  }

  setOptions(options: SkillEngineOptions) {
    this.options = options;
  }

  configure(config: SkillRunnableConfig) {
    this.config = config;
  }

  chatModel(params?: Partial<OpenAIBaseInput>, scene?: ModelScene): BaseChatModel {
    if (process.env.MOCK_LLM_RESPONSE) {
      return new FakeListChatModel({
        responses: ['This is a test'],
        sleep: 100,
      });
    }

    const finalScene = scene || 'chat';

    const config = this.config?.configurable;
    const provider = config?.provider;
    const model = config.modelConfigMap?.[finalScene]?.modelId || this.options.defaultModel;

    return getChatModel(
      provider,
      {
        modelId: model,
        modelName: model,
      },
      params,
    );
  }
}
