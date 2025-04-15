import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import { Document, DocumentInterface } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { FireworksEmbeddings } from '@langchain/community/embeddings/fireworks';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { cleanMarkdownForIngest } from '@refly-packages/utils';
import * as avro from 'avsc';

import { SearchResult, User } from '@refly-packages/openapi-schema';
import { HybridSearchParam, ContentPayload, ReaderResult, DocumentPayload } from './rag.dto';
import { QdrantService } from '@/common/qdrant.service';
import { Condition, PointStruct } from '@/common/qdrant.dto';
import { genResourceUuid } from '@/utils';
import { JinaEmbeddings } from '@/utils/embeddings/jina';
// Removed fs and yaml imports for embedding config
import { OllamaEmbeddings } from '@langchain/ollama';
// Import unified config loader functions
import {
  getEmbeddingProviderConfig,
  getRerankDefaultProvider,
  getRerankProviderConfig,
} from '@/config/yaml-config.loader';
// Removed fs and yaml imports for reranker config
import { RerankerInterface } from './rerankers/reranker.interface';
import { JinaReranker } from './rerankers/jina.reranker';
import { XinferenceReranker } from './rerankers/xinference.reranker';
// --- End: Added Imports ---

const READER_URL = 'https://r.jina.ai/';

// Removed old module-level embedding YAML config loading logic

// Removed old module-level reranker YAML config loading logic

interface JinaRerankerResponse {
  results: {
    document: { text: string };
    relevance_score: number;
  }[];
}

// Define Avro schema for vector points (must match the one used for serialization)
const avroSchema = avro.Type.forSchema({
  type: 'array',
  items: {
    type: 'record',
    name: 'Point',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'vector', type: { type: 'array', items: 'float' } },
      { name: 'payload', type: 'string' }, // JSON string of payload
      {
        name: 'metadata',
        type: {
          type: 'record',
          name: 'Metadata',
          fields: [
            { name: 'nodeType', type: 'string' },
            { name: 'entityId', type: 'string' },
            { name: 'originalUid', type: 'string' },
          ],
        },
      },
    ],
  },
});

@Injectable()
export class RAGService {
  private embeddings: Embeddings | null = null; // Allow null for initialization failures, initialize
  private splitter: RecursiveCharacterTextSplitter;
  private cache: LRUCache<string, ReaderResult>; // url -> reader result
  private logger = new Logger(RAGService.name);
  private reranker: RerankerInterface; // Reranker instance
  // Note: cachedRerankModelsConfig is now loaded at module level (see above)

  constructor(
    private config: ConfigService,
    private qdrant: QdrantService,
  ) {
    const provider = this.config.get('embeddings.provider');
    // Note: this.embeddings initialized to null above
    if (provider === 'fireworks') {
      this.embeddings = new FireworksEmbeddings({
        modelName: this.config.getOrThrow('embeddings.modelName'),
        batchSize: this.config.getOrThrow('embeddings.batchSize'),
        maxRetries: 3,
      });
    } else if (provider === 'jina') {
      this.embeddings = new JinaEmbeddings({
        modelName: this.config.getOrThrow('embeddings.modelName'),
        batchSize: this.config.getOrThrow('embeddings.batchSize'),
        dimensions: this.config.getOrThrow('embeddings.dimensions'),
        apiKey: this.config.getOrThrow('credentials.jina'),
        maxRetries: 3,
      });
    } else if (provider === 'openai') {
      this.embeddings = new OpenAIEmbeddings({
        modelName: this.config.getOrThrow('embeddings.modelName'),
        batchSize: this.config.getOrThrow('embeddings.batchSize'),
        dimensions: this.config.getOrThrow('embeddings.dimensions'),
        timeout: 5000,
        maxRetries: 3,
      });
    } else if (provider === 'ollama') {
      // Use unified loader to get Ollama config
      const ollamaConfig = getEmbeddingProviderConfig('ollama');

      if (!ollamaConfig) {
        this.logger.warn(
          `Ollama provider selected, but configuration is missing in models.config.yaml. Ollama embeddings will be unavailable.`,
        );
        this.embeddings = null;
      } else {
        const baseUrl = ollamaConfig.baseUrl;
        const defaultModel = ollamaConfig.defaultModel;
        // const modelNameFromEnv = this.config.get('embeddings.modelName'); // No longer read/prioritize .env for Ollama model
        const finalModelName = defaultModel; // Always use YAML default for Ollama

        if (!baseUrl) {
          this.logger.error(
            `Ollama 'baseUrl' is missing in the configuration (models.config.yaml). Ollama embeddings cannot be initialized.`,
          );
          this.embeddings = null;
        } else if (!finalModelName) {
          this.logger.error(
            `Ollama model name is missing (neither EMBEDDINGS_MODEL_NAME in .env nor defaultModel in models.config.yaml is set). Ollama embeddings cannot be initialized.`,
          );
          this.embeddings = null;
        } else {
          this.logger.log(
            `Initializing Ollama embeddings with model: ${finalModelName}, baseUrl: ${baseUrl}`,
          );
          try {
            this.embeddings = new OllamaEmbeddings({
              model: finalModelName,
              baseUrl: baseUrl,
              // Add other relevant parameters if needed and supported by OllamaEmbeddings
            });
          } catch (initError) {
            this.logger.error(
              `Failed to initialize OllamaEmbeddings: ${initError.message}`,
              initError.stack,
            );
            this.embeddings = null; // Ensure it's null on init error
          }
        }
      }
      // Check specifically for Ollama initialization failure
      if (this.embeddings === null && provider === 'ollama') {
        this.logger.error(
          'Ollama embeddings could not be initialized due to configuration issues or instantiation error.',
        );
        // Decide if this is a fatal error for the service. If so:
        // throw new Error('Ollama embeddings failed to initialize.');
      }
    }

    // Final check after all providers attempted
    if (this.embeddings === null) {
      // Modified final check
      // If embeddings is still null after trying all providers (or the selected one failed)
      this.logger.error(`Embeddings provider '${provider}' could not be initialized successfully.`);
      // Depending on requirements, either throw an error or allow service to run with null embeddings
      // Option 1: Throw error to prevent service start/usage without embeddings
      // throw new Error(`Embeddings provider '${provider}' failed to initialize.`);
      // Option 2: Log warning and continue (downstream methods need to handle null this.embeddings)
      this.logger.warn(
        `RAGService initialized, but embeddings are unavailable for provider '${provider}'.`,
      );
    }

    this.splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
      chunkSize: 1000,
      chunkOverlap: 0,
    });
    this.cache = new LRUCache({ max: 1000 });

    // --- Start: Reranker Initialization Logic ---
    this.initializeReranker();
    // --- End: Reranker Initialization Logic ---
  }

  private initializeReranker(): void {
    // Determine the provider using the unified loader
    let provider = getRerankDefaultProvider();

    if (!provider) {
      this.logger.log(`Default reranker provider not defined in models.config.yaml. Defaulting to 'jina'.`);
      provider = 'jina'; // Fallback default
    } else {
      this.logger.log(`Using default reranker provider from config: ${provider}`);
    }


    // Instantiate the Reranker based on the provider
    try {
      if (provider === 'xinference') {
        // Get Xinference config using the unified loader
        const xinferenceConfig = getRerankProviderConfig('xinference');

        if (!xinferenceConfig) {
          throw new Error(
            `Provider 'xinference' selected, but its configuration is missing in models.config.yaml.`,
          );
        }

        // Validate required fields for Xinference (as per final plan)
        if (
            !xinferenceConfig.baseUrl ||
            !xinferenceConfig.modelName ||
            xinferenceConfig.topN === undefined ||
            xinferenceConfig.relevanceThreshold === undefined
           ) {
             throw new Error(
               'Xinference configuration in models.config.yaml is missing required fields: baseUrl, modelName, topN, relevanceThreshold.',
             );
        }

        // Pass required fields explicitly after validation to satisfy XinferenceRerankerConfig type
        this.reranker = new XinferenceReranker({
          type: 'xinference',
          baseUrl: xinferenceConfig.baseUrl, // Guaranteed to exist due to check above
          modelName: xinferenceConfig.modelName,
          topN: xinferenceConfig.topN,
          relevanceThreshold: xinferenceConfig.relevanceThreshold,
          apiKey: xinferenceConfig.apiKey, // Pass apiKey (optional)
          // Pass any other optional fields defined in RerankProviderConfig if needed
          // (assuming XinferenceRerankerConfig handles extra fields or they are not needed)
        });
        this.logger.log('Successfully initialized XinferenceReranker.');

      } else if (provider === 'jina') {
         // Jina is the default or explicitly selected
         this.reranker = new JinaReranker(this.config);
         this.logger.log('Successfully initialized JinaReranker (default or selected).');
      }
      // Add else if blocks here for other providers like 'ollama' when implemented
      else {
        // Unsupported provider explicitly set in YAML
        throw new Error(`Unsupported reranker provider specified: ${provider}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize selected reranker provider '${provider}': ${error.message}. Falling back to Jina Reranker.`,
        error.stack,
      );
      // Fallback to JinaReranker
      try {
        this.reranker = new JinaReranker(this.config);
        this.logger.warn('Initialized JinaReranker as fallback.');
      } catch (fallbackError) {
         // If even Jina fails (e.g., missing JINA_API_KEY), log critical error.
         // The application might not function correctly without any reranker.
         this.logger.error(
             `CRITICAL: Failed to initialize fallback JinaReranker: ${fallbackError.message}. Reranking will likely fail.`,
             fallbackError.stack
         );
         // Assign null or a dummy implementation if necessary to prevent crashes,
         // though ideally the service should handle this state gracefully.
         // For now, let's assume Jina constructor might throw but we proceed.
         // this.reranker = null; // Or a NoOpReranker implementation
      }
    }

    // Final check if reranker is somehow still undefined (shouldn't happen with fallback)
     if (!this.reranker) {
        this.logger.error("CRITICAL: Reranker instance could not be initialized.");
        // Handle this critical state, maybe throw an error to stop service startup
        // throw new Error("Failed to initialize any reranker provider.");
     }
  }

  async crawlFromRemoteReader(url: string): Promise<ReaderResult> {
    if (this.cache.get(url)) {
      this.logger.log(`in-mem crawl cache hit: ${url}`);
      return this.cache.get(url) as ReaderResult;
    }

    this.logger.log(
      `Authorization: ${
        this.config.get('credentials.jina')
          ? `Bearer ${this.config.get('credentials.jina')}`
          : undefined
      }`,
    );

    const response = await fetch(READER_URL + url, {
      method: 'GET',
      headers: {
        Authorization: this.config.get('credentials.jina')
          ? `Bearer ${this.config.get('credentials.jina')}`
          : undefined,
        Accept: 'application/json',
      },
    });
    if (response.status !== 200) {
      throw new Error(
        `call remote reader failed: ${response.status} ${response.statusText} ${response.text}`,
      );
    }

    const data = await response.json();
    if (!data) {
      throw new Error(`invalid data from remote reader: ${response.text}`);
    }

    this.logger.log(`crawl from reader success: ${url}`);
    this.cache.set(url, data);

    return data;
  }

  async chunkText(text: string) {
    return await this.splitter.splitText(cleanMarkdownForIngest(text));
  }

  // metadata?.uniqueId for save or retrieve
  async inMemorySearchWithIndexing(
    user: User,
    options: {
      content: string | Document<any> | Array<Document<any>>;
      query?: string;
      k?: number;
      filter?: (doc: Document<DocumentPayload>) => boolean;
      needChunk?: boolean;
      additionalMetadata?: Record<string, any>;
    },
  ): Promise<DocumentInterface[]> {
    const { content, query, k = 10, filter, needChunk = true, additionalMetadata = {} } = options;
    const { uid } = user;

    if (!query) {
      return [];
    }

    // Create a temporary MemoryVectorStore for this operation
    const tempMemoryVectorStore = new MemoryVectorStore(this.embeddings);

    // Prepare the document
    let documents: Document<any>[];
    if (Array.isArray(content)) {
      documents = content.map((doc) => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          tenantId: uid,
          ...additionalMetadata,
        },
      }));
    } else {
      let doc: Document<any>;
      if (typeof content === 'string') {
        doc = {
          pageContent: content,
          metadata: {
            tenantId: uid,
            ...additionalMetadata,
          },
        };
      } else {
        doc = {
          ...content,
          metadata: {
            ...content.metadata,
            tenantId: uid,
            ...additionalMetadata,
          },
        };
      }

      // Index the content
      const chunks = needChunk ? await this.chunkText(doc.pageContent) : [doc.pageContent];
      let startIndex = 0;
      documents = chunks.map((chunk) => {
        const document = {
          pageContent: chunk.trim(),
          metadata: {
            ...doc.metadata,
            tenantId: uid,
            ...additionalMetadata,
            start: startIndex,
            end: startIndex + chunk.trim().length,
          },
        };

        startIndex += chunk.trim().length;

        return document;
      });
    }

    await tempMemoryVectorStore.addDocuments(documents);

    // Perform the search
    const wrapperFilter = (doc: Document<DocumentPayload>) => {
      // Always check for tenantId
      const tenantIdMatch = doc.metadata.tenantId === uid;

      // If filter is undefined, only check tenantId
      if (filter === undefined) {
        return tenantIdMatch;
      }

      // If filter is defined, apply both filter and tenantId check
      return filter(doc) && tenantIdMatch;
    };

    return tempMemoryVectorStore.similaritySearch(query, k, wrapperFilter);
  }

  async indexDocument(user: User, doc: Document<DocumentPayload>): Promise<{ size: number }> {
    const { uid } = user;
    const { pageContent, metadata } = doc;
    const { nodeType, docId, resourceId } = metadata;
    const entityId = nodeType === 'document' ? docId : resourceId;

    // Get new chunks
    const newChunks = await this.chunkText(pageContent);

    // Get existing points for this document using scroll
    const existingPoints = await this.qdrant.scroll({
      filter: {
        must: [
          { key: 'tenantId', match: { value: uid } },
          { key: nodeType === 'document' ? 'docId' : 'resourceId', match: { value: entityId } },
        ],
      },
      with_payload: true,
      with_vector: true,
    });

    // Create a map of existing chunks for quick lookup
    const existingChunksMap = new Map(
      existingPoints.map((point) => [
        point.payload.content,
        {
          id: point.id,
          vector: point.vector as number[],
        },
      ]),
    );

    // Prepare points for new or updated chunks
    const pointsToUpsert: PointStruct[] = [];
    const chunksNeedingEmbeddings: string[] = [];
    const chunkIndices: number[] = [];

    // Identify which chunks need new embeddings
    for (let i = 0; i < newChunks.length; i++) {
      const chunk = newChunks[i];
      const existing = existingChunksMap.get(chunk);

      if (existing) {
        // Reuse existing embedding for identical chunks
        pointsToUpsert.push({
          id: genResourceUuid(`${entityId}-${i}`),
          vector: existing.vector,
          payload: {
            ...metadata,
            seq: i,
            content: chunk,
            tenantId: uid,
          },
        });
      } else {
        // Mark for new embedding computation
        chunksNeedingEmbeddings.push(chunk);
        chunkIndices.push(i);
      }
    }

    // Compute embeddings only for new or modified chunks
    if (chunksNeedingEmbeddings.length > 0) {
      const newEmbeddings = await this.embeddings.embedDocuments(chunksNeedingEmbeddings);

      // Create points for chunks with new embeddings
      chunkIndices.forEach((originalIndex, embeddingIndex) => {
        pointsToUpsert.push({
          id: genResourceUuid(`${entityId}-${originalIndex}`),
          vector: newEmbeddings[embeddingIndex],
          payload: {
            ...metadata,
            seq: originalIndex,
            content: chunksNeedingEmbeddings[embeddingIndex],
            tenantId: uid,
          },
        });
      });
    }

    // Delete existing points for this document
    if (existingPoints.length > 0) {
      await this.qdrant.batchDelete({
        must: [
          { key: 'tenantId', match: { value: uid } },
          { key: nodeType === 'document' ? 'docId' : 'resourceId', match: { value: entityId } },
        ],
      });
    }

    // Save new points
    if (pointsToUpsert.length > 0) {
      await this.qdrant.batchSaveData(pointsToUpsert);
    }

    return { size: QdrantService.estimatePointsSize(pointsToUpsert) };
  }

  async deleteResourceNodes(user: User, resourceId: string) {
    return this.qdrant.batchDelete({
      must: [
        { key: 'tenantId', match: { value: user.uid } },
        { key: 'resourceId', match: { value: resourceId } },
      ],
    });
  }

  async deleteDocumentNodes(user: User, docId: string) {
    return this.qdrant.batchDelete({
      must: [
        { key: 'tenantId', match: { value: user.uid } },
        { key: 'docId', match: { value: docId } },
      ],
    });
  }

  async duplicateDocument(param: {
    sourceUid: string;
    targetUid: string;
    sourceDocId: string;
    targetDocId: string;
  }) {
    const { sourceUid, targetUid, sourceDocId, targetDocId } = param;

    try {
      this.logger.log(
        `Duplicating document ${sourceDocId} from user ${sourceUid} to user ${targetUid}`,
      );

      // Fetch all points for the source document
      const points = await this.qdrant.scroll({
        filter: {
          must: [
            { key: 'tenantId', match: { value: sourceUid } },
            { key: 'docId', match: { value: sourceDocId } },
          ],
        },
        with_payload: true,
        with_vector: true,
      });

      if (!points?.length) {
        this.logger.warn(`No points found for document ${sourceDocId}`);
        return { size: 0, pointsCount: 0 };
      }

      // Prepare points for the target user
      const pointsToUpsert: PointStruct[] = points.map((point) => ({
        ...point,
        id: genResourceUuid(`${sourceUid}-${targetDocId}-${point.payload.seq ?? 0}`),
        payload: {
          ...point.payload,
          tenantId: targetUid,
        },
      }));

      // Calculate the size of the points to be upserted
      const size = QdrantService.estimatePointsSize(pointsToUpsert);

      // Perform the upsert operation
      await this.qdrant.batchSaveData(pointsToUpsert);

      this.logger.log(
        `Successfully duplicated ${pointsToUpsert.length} points for document ${sourceDocId} to user ${targetUid}`,
      );

      return {
        size,
        pointsCount: pointsToUpsert.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to duplicate document ${sourceDocId} from user ${sourceUid} to ${targetUid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async retrieve(user: User, param: HybridSearchParam): Promise<ContentPayload[]> {
    if (!param.vector) {
      param.vector = await this.embeddings.embedQuery(param.query);
      // param.vector = Array(256).fill(0);
    }

    const conditions: Condition[] = [
      {
        key: 'tenantId',
        match: { value: user.uid },
      },
    ];

    if (param.filter?.nodeTypes?.length > 0) {
      conditions.push({
        key: 'nodeType',
        match: { any: param.filter?.nodeTypes },
      });
    }
    if (param.filter?.urls?.length > 0) {
      conditions.push({
        key: 'url',
        match: { any: param.filter?.urls },
      });
    }
    if (param.filter?.docIds?.length > 0) {
      conditions.push({
        key: 'docId',
        match: { any: param.filter?.docIds },
      });
    }
    if (param.filter?.resourceIds?.length > 0) {
      conditions.push({
        key: 'resourceId',
        match: { any: param.filter?.resourceIds },
      });
    }
    if (param.filter?.projectIds?.length > 0) {
      conditions.push({
        key: 'projectId',
        match: { any: param.filter?.projectIds },
      });
    }

    const results = await this.qdrant.search(param, { must: conditions });
    return results.map((res) => res.payload as any);
  }

  /**
   * Rerank search results using Jina Reranker.
   */
  async rerank(
    query: string,
    results: SearchResult[],
    options?: { topN?: number; relevanceThreshold?: number },
  ): Promise<SearchResult[]> {
    // Note: topN and relevanceThreshold are now primarily handled by the specific
    // RerankerInterface implementation based on its configuration source (env or YAML).
    // However, we still pass the options down, as the interface allows it,
    // potentially for overriding configured defaults if an implementation supports it.
    // JinaReranker uses them as fallbacks if options are provided.
    // XinferenceReranker (as planned) ignores these options and uses its own config.

    // Old contentMap logic is removed as it's handled within specific reranker implementations now.
    // <<< Extraneous closing brace removed here to fix syntax errors.

    // Ensure the reranker instance is available
    if (!this.reranker) {
        this.logger.error("Reranker instance is not initialized. Cannot perform reranking. Falling back.");
        // Fallback similar to catch block
        return results.map((result, index) => ({
            ...result,
            relevanceScore: 1 - index * 0.1,
        }));
    }

    try {
      // Delegate the reranking task to the initialized reranker instance
      this.logger.debug(`Delegating rerank call to ${this.reranker.constructor.name}`);
      return await this.reranker.rerank(query, results, options);

    } catch (e) {
      this.logger.error(`Reranker failed, fallback to default: ${e.stack}`);
      // When falling back, maintain the original order but add default relevance scores
      return results.map((result, index) => ({
        ...result,
        relevanceScore: 1 - index * 0.1, // Simple fallback scoring based on original order
      }));
    }
  }

  /**
   * Serializes all vector points for a document into Avro binary format.
   * @param user The user that owns the document
   * @param param Parameters object containing document/resource details
   * @param param.docId The document ID to export (use either docId or resourceId)
   * @param param.resourceId The resource ID to export (use either docId or resourceId)
   * @param param.nodeType The node type ('document' or 'resource')
   * @returns Binary data in Avro format and metadata about the export
   */
  async serializeToAvro(
    user: User,
    param: {
      docId?: string;
      resourceId?: string;
      nodeType?: 'document' | 'resource';
    },
  ): Promise<{ data: Buffer; pointsCount: number; size: number }> {
    const { docId, resourceId, nodeType = docId ? 'document' : 'resource' } = param;
    const entityId = nodeType === 'document' ? docId : resourceId;

    if (!entityId) {
      throw new Error('Either docId or resourceId must be provided');
    }

    try {
      this.logger.log(`Serializing ${nodeType} ${entityId} from user ${user.uid} to Avro binary`);

      // Fetch all points for the document
      const points = await this.qdrant.scroll({
        filter: {
          must: [
            { key: 'tenantId', match: { value: user.uid } },
            { key: nodeType === 'document' ? 'docId' : 'resourceId', match: { value: entityId } },
          ],
        },
        with_payload: true,
        with_vector: true,
      });

      if (!points?.length) {
        this.logger.warn(`No points found for ${nodeType} ${entityId}`);
        return { data: Buffer.from([]), pointsCount: 0, size: 0 };
      }

      // Prepare points for serialization
      const pointsForAvro = points.map((point) => ({
        id: point.id,
        vector: point.vector,
        payload: JSON.stringify(point.payload),
        metadata: {
          nodeType,
          entityId,
          originalUid: user.uid,
        },
      }));

      // Serialize points to Avro binary
      const avroBuffer = Buffer.from(avroSchema.toBuffer(pointsForAvro));
      const size = avroBuffer.length;

      this.logger.log(
        `Successfully serialized ${points.length} points for ${nodeType} ${entityId} to Avro binary (${size} bytes)`,
      );

      return {
        data: avroBuffer,
        pointsCount: points.length,
        size,
      };
    } catch (error) {
      this.logger.error(
        `Failed to serialize ${nodeType} ${entityId} from user ${user.uid} to Avro binary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Deserializes Avro binary data and saves the vector points to Qdrant with new IDs.
   * @param user The target user to save the points for
   * @param param Parameters object containing target details
   * @param param.data The Avro binary data to deserialize
   * @param param.targetDocId The target document ID (use either targetDocId or targetResourceId)
   * @param param.targetResourceId The target resource ID (use either targetDocId or targetResourceId)
   * @returns Metadata about the import operation
   */
  async deserializeFromAvro(
    user: User,
    param: {
      data: Buffer;
      targetDocId?: string;
      targetResourceId?: string;
    },
  ): Promise<{ size: number; pointsCount: number }> {
    const { data, targetDocId, targetResourceId } = param;
    const targetNodeType = targetDocId ? 'document' : 'resource';
    const targetEntityId = targetNodeType === 'document' ? targetDocId : targetResourceId;

    if (!targetEntityId) {
      throw new Error('Either targetDocId or targetResourceId must be provided');
    }

    if (!data || data.length === 0) {
      this.logger.warn('No Avro data provided for deserialization');
      return { size: 0, pointsCount: 0 };
    }

    try {
      this.logger.log(
        `Deserializing Avro binary to ${targetNodeType} ${targetEntityId} for user ${user.uid}`,
      );

      // Deserialize Avro binary to points
      const deserializedPoints = avroSchema.fromBuffer(data);

      if (!deserializedPoints?.length) {
        this.logger.warn('No points found in Avro data');
        return { size: 0, pointsCount: 0 };
      }

      // Prepare points for saving to Qdrant with new IDs and tenant
      const pointsToUpsert = deserializedPoints.map((point, index) => {
        const payload = JSON.parse(point.payload);

        // Generate a new ID for the point
        const id = genResourceUuid(`${targetEntityId}-${index}`);

        // Update payload with new tenant ID and entity ID
        const updatedPayload = {
          ...payload,
          tenantId: user.uid,
        };

        // If the point refers to a document or resource, update its ID
        if (targetNodeType === 'document' && payload.docId) {
          updatedPayload.docId = targetDocId;
        } else if (targetNodeType === 'resource' && payload.resourceId) {
          updatedPayload.resourceId = targetResourceId;
        }

        return {
          id,
          vector: point.vector,
          payload: updatedPayload,
        };
      });

      // Calculate the size of points
      const size = QdrantService.estimatePointsSize(pointsToUpsert);

      // Save points to Qdrant
      await this.qdrant.batchSaveData(pointsToUpsert);

      this.logger.log(
        `Successfully deserialized ${pointsToUpsert.length} points from Avro binary to ${targetNodeType} ${targetEntityId} for user ${user.uid}`,
      );

      return {
        size,
        pointsCount: pointsToUpsert.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to deserialize Avro binary to ${targetNodeType} ${targetEntityId} for user ${user.uid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Updates arbitrary metadata for all points of a given document or resource.
   * @param user The user that owns the document/resource
   * @param params Parameters for the update operation
   * @param params.docId The document ID to update (use either docId or resourceId)
   * @param params.resourceId The resource ID to update (use either docId or resourceId)
   * @param params.metadata The metadata fields to update
   * @returns Metadata about the update operation
   */
  async updateDocumentPayload(
    user: User,
    params: {
      docId?: string | string[];
      resourceId?: string | string[];
      metadata: Record<string, any>;
    },
  ) {
    const { docId, resourceId, metadata } = params;

    // Determine if we're dealing with documents, resources, or both
    const hasDocIds = docId && (typeof docId === 'string' ? [docId].length > 0 : docId.length > 0);
    const hasResourceIds =
      resourceId &&
      (typeof resourceId === 'string' ? [resourceId].length > 0 : resourceId.length > 0);

    // Convert single values to arrays
    const docIds = typeof docId === 'string' ? [docId] : (docId ?? []);
    const resourceIds = typeof resourceId === 'string' ? [resourceId] : (resourceId ?? []);

    if (!hasDocIds && !hasResourceIds) {
      throw new Error('Either docId or resourceId must be provided');
    }

    if (!metadata || Object.keys(metadata).length === 0) {
      throw new Error('No metadata fields provided for update');
    }

    this.logger.log(
      `Updating metadata ${JSON.stringify(metadata)} for ${JSON.stringify(
        hasDocIds ? docIds : resourceIds,
      )} from user ${user.uid}`,
    );

    // Prepare filter conditions
    const conditions: Condition[] = [{ key: 'tenantId', match: { value: user.uid } }];

    // Add conditions for documents and resources
    if (hasDocIds) {
      conditions.push({ key: 'docId', match: { any: docIds } });
    }

    if (hasResourceIds) {
      conditions.push({ key: 'resourceId', match: { any: resourceIds } });
    }

    return await this.qdrant.updatePayload(
      {
        must: conditions,
      },
      metadata,
    );
  }
}
