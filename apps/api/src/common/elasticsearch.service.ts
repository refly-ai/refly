import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { SearchRequest, User } from '@refly-packages/openapi-schema';

interface ResourceDocument {
  id: string;
  title?: string;
  content?: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  uid: string;
  projectId?: string;
}

interface DocumentDocument {
  id: string;
  title?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
  uid: string;
  projectId?: string;
}

interface CanvasDocument {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  uid: string;
  projectId?: string;
}

const commonSettings = {
  analysis: {
    analyzer: {
      default: {
        type: 'icu_analyzer',
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
    },
  },
};

type IndexConfigValue = (typeof indexConfig)[keyof typeof indexConfig];

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
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  private client: Client;

  constructor(private configService: ConfigService) {
    this.client = new Client({
      node: this.configService.getOrThrow('elasticsearch.url'),
      auth: {
        username: this.configService.get('elasticsearch.username'),
        password: this.configService.get('elasticsearch.password'),
      },
    });
  }

  async onModuleInit() {
    const initPromise = this.initializeIndices();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(`Elasticsearch initialization timed out after ${this.INIT_TIMEOUT}ms`);
      }, this.INIT_TIMEOUT);
    });

    try {
      await Promise.race([initPromise, timeoutPromise]);
      this.logger.log('Elasticsearch indices initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Elasticsearch indices: ${error}`);
      throw error;
    }
  }

  private async initializeIndices() {
    for (const config of Object.values(indexConfig)) {
      await this.ensureIndexExists(config);
    }
  }

  private async ensureIndexExists(indexConfig: IndexConfigValue) {
    const { body: indexExists } = await this.client.indices.exists({ index: indexConfig.index });
    this.logger.log(`Index exists for ${indexConfig.index}: ${indexExists}`);

    if (!indexExists) {
      try {
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
      } catch (error) {
        this.logger.error(`Error creating index ${indexConfig.index}: ${error}`);
      }
    } else {
      this.logger.log(`Index already exists: ${indexConfig.index}`);
    }
  }

  private async upsertESDoc<T extends { id: string }>(index: string, document: T) {
    try {
      const result = await this.client.update({
        index,
        id: document.id,
        body: {
          doc: document,
          doc_as_upsert: true,
        },
        retry_on_conflict: 3,
      });
      this.logger.log(`Document upserted successfully, index: ${index}, id: ${document.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error upserting document ${document.id} to index ${index}: ${error}`);
      throw error;
    }
  }

  async upsertResource(resource: ResourceDocument) {
    return this.upsertESDoc(indexConfig.resource.index, resource);
  }

  async upsertDocument(document: DocumentDocument) {
    return this.upsertESDoc(indexConfig.document.index, document);
  }

  async upsertCanvas(canvas: CanvasDocument) {
    return this.upsertESDoc(indexConfig.canvas.index, canvas);
  }

  async deleteResource(resourceId: string) {
    return this.client.delete(
      {
        index: indexConfig.resource.index,
        id: resourceId,
      },
      { ignore: [404] },
    );
  }

  async deleteDocument(docId: string) {
    return this.client.delete(
      {
        index: indexConfig.document.index,
        id: docId,
      },
      { ignore: [404] },
    );
  }

  async deleteCanvas(canvasId: string) {
    return this.client.delete(
      {
        index: indexConfig.canvas.index,
        id: canvasId,
      },
      { ignore: [404] },
    );
  }

  async duplicateResource(resourceId: string, newId: string, user: User): Promise<void> {
    try {
      const { body } = await this.client.get<{ _source: ResourceDocument }>(
        {
          index: indexConfig.resource.index,
          id: resourceId,
        },
        { ignore: [404] },
      );

      if (!body?._source) {
        this.logger.warn(`Resource ${resourceId} not found`);
        return;
      }

      const sourceDoc = body._source;
      const duplicatedDoc: ResourceDocument = {
        ...sourceDoc,
        id: newId,
        uid: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.upsertResource(duplicatedDoc);
    } catch (error) {
      this.logger.error(`Error duplicating resource ${resourceId}: ${error}`);
      throw error;
    }
  }

  async duplicateDocument(documentId: string, newId: string, user: User): Promise<void> {
    try {
      const { body } = await this.client.get<{ _source: DocumentDocument }>(
        {
          index: indexConfig.document.index,
          id: documentId,
        },
        { ignore: [404] },
      );

      if (!body?._source) {
        this.logger.warn(`Document ${documentId} not found`);
        return;
      }

      const sourceDoc = body._source;
      const duplicatedDoc: DocumentDocument = {
        ...sourceDoc,
        id: newId,
        uid: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.upsertDocument(duplicatedDoc);
    } catch (error) {
      this.logger.error(`Error duplicating document ${documentId}: ${error}`);
      throw error;
    }
  }

  async searchResources(user: User, req: SearchRequest) {
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

    return body.hits.hits;
  }

  async searchDocuments(user: User, req: SearchRequest) {
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

    return body.hits.hits;
  }

  async searchCanvases(user: User, req: SearchRequest) {
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

    return body.hits.hits;
  }
}
