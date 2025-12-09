import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  VectorSearchBackend,
  VectorPoint,
  VectorSearchRequest,
  VectorSearchResult,
  VectorFilter,
  VectorScrollRequest,
} from './interface';
import { toQdrantFilter } from './filter-utils';
import { components } from '@qdrant/js-client-rest/dist/types/openapi/generated_schema';

type PointStruct = components['schemas']['PointStruct'];
type Filter = components['schemas']['Filter'];
type ScrollRequest = components['schemas']['ScrollRequest'];

@Injectable()
export class QdrantVectorSearchBackend implements VectorSearchBackend {
  private readonly logger = new Logger(QdrantVectorSearchBackend.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  private collectionName: string;
  private collectionExists: boolean;
  private client: QdrantClient;

  constructor(private configService: ConfigService) {
    this.client = new QdrantClient({
      host: this.configService.getOrThrow('vectorStore.qdrant.host'),
      port: this.configService.getOrThrow('vectorStore.qdrant.port'),
      apiKey: this.configService.get('vectorStore.qdrant.apiKey') || undefined,
      checkCompatibility: false,
    });
    this.collectionName = this.configService.get<string>(
      'vectorStore.qdrant.collectionName',
      'refly_vectors',
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

      // Add 8 bytes for the point ID (assuming it's a 64-bit integer)
      return acc + vectorSize + payloadSize + idSize;
    }, 0);
  }

  async initialize(): Promise<void> {
    const initPromise = this.checkCollectionExists();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Qdrant initialization timed out after ${this.INIT_TIMEOUT}ms`));
      }, this.INIT_TIMEOUT);
    });

    try {
      await Promise.race([initPromise, timeoutPromise]);
      this.logger.log('Qdrant collection initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Qdrant collection: ${error}`);
      throw error;
    }
  }

  private async checkCollectionExists(): Promise<void> {
    const { exists } = await this.client.collectionExists(this.collectionName);
    this.collectionExists = exists;
  }

  private async ensureCollectionExists(vectorDim: number): Promise<void> {
    if (this.collectionExists) {
      this.logger.debug(`collection already exists: ${this.collectionName}`);
      return;
    }

    const res = await this.client.createCollection(this.collectionName, {
      vectors: {
        size: vectorDim,
        distance: 'Cosine',
        on_disk: true,
      },
      hnsw_config: { payload_m: 16, m: 0, on_disk: true },
      on_disk_payload: true,
    });
    this.collectionExists = true;
    this.logger.log(`collection create success: ${res}`);

    await Promise.all([
      this.client.createPayloadIndex(this.collectionName, {
        field_name: 'tenantId',
        field_schema: 'keyword',
      }),
    ]);
  }

  async isCollectionEmpty(): Promise<boolean> {
    const { exists } = await this.client.collectionExists(this.collectionName);
    if (!exists) {
      return true;
    }
    const { count } = await this.client.count(this.collectionName);
    return count === 0;
  }

  async updatePayload(filter: VectorFilter, payload: Record<string, any>): Promise<any> {
    if (!this.collectionExists) {
      return;
    }

    try {
      const qdrantFilter = toQdrantFilter(filter);
      return this.client.setPayload(this.collectionName, {
        filter: qdrantFilter as Filter,
        payload,
      });
    } catch (error) {
      this.logger.error('Error updating payload in Qdrant:', error);
      throw error;
    }
  }

  async batchSaveData(points: VectorPoint[]): Promise<any> {
    if (!points.length) {
      return;
    }

    // Get vector dimension safely by ensuring it's a number array first
    const vector = points[0].vector;
    let vectorDim: number;

    if (!Array.isArray(vector)) {
      throw new Error(`Cannot determine vector dimension: ${JSON.stringify(vector)}`);
    }

    vectorDim = vector.length;
    if (vectorDim <= 0) {
      throw new Error(`Vector dimension is not positive: ${vectorDim}`);
    }

    await this.ensureCollectionExists(vectorDim);

    // Convert VectorPoint to PointStruct
    const qdrantPoints: PointStruct[] = points.map((point) => ({
      id: point.id,
      vector: point.vector,
      payload: point.payload,
    }));

    return this.client.upsert(this.collectionName, {
      wait: true,
      points: qdrantPoints,
    });
  }

  async batchDelete(filter: VectorFilter): Promise<any> {
    if (!this.collectionExists) {
      return;
    }

    try {
      const qdrantFilter = toQdrantFilter(filter);
      return this.client.delete(this.collectionName, {
        wait: true,
        filter: qdrantFilter as Filter,
      });
    } catch (error) {
      this.logger.error('Error deleting data from Qdrant:', error);
      throw error;
    }
  }

  async search(request: VectorSearchRequest, filter: VectorFilter): Promise<VectorSearchResult[]> {
    if (!this.collectionExists) {
      return [];
    }

    try {
      const qdrantFilter = toQdrantFilter(filter);
      const results = await this.client.search(this.collectionName, {
        vector: request.vector,
        limit: request.limit || 10,
        filter: qdrantFilter as Filter,
      });

      return results.map((result) => ({
        id: String(result.id),
        score: result.score,
        payload: result.payload || {},
      }));
    } catch (error) {
      this.logger.error('Error searching in Qdrant:', error);
      throw error;
    }
  }

  async scroll(request: VectorScrollRequest): Promise<VectorPoint[]> {
    if (!this.collectionExists) {
      return [];
    }

    try {
      const points: VectorPoint[] = [];
      let currentOffset = request.offset;

      const qdrantFilter = toQdrantFilter(request.filter);
      const scrollRequest: ScrollRequest = {
        filter: qdrantFilter as Filter,
        limit: request.limit,
        offset: currentOffset,
        with_payload: request.with_payload,
        with_vector: request.with_vector,
      };

      while (true) {
        const response = await this.client.scroll(this.collectionName, {
          ...scrollRequest,
          offset: currentOffset,
        });

        const convertedPoints: VectorPoint[] = response.points.map((point) => ({
          id: String(point.id),
          vector: Array.isArray(point.vector)
            ? Array.isArray(point.vector[0])
              ? (point.vector as number[][])[0] || [] // Handle multi-vector case
              : (point.vector as number[])
            : [],
          payload: point.payload || {},
        }));

        points.push(...convertedPoints);

        if (!response.next_page_offset) {
          break;
        }
        currentOffset = String(response.next_page_offset);
      }

      return points;
    } catch (error) {
      this.logger.error('Error scrolling in Qdrant:', error);
      throw error;
    }
  }
}
