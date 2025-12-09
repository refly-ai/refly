import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SearchDomain, SearchRequest, SearchResult, User } from '@refly/openapi-schema';
import { Client, ClientOptions } from '@elastic/elasticsearch';
import { FulltextDocument, FulltextSearchBackend } from './interface';
import { runModuleInitWithTimeoutAndRetry } from '@refly/utils';

export interface ResourceDocument extends FulltextDocument {
  title?: string;
  content?: string;
  url?: string;
  uid: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentDocument extends FulltextDocument {
  title?: string;
  content?: string;
  uid: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasDocument extends FulltextDocument {
  title?: string;
  uid: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const commonSettings = {
  analysis: {
    analyzer: {
      default: {
        type: 'standard',
        stopwords: '_english_',
      },
    },
  },
};

export const indexConfig = {
  resource: {
    index: 'refly_resources',
    settings: commonSettings,
    properties: {
      title: { type: 'text' },
      content: { type: 'text' },
      url: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      uid: { type: 'keyword' },
      projectId: { type: 'keyword' },
    },
  },
  document: {
    index: 'refly_documents',
    settings: commonSettings,
    properties: {
      title: { type: 'text' },
      content: { type: 'text' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      uid: { type: 'keyword' },
      projectId: { type: 'keyword' },
    },
  },
  canvas: {
    index: 'refly_canvases',
    settings: commonSettings,
    properties: {
      title: { type: 'text' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      uid: { type: 'keyword' },
      projectId: { type: 'keyword' },
    },
  },
};

type IndexConfigValue = (typeof indexConfig)[keyof typeof indexConfig];

export interface ElasticsearchConfig {
  url: string;
  username?: string;
  password?: string;
}

interface SearchHit<T> {
  _index: string;
  _id: string;
  _score: number;
  _source: T;
  highlight?: {
    [key: string]: string[];
  };
}

interface SearchResponse<T> {
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number;
    hits: SearchHit<T>[];
  };
}

@Injectable()
export class ElasticsearchFulltextSearchBackend implements FulltextSearchBackend, OnModuleInit {
  private readonly logger = new Logger(ElasticsearchFulltextSearchBackend.name);
  private client: Client;
  private initialized = false;
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  constructor(private readonly config: ElasticsearchConfig) {}

  /**
   * Initialize the Elasticsearch backend
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.log('Initializing Elasticsearch fulltext search backend');

    const elasticUrl = this.config.url;
    const elasticUsername = this.config.username;
    const elasticPassword = this.config.password;

    if (!elasticUrl) {
      throw new Error('Elasticsearch URL is not defined');
    }

    try {
      // Create Elasticsearch client
      const clientOptions: ClientOptions = {
        node: elasticUrl,
      };

      if (elasticUsername && elasticPassword) {
        clientOptions.auth = {
          username: elasticUsername,
          password: elasticPassword,
        };
      }

      this.client = new Client(clientOptions);

      // Test connection
      await this.client.ping();
      this.logger.log('Connected to Elasticsearch');

      // Ensure indices exist
      await this.ensureIndicesExist();

      this.initialized = true;
    } catch (error) {
      this.logger.error(`Failed to initialize Elasticsearch: ${error}`);
      throw error;
    }
  }

  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      async () => {
        await this.initialize();
        this.logger.log('Elasticsearch initialized successfully');
      },
      {
        logger: this.logger,
        label: 'ElasticsearchFulltextSearchBackend.onModuleInit',
        timeoutMs: this.INIT_TIMEOUT,
      },
    );
  }

  /**
   * Search a document from the Elasticsearch index
   * @param user The user who is searching the document
   * @param index The index name
   * @param req The search request
   * @returns The search results
   */
  async searchDocument(
    user: User,
    index: SearchDomain,
    req: SearchRequest,
  ): Promise<SearchResult[]> {
    this.logger.debug(`Searching documents in index ${index} with query: ${req?.query}`);

    switch (index) {
      case 'resource':
        return this.searchResources(user, req);
      case 'document':
        return this.searchDocuments(user, req);
      case 'canvas':
        return this.searchCanvases(user, req);
      default:
        throw new Error(`Unsupported search index: ${index}`);
    }
  }

  /**
   * Upsert a document into the Elasticsearch index
   * @param user The user who is upserting the document
   * @param index The index name
   * @param document The document to upsert
   * @returns true if the document was upserted
   */
  async upsertDocument(_user: User, index: string, document: FulltextDocument): Promise<boolean> {
    this.logger.debug(`Upserting document in index ${index} with id: ${document?.id}`);

    if (!document?.id) {
      return false;
    }

    try {
      await this.client.update({
        index,
        id: document.id,
        body: {
          doc: document,
          doc_as_upsert: true,
        },
        refresh: 'wait_for', // Ensure the document is searchable immediately
        retry_on_conflict: 3,
      });

      return true;
    } catch (error) {
      this.logger.error(`Error upserting document: ${error?.message}`, error);
      return false;
    }
  }

  /**
   * Delete a document from the Elasticsearch index
   * @param user The user who is deleting the document
   * @param index The index name
   * @param id The document id
   * @returns true if the document was deleted
   */
  async deleteDocument(_user: User, index: string, id: string): Promise<boolean> {
    this.logger.debug(`Deleting document from index ${index} with id: ${id}`);

    if (!id) {
      return false;
    }

    try {
      const response = await this.client.delete(
        {
          index,
          id,
          refresh: 'wait_for', // Ensure the deletion is visible immediately
        },
        { ignore: [404] },
      );

      return response.body?.result === 'deleted';
    } catch (error) {
      // Handle case where document doesn't exist
      if (error?.meta?.statusCode === 404) {
        return false;
      }

      this.logger.error(`Error deleting document: ${error?.message}`, error);
      return false;
    }
  }

  /**
   * Duplicate a document from one id to another in Elasticsearch
   * @param user The user who is duplicating the document
   * @param index The index name
   * @param sourceId The source document id
   * @param targetId The target document id
   * @returns the target document or null if source doesn't exist
   */
  async duplicateDocument(
    user: User,
    index: string,
    sourceId: string,
    targetId: string,
  ): Promise<FulltextDocument | null> {
    this.logger.debug(
      `Duplicating document from index ${index}, sourceId: ${sourceId} to targetId: ${targetId}`,
    );

    if (!sourceId || !targetId) {
      return null;
    }

    try {
      // Get the source document
      const { body } = await this.client.get(
        {
          index,
          id: sourceId,
        },
        { ignore: [404] },
      );

      if (!body?._source) {
        return null;
      }

      // Prepare new document
      const sourceDoc = body._source;
      const newDoc: FulltextDocument = {
        ...sourceDoc,
        id: targetId,
        createdBy: user?.uid ?? sourceDoc.createdBy,
        updatedBy: user?.uid ?? sourceDoc.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Index the new document
      await this.upsertDocument(user, index, newDoc);

      return newDoc;
    } catch (error) {
      // Handle case where source document doesn't exist
      if (error?.meta?.statusCode === 404) {
        return null;
      }

      this.logger.error(`Error duplicating document: ${error?.message}`, error);
      return null;
    }
  }

  async searchResources(user: User, req: SearchRequest): Promise<SearchResult[]> {
    const { query, limit, entities, projectId } = req;
    const { body } = await this.client.search<SearchResponse<ResourceDocument>>({
      index: indexConfig.resource.index,
      body: {
        query: {
          bool: {
            must: [
              { match: { uid: user.uid } },
              {
                multi_match: {
                  query,
                  fields: ['title^2', 'content'],
                  type: 'most_fields',
                },
              },
            ],
            ...(entities?.length > 0 && {
              filter: [{ terms: { _id: entities.map((entity) => entity.entityId) } }],
            }),
            ...(projectId && {
              filter: [{ term: { projectId } }],
            }),
          },
        },
        size: limit,
        highlight: {
          fields: {
            title: {},
            content: {},
          },
        },
      },
    });

    return body.hits.hits.map((hit) => ({
      id: hit._id,
      domain: 'resource',
      title: hit._source.title,
      highlightedTitle: hit.highlight?.title?.[0] || hit._source.title,
      contentPreview: `${hit._source.content?.slice(0, 500)}...`,
      snippets: [
        {
          text: hit._source.content,
          highlightedText: hit.highlight?.content?.[0] || hit._source.content,
        },
      ],
      metadata: {
        // TODO: confirm if metadata is used
        url: hit._source.url,
      },
      createdAt: hit._source.createdAt,
      updatedAt: hit._source.updatedAt,
    }));
  }

  async searchDocuments(user: User, req: SearchRequest): Promise<SearchResult[]> {
    const { query, limit, entities, projectId } = req;
    const { body } = await this.client.search<SearchResponse<DocumentDocument>>({
      index: indexConfig.document.index,
      body: {
        query: {
          bool: {
            must: [
              { match: { uid: user.uid } },
              {
                multi_match: {
                  query,
                  fields: ['title^2', 'content'],
                  type: 'most_fields',
                },
              },
            ],
            ...(entities?.length > 0 && {
              filter: [{ terms: { _id: entities.map((entity) => entity.entityId) } }],
            }),
            ...(projectId && {
              filter: [{ term: { projectId } }],
            }),
          },
        },
        size: limit,
        highlight: {
          fields: {
            title: {},
            content: {},
          },
        },
      },
    });

    return body.hits.hits.map((hit) => ({
      id: hit._id,
      domain: 'document',
      title: hit._source.title,
      highlightedTitle: hit.highlight?.title?.[0] || hit._source.title,
      contentPreview: `${hit._source.content?.slice(0, 500)}...`,
      snippets: [
        {
          text: hit._source.content,
          highlightedText: hit.highlight?.content?.[0] || hit._source.content,
        },
      ],
      createdAt: hit._source.createdAt,
      updatedAt: hit._source.updatedAt,
    }));
  }

  async searchCanvases(user: User, req: SearchRequest): Promise<SearchResult[]> {
    const { query, limit, entities, projectId } = req;
    const { body } = await this.client.search<SearchResponse<CanvasDocument>>({
      index: indexConfig.canvas.index,
      body: {
        query: {
          bool: {
            must: [
              { match: { uid: user.uid } },
              {
                multi_match: {
                  query,
                  fields: ['title'],
                  type: 'most_fields',
                },
              },
            ],
            ...(entities?.length > 0 && {
              filter: [{ terms: { _id: entities.map((entity) => entity.entityId) } }],
            }),
            ...(projectId && {
              filter: [{ term: { projectId } }],
            }),
          },
        },
        size: limit,
        highlight: {
          fields: {
            title: {},
          },
        },
      },
    });

    return body.hits.hits.map((hit) => ({
      id: hit._id,
      domain: 'canvas',
      title: hit._source.title ?? '',
      highlightedTitle: hit.highlight?.title?.[0] ?? hit._source.title ?? '',
      contentPreview: '',
      snippets: [],
      createdAt: hit._source.createdAt,
      updatedAt: hit._source.updatedAt,
    }));
  }

  /**
   * Ensure required indices exist in Elasticsearch
   */
  private async ensureIndicesExist(): Promise<void> {
    for (const config of Object.values(indexConfig)) {
      await this.ensureIndexExists(config);
    }
  }

  /**
   * Check if an index exists and create it if it doesn't
   */
  private async ensureIndexExists(indexConfig: IndexConfigValue): Promise<void> {
    try {
      const { body: indexExists } = await this.client.indices.exists({ index: indexConfig.index });
      this.logger.log(`Index exists for ${indexConfig.index}: ${indexExists}`);

      if (!indexExists) {
        const { body } = await this.client.indices.create({
          index: indexConfig.index,
          body: {
            settings: indexConfig.settings,
            mappings: {
              properties: indexConfig.properties,
            },
          },
        });
        this.logger.log(`Index created successfully: ${JSON.stringify(body)}`);
      } else {
        this.logger.log(`Index already exists: ${indexConfig.index}`);
      }
    } catch (error) {
      // If index already exists, that's fine
      if (error?.meta?.body?.error?.type === 'resource_already_exists_exception') {
        this.logger.log(`Index ${indexConfig.index} already exists`);
        return;
      }

      this.logger.error(`Error checking if index exists: ${error?.message}`, error);
      throw error;
    }
  }
}
