import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MilvusClient, DataType, MetricType } from '@zilliz/milvus2-sdk-node';
import {
  VectorSearchBackend,
  VectorPoint,
  VectorSearchRequest,
  VectorSearchResult,
  VectorFilter,
  VectorScrollRequest,
} from './interface';
import { toMilvusFilter } from './filter-utils';

@Injectable()
export class MilvusVectorSearchBackend implements VectorSearchBackend {
  private readonly logger = new Logger(MilvusVectorSearchBackend.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  private collectionName: string;
  private collectionExists: boolean;
  private client: MilvusClient;
  private vectorDimension: number;

  constructor(private configService: ConfigService) {
    this.client = new MilvusClient({
      address: this.configService.getOrThrow('vectorStore.milvus.address'),
      username: this.configService.get('vectorStore.milvus.username'),
      password: this.configService.get('vectorStore.milvus.password'),
      database: this.configService.get('vectorStore.milvus.database', 'default'),
    });
    this.collectionName = this.configService.get<string>(
      'vectorStore.milvus.collectionName',
      'refly_vectors',
    );
    this.vectorDimension = this.configService.get<number>(
      'vectorStore.milvus.vectorDimension',
      1536,
    );
    this.collectionExists = false;
  }

  estimatePointsSize(points: VectorPoint[]): number {
    return points.reduce((acc, point) => {
      // Estimate vector size (4 bytes per float)
      const vectorSize = point.vector.length * 4;

      // Estimate payload size
      const payloadSize = new TextEncoder().encode(JSON.stringify(point.payload)).length;

      // Estimate ID size (UTF-8 encoding)
      const idSize = new TextEncoder().encode(String(point.id)).length;

      return acc + vectorSize + payloadSize + idSize;
    }, 0);
  }

  async initialize(): Promise<void> {
    const initPromise = this.initializeConnection();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Milvus initialization timed out after ${this.INIT_TIMEOUT}ms`));
      }, this.INIT_TIMEOUT);
    });

    try {
      await Promise.race([initPromise, timeoutPromise]);
      this.logger.log('Milvus vector search backend initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Milvus vector search backend: ${error}`);
      this.collectionExists = false; // Reset state on error
      throw error;
    }
  }

  private async initializeConnection(): Promise<void> {
    this.logger.log('Initializing Milvus vector search backend...');

    // Check if collection exists
    const hasCollection = await this.client.hasCollection({
      collection_name: this.collectionName,
    });

    if (!hasCollection.value) {
      await this.createCollection();
    }

    this.collectionExists = true;

    // Load collection into memory if not already loaded
    await this.loadCollection();
  }

  private async createCollection(): Promise<void> {
    this.logger.log(`Creating collection: ${this.collectionName}`);

    const schema = [
      {
        name: 'id',
        data_type: DataType.VarChar,
        is_primary_key: true,
        max_length: 256,
      },
      {
        name: 'vector',
        data_type: DataType.FloatVector,
        dim: this.vectorDimension,
      },
      {
        name: 'payload',
        data_type: DataType.JSON,
      },
    ];

    await this.client.createCollection({
      collection_name: this.collectionName,
      fields: schema,
    });

    // Create index for vector field
    await this.client.createIndex({
      collection_name: this.collectionName,
      field_name: 'vector',
      index_type: 'HNSW',
      metric_type: MetricType.COSINE,
      params: { M: 8, efConstruction: 64 },
    });

    this.logger.log(`Collection ${this.collectionName} created successfully`);
  }

  private async loadCollection(): Promise<void> {
    const loadState = await this.client.getLoadState({
      collection_name: this.collectionName,
    });

    if (loadState.state !== 'LoadStateLoaded') {
      await this.client.loadCollection({
        collection_name: this.collectionName,
      });
      this.logger.log(`Collection ${this.collectionName} loaded into memory`);
    }
  }

  async isCollectionEmpty(): Promise<boolean> {
    try {
      if (!this.collectionExists) {
        return true;
      }

      const stats = await this.client.getCollectionStatistics({
        collection_name: this.collectionName,
      });

      const rowCount = stats.stats.find((stat) => stat.key === 'row_count');
      return !rowCount || Number.parseInt(String(rowCount.value)) === 0;
    } catch (error) {
      this.logger.warn('Error checking if collection is empty:', error);
      return true;
    }
  }

  async batchSaveData(points: VectorPoint[]): Promise<any> {
    if (points.length === 0) {
      return { success: true, insert_count: 0 };
    }

    try {
      const data = points.map((point) => ({
        id: point.id,
        vector: point.vector,
        payload: point.payload,
      }));

      const result = await this.client.insert({
        collection_name: this.collectionName,
        data,
      });

      this.logger.debug(`Successfully inserted ${result.insert_cnt} points into Milvus`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to insert ${points.length} points into Milvus:`, error);
      throw error;
    }
  }

  async batchDelete(filter: VectorFilter): Promise<any> {
    if (!this.collectionExists) {
      return;
    }

    try {
      const milvusFilter = toMilvusFilter(filter);
      const result = await this.client.deleteEntities({
        collection_name: this.collectionName,
        filter: milvusFilter,
      });

      this.logger.debug(`Successfully deleted entities with filter: ${milvusFilter}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to delete entities with filter:', error);
      throw error;
    }
  }

  async search(request: VectorSearchRequest, filter: VectorFilter): Promise<VectorSearchResult[]> {
    if (!this.collectionExists) {
      return [];
    }

    if (!request.vector) {
      throw new Error('Vector is required for Milvus search');
    }

    try {
      const milvusFilter = toMilvusFilter(filter);
      const results = await this.client.search({
        collection_name: this.collectionName,
        data: [request.vector],
        limit: request.limit || 10,
        output_fields: ['id', 'payload'],
        filter: milvusFilter,
      });

      this.logger.debug(`Search completed, found ${results.results.length} results`);
      return results.results.map((result) => ({
        id: String(result.id),
        score: Number(result.score || result.distance),
        payload: result.entity || result.payload || {},
      }));
    } catch (error) {
      this.logger.error('Failed to perform vector search:', error);
      throw error;
    }
  }

  async scroll(request: VectorScrollRequest): Promise<VectorPoint[]> {
    if (!this.collectionExists) {
      return [];
    }

    try {
      const milvusFilter = request.filter ? toMilvusFilter(request.filter) : '';
      const results = await this.client.query({
        collection_name: this.collectionName,
        output_fields: ['id', 'vector', 'payload'],
        filter: milvusFilter,
        limit: request.limit || 100,
        offset: Number.parseInt(request.offset || '0'),
      });

      return results.data.map((item) => ({
        id: String(item.id),
        vector: item.vector || [],
        payload: item.payload || item.entity || {},
      }));
    } catch (error) {
      this.logger.error('Error scrolling in Milvus:', error);
      throw error;
    }
  }

  async updatePayload(filter: VectorFilter, payload: Record<string, any>): Promise<any> {
    if (!this.collectionExists) {
      return;
    }

    try {
      // Milvus doesn't support direct payload updates
      // We need to query, delete, and re-insert
      const entities = await this.scroll({
        filter,
        limit: 10000, // Reasonable batch size
        with_payload: true,
        with_vector: true,
      });

      if (entities.length === 0) {
        return { success: true, updated_count: 0 };
      }

      // Delete existing entities
      await this.batchDelete(filter);

      // Re-insert with updated payload
      const updatedEntities = entities.map((entity) => ({
        ...entity,
        payload: { ...entity.payload, ...payload },
      }));

      await this.batchSaveData(updatedEntities);

      this.logger.debug(`Updated ${entities.length} entities in Milvus`);
      return { success: true, updated_count: entities.length };
    } catch (error) {
      this.logger.error('Error updating payload in Milvus:', error);
      throw error;
    }
  }
}
