import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MilvusClient, DataType, InsertReq, SearchReq, DeleteReq, LoadCollectionReq, GetCollectionStatisticsReq } from '@zilliz/milvus2-sdk-node';
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
      ssl: this.configService.get('vectorStore.milvus.ssl', false),
    });
    this.collectionName = this.configService.get<string>(
      'vectorStore.milvus.collectionName',
      'refly_vectors',
    );
    this.collectionExists = false;
    this.vectorDimension = this.configService.get<number>(
      'vectorStore.milvus.vectorDimension',
      1536,
    );
  }

  estimatePointsSize(points: VectorPoint[]): number {
    return points.reduce((acc, point) => {
      // Estimate vector size (4 bytes per float)
      const vectorSize = point.vector.length * 4;

      // Estimate payload size
      const payloadSize = new TextEncoder().encode(JSON.stringify(point.payload)).length;

      // Estimate ID size (UTF-8 encoding)
      const idSize = new TextEncoder().encode(String(point.id)).length;

      // Add 8 bytes for the point ID (assuming it's a 64-bit integer)
      return acc + vectorSize + payloadSize + idSize;
    }, 0);
  }

  async initialize(): Promise<void> {
    const initPromise = this.checkCollectionExists();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Milvus initialization timed out after ${this.INIT_TIMEOUT}ms`));
      }, this.INIT_TIMEOUT);
    });

    try {
      await Promise.race([initPromise, timeoutPromise]);
      this.logger.log('Milvus collection initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Milvus collection: ${error}`);
      throw error;
    }
  }

  private async checkCollectionExists(): Promise<void> {
    try {
      const { data } = await this.client.hasCollection({
        collection_name: this.collectionName,
      });
      this.collectionExists = data.value;
    } catch (error) {
      this.logger.warn(`Error checking collection existence: ${error}`);
      this.collectionExists = false;
    }
  }

  private async ensureCollectionExists(): Promise<void> {
    if (this.collectionExists) {
      this.logger.debug(`Collection already exists: ${this.collectionName}`);
      return;
    }

    try {
      // Create collection with proper schema
      await this.client.createCollection({
        collection_name: this.collectionName,
        fields: [
          {
            name: 'id',
            description: 'Vector point ID',
            data_type: DataType.VarChar,
            max_length: 65535,
            is_primary: true,
          },
          {
            name: 'vector',
            description: 'Vector embedding',
            data_type: DataType.FloatVector,
            dim: this.vectorDimension,
          },
          {
            name: 'tenantId',
            description: 'Tenant ID for multi-tenancy',
            data_type: DataType.VarChar,
            max_length: 100,
          },
          {
            name: 'projectId',
            description: 'Project ID',
            data_type: DataType.VarChar,
            max_length: 100,
          },
          {
            name: 'type',
            description: 'Vector type',
            data_type: DataType.VarChar,
            max_length: 50,
          },
          {
            name: 'metadata',
            description: 'Additional metadata as JSON string',
            data_type: DataType.VarChar,
            max_length: 65535,
          },
        ],
        enable_dynamic_field: true,
      });

      // Create index for vector field
      await this.client.createIndex({
        collection_name: this.collectionName,
        field_name: 'vector',
        index_type: 'IVF_FLAT',
        metric_type: 'COSINE',
        params: { nlist: 1024 },
      });

      // Load collection
      await this.client.loadCollection({
        collection_name: this.collectionName,
      } as LoadCollectionReq);

      this.collectionExists = true;
      this.logger.log(`Collection created successfully: ${this.collectionName}`);
    } catch (error) {
      this.logger.error(`Failed to create collection: ${error}`);
      throw error;
    }
  }

  async isCollectionEmpty(): Promise<boolean> {
    if (!this.collectionExists) {
      await this.ensureCollectionExists();
    }

    try {
      const { data } = await this.client.getCollectionStatistics({
        collection_name: this.collectionName,
      } as GetCollectionStatisticsReq);
      
      return data.row_count === 0;
    } catch (error) {
      this.logger.warn('Error checking if collection is empty:', error);
      return true;
    }
  }

  async batchSaveData(points: VectorPoint[]): Promise<any> {
    if (points.length === 0) {
      return;
    }

    if (!this.collectionExists) {
      await this.ensureCollectionExists();
    }

    try {
      // Prepare data for Milvus insert
      const insertData: any[] = [];
      points.forEach((point) => {
        const row: any = {
          id: point.id,
          vector: point.vector,
        };

        // Extract common fields from payload
        if (point.payload.tenantId) {
          row.tenantId = point.payload.tenantId;
        }
        if (point.payload.projectId) {
          row.projectId = point.payload.projectId;
        }
        if (point.payload.type) {
          row.type = point.payload.type;
        }

        // Store remaining payload as metadata
        const metadata = { ...point.payload };
        delete metadata.tenantId;
        delete metadata.projectId;
        delete metadata.type;
        
        if (Object.keys(metadata).length > 0) {
          row.metadata = JSON.stringify(metadata);
        }

        insertData.push(row);
      });

      const insertReq: InsertReq = {
        collection_name: this.collectionName,
        fields_data: insertData,
      };

      const result = await this.client.insert(insertReq);
      this.logger.log(`Inserted ${points.length} vectors successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to insert vectors: ${error}`);
      throw error;
    }
  }

  async batchDelete(filter: VectorFilter): Promise<any> {
    if (!this.collectionExists) {
      return;
    }

    try {
      const milvusFilter = toMilvusFilter(filter);
      
      const deleteReq: DeleteReq = {
        collection_name: this.collectionName,
        expr: milvusFilter,
      };

      const result = await this.client.delete(deleteReq);
      this.logger.log('Vectors deleted successfully');
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete vectors: ${error}`);
      throw error;
    }
  }

  async search(request: VectorSearchRequest, filter: VectorFilter): Promise<VectorSearchResult[]> {
    if (!this.collectionExists) {
      await this.ensureCollectionExists();
    }

    try {
      const milvusFilter = toMilvusFilter(filter);
      const limit = request.limit ?? 10;

      const searchReq: SearchReq = {
        collection_name: this.collectionName,
        vector: request.vector,
        limit: limit,
        expr: milvusFilter,
        output_fields: ['id', 'metadata'],
        metric_type: 'COSINE',
        params: { nprobe: 10 },
      };

      const { data } = await this.client.search(searchReq);
      
      return data.results.map((result: any) => ({
        id: result.id,
        score: result.score,
        payload: result.metadata ? JSON.parse(result.metadata) : {},
      }));
    } catch (error) {
      this.logger.error(`Failed to search vectors: ${error}`);
      throw error;
    }
  }

  async scroll(request: VectorScrollRequest): Promise<VectorPoint[]> {
    if (!this.collectionExists) {
      await this.ensureCollectionExists();
    }

    try {
      const milvusFilter = request.filter ? toMilvusFilter(request.filter) : '';
      const limit = request.limit ?? 100;

      const { data } = await this.client.query({
        collection_name: this.collectionName,
        expr: milvusFilter,
        output_fields: ['id', 'vector', 'metadata'],
        limit: limit,
        offset: request.offset ? parseInt(request.offset) : 0,
      });

      return data.results.map((result: any) => ({
        id: result.id,
        vector: result.vector,
        payload: result.metadata ? JSON.parse(result.metadata) : {},
      }));
    } catch (error) {
      this.logger.error(`Failed to scroll vectors: ${error}`);
      throw error;
    }
  }

  async updatePayload(filter: VectorFilter, payload: Record<string, any>): Promise<any> {
    if (!this.collectionExists) {
      return;
    }

    try {
      const milvusFilter = toMilvusFilter(filter);
      
      // For Milvus, we need to delete and re-insert to update payload
      // This is a limitation of Milvus - it doesn't support direct payload updates
      const { data } = await this.client.query({
        collection_name: this.collectionName,
        expr: milvusFilter,
        output_fields: ['id', 'vector'],
      });

      if (data.results.length === 0) {
        return { updated: 0 };
      }

      // Delete existing records
      await this.client.delete({
        collection_name: this.collectionName,
        expr: milvusFilter,
      });

      // Re-insert with updated payload
      const updatedPoints: VectorPoint[] = data.results.map((result: any) => ({
        id: result.id,
        vector: result.vector,
        payload: { ...payload },
      }));

      await this.batchSaveData(updatedPoints);

      this.logger.log(`Updated payload for ${data.results.length} vectors`);
      return { updated: data.results.length };
    } catch (error) {
      this.logger.error(`Failed to update payload: ${error}`);
      throw error;
    }
  }
} 