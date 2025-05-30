import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VectorSearchBackend,
  VectorPoint,
  VectorSearchRequest,
  VectorSearchResult,
  VectorFilter,
  VectorScrollRequest,
} from './backend/interface';
import { QdrantVectorSearchBackend } from './backend/qdrant';
import { LanceDBVectorSearchBackend } from './backend/lancedb';

@Injectable()
export class VectorSearchService implements OnModuleInit {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(private readonly backend: VectorSearchBackend) {}

  async onModuleInit() {
    await this.backend.initialize();
    this.logger.log('Vector search service initialized');
  }

  /**
   * Check if the collection is empty
   * @returns true if the collection is empty or doesn't exist
   */
  async isCollectionEmpty(): Promise<boolean> {
    return this.backend.isCollectionEmpty();
  }

  /**
   * Batch save vector points
   * @param points Array of vector points to save
   * @returns Result of the batch save operation
   */
  async batchSaveData(points: VectorPoint[]): Promise<any> {
    return this.backend.batchSaveData(points);
  }

  /**
   * Batch delete vector points based on filter
   * @param filter Filter to identify which points to delete
   * @returns Result of the batch delete operation
   */
  async batchDelete(filter: VectorFilter): Promise<any> {
    return this.backend.batchDelete(filter);
  }

  /**
   * Search for similar vectors
   * @param request Search request parameters
   * @param filter Filter to apply to the search
   * @returns Array of search results
   */
  async search(request: VectorSearchRequest, filter: VectorFilter): Promise<VectorSearchResult[]> {
    return this.backend.search(request, filter);
  }

  /**
   * Scroll through vector points
   * @param request Scroll request parameters
   * @returns Array of vector points
   */
  async scroll(request: VectorScrollRequest): Promise<VectorPoint[]> {
    return this.backend.scroll(request);
  }

  /**
   * Update payload for points matching the filter
   * @param filter Filter to identify which points to update
   * @param payload New payload or partial payload to apply
   * @returns Result of the update operation
   */
  async updatePayload(filter: VectorFilter, payload: Record<string, any>): Promise<any> {
    return this.backend.updatePayload(filter, payload);
  }

  /**
   * Estimate the size of points in bytes
   * @param points Array of vector points
   * @returns Estimated size in bytes
   */
  estimatePointsSize(points: VectorPoint[]): number {
    return this.backend.estimatePointsSize(points);
  }
}

export const createVectorSearchFactory = () => {
  return (configService: ConfigService) => {
    const backendType = configService.get('vectorStore.backend', 'qdrant');

    let backend: VectorSearchBackend;
    if (backendType === 'qdrant') {
      backend = new QdrantVectorSearchBackend(configService);
    } else if (backendType === 'lancedb') {
      backend = new LanceDBVectorSearchBackend(configService);
    } else {
      throw new Error(
        `Unknown vector search backend type: ${backendType}. Supported backends: qdrant, lancedb`,
      );
    }

    return new VectorSearchService(backend);
  };
};

// Export the provider tokens
export * from './tokens';
export * from './backend/interface';
