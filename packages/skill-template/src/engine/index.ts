// Removed fs, path, yaml imports
// TODO: Refactor - SkillEngine should ideally receive pre-configured model instance instead of loading config itself.
// Removed direct import of yaml-config.loader from apps/api
import { SkillRunnableConfig } from '../base';
import { FakeListChatModel } from '@langchain/core/utils/testing';
// Ensure ChatDeepSeek import is correct as per plan (it seems correct based on previous read)
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
} from '@refly-packages/openapi-schema';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LlmEndpointConfigLoader } from '../config/llm-endpoint-config-loader'; // Import the interface

// Removed local EndpointConfig interface and module-level cache

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
  private configLoader: LlmEndpointConfigLoader; // Store the injected config loader

  constructor(
    public logger: Logger,
    public service: ReflyService,
    configLoader: LlmEndpointConfigLoader, // Add configLoader to constructor parameters
    private options?: SkillEngineOptions,
  ) {
    this.configLoader = configLoader; // Save the injected instance
    this.options = options;
  }

  setOptions(options: SkillEngineOptions) {
    this.options = options;
  }

  configure(config: SkillRunnableConfig) {
    this.config = config;
  }

  chatModel(params?: Partial<ChatDeepSeekInput>, useDefaultChatModel = false): BaseChatModel {
    // Added: Check for potentially conflicting environment variables
    this.logger.log(`Checking environment variables: OPENAI_API_KEY=${process.env.OPENAI_API_KEY ? '***' : 'Not Set'}, OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY ? '***' : 'Not Set'}, DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY ? '***' : 'Not Set'}`, 'SkillEngine');
    // Removed old file loading logic. Configuration is now loaded by the unified loader.

    // Handle mock response (existing logic)
    if (process.env.MOCK_LLM_RESPONSE) {
      this.logger.log('Using mock LLM response.', 'SkillEngine');
      return new FakeListChatModel({
        responses: ['This is a test'],
        sleep: 100,
      });
    }

    // Determine the requested model name
    const config = this.config?.configurable;
    const requestedModelName = useDefaultChatModel
      ? this.options.defaultModel
      : config?.modelInfo?.name || this.options.defaultModel;

    if (!requestedModelName) {
      this.logger.error('No model name specified (neither in config nor default).', undefined, 'SkillEngine');
      throw new Error('Cannot instantiate chat model: No model name specified.');
    }
    this.logger.log(`Attempting to find configuration for model: ${requestedModelName}`, 'SkillEngine');

    // Find the endpoint configuration using the unified loader
    // Use the injected configLoader to find the endpoint config
    const foundEndpoint = this.configLoader.findLlmEndpointConfig(requestedModelName);

    if (!foundEndpoint) {
      // Updated error message to refer to the unified config file
      this.logger.error(`Configuration not found for model "${requestedModelName}" in models.config.yaml`, undefined, 'SkillEngine');
      // Keep error message consistent, referring to the central config file
      this.logger.error(`Configuration not found for model "${requestedModelName}" in models.config.yaml`, undefined, 'SkillEngine');
      throw new Error(`Configuration not found for model: ${requestedModelName} in models.config.yaml`);
    }

    this.logger.log(`Found endpoint "${foundEndpoint.name}" for model "${requestedModelName}". Instantiating ChatDeepSeek.`, 'SkillEngine');

    // Instantiate ChatDeepSeek using the found configuration
    // Note: ChatDeepSeek constructor takes ChatDeepSeekInput, which doesn't directly have 'configuration'.
    // However, its own constructor internally creates a 'configuration' object for the super(ChatOpenAI) call.
    // We need to pass baseURL and headers in a way that ChatOpenAIFields (which ChatDeepSeekInput extends) or ChatOpenAI constructor expects.
    // ChatOpenAIFields includes 'configuration' which takes 'basePath' (alias for baseURL) and 'baseOptions.headers'.

    const chatDeepSeekParams: Partial<ChatDeepSeekInput> & { configuration?: Record<string, any> } = {
      // Core parameters from config file directly supported by ChatDeepSeekInput
      model: requestedModelName,
      apiKey: foundEndpoint.api_key,

      // Merge runtime parameters supported by ChatDeepSeekInput
      temperature: params?.temperature,
      maxTokens: params?.maxTokens,
      streaming: params?.streaming,
      stop: params?.stop, // Pass stop sequences if provided

      // Specific parameters for ChatDeepSeek
      include_reasoning: params?.include_reasoning ?? config?.modelInfo?.capabilities?.reasoning,

      // Pass other runtime params if they exist in ChatDeepSeekInput
      // (Example: Assuming other relevant params might be in params)
      // ...params, // Be cautious with spreading params directly

      // Handle configuration (baseURL, headers) via the 'configuration' field expected by ChatOpenAIFields/ChatOpenAI constructor
      configuration: {
        // Use 'basePath' for baseURL as expected by ChatOpenAI's configuration
        baseURL: foundEndpoint.base_url, // Map base_url from EndpointConfig
        // Pass headers within 'baseOptions' as expected by ChatOpenAI's configuration
        baseOptions: {
          headers: {
            ...(foundEndpoint.configuration?.defaultHeaders || {}), // Merge headers from endpoint config
            // Removed attempt to merge headers from params.configuration as params type doesn't support it
            // ...((params?.configuration as any)?.headers || {}),
          },
        },
        // Merge other potential configuration options from endpoint config's 'configuration' field
        // Be careful not to overwrite basePath or baseOptions handled above
        ...(foundEndpoint.configuration || {}),
        // Ensure defaultHeaders isn't duplicated if already handled in baseOptions
        defaultHeaders: undefined,
      },
    };

    // Clean up undefined/empty configuration fields to avoid passing potentially problematic values
    if (!chatDeepSeekParams.configuration?.basePath) {
      delete chatDeepSeekParams.configuration?.basePath;
    }
    if (Object.keys(chatDeepSeekParams.configuration?.baseOptions?.headers ?? {}).length === 0) {
       if (chatDeepSeekParams.configuration?.baseOptions) {
          delete chatDeepSeekParams.configuration.baseOptions.headers;
       }
       // If baseOptions is now empty (only had headers), remove it too
       if (Object.keys(chatDeepSeekParams.configuration?.baseOptions ?? {}).length === 0) {
         delete chatDeepSeekParams.configuration?.baseOptions;
       }
    }
    // Remove the entire configuration object if it's effectively empty after cleanup
    if (chatDeepSeekParams.configuration && Object.keys(chatDeepSeekParams.configuration).length === 0) {
        delete chatDeepSeekParams.configuration;
    }

    // Added log to inspect parameters before instantiation
    this.logger.log(`Instantiating ChatDeepSeek with params: ${JSON.stringify(chatDeepSeekParams, null, 2)}`, 'SkillEngine');
    const modelInstance = new ChatDeepSeek(chatDeepSeekParams);

    return modelInstance;
  }
}
