import { Injectable, Inject } from '@nestjs/common';
import { VectorSearchService } from './index';
import { VECTOR_SEARCH } from './tokens';
import { VectorPoint, VectorFilter } from './backend/interface';

/**
 * Example service showing how to use the VectorSearchService
 */
@Injectable()
export class ExampleVectorService {
  constructor(
    @Inject(VECTOR_SEARCH)
    private readonly vectorSearchService: VectorSearchService,
  ) {}

  async exampleUsage() {
    // Example 1: Save vector points
    const points: VectorPoint[] = [
      {
        id: 'doc1',
        vector: [0.1, 0.2, 0.3, 0.4],
        payload: {
          title: 'First Document',
          content: 'This is the content of the first document',
          type: 'document',
          userId: 'user123',
        },
      },
      {
        id: 'doc2',
        vector: [0.5, 0.6, 0.7, 0.8],
        payload: {
          title: 'Second Document',
          content: 'This is the content of the second document',
          type: 'document',
          userId: 'user456',
        },
      },
    ];

    await this.vectorSearchService.batchSaveData(points);
    console.log('Saved vector points');

    // Example 2: Search for similar vectors
    const searchVector = [0.1, 0.2, 0.3, 0.4];
    const filter: VectorFilter = {
      must: [
        {
          key: 'type',
          match: { value: 'document' },
        },
      ],
    };

    const searchResults = await this.vectorSearchService.search(
      {
        vector: searchVector,
        limit: 5,
      },
      filter,
    );

    console.log('Search results:', searchResults);

    // Example 3: Scroll through all points
    const scrollResults = await this.vectorSearchService.scroll({
      filter: {
        must: [
          {
            key: 'type',
            match: { value: 'document' },
          },
        ],
      },
      limit: 10,
    });

    console.log('Scroll results:', scrollResults);

    // Example 4: Update payload
    await this.vectorSearchService.updatePayload(
      {
        must: [
          {
            key: 'id',
            match: { value: 'doc1' },
          },
        ],
      },
      {
        updated: true,
        lastModified: new Date().toISOString(),
      },
    );

    console.log('Updated payload for doc1');

    // Example 5: Delete a document
    await this.vectorSearchService.batchDelete({
      must: [
        {
          key: 'id',
          match: { value: 'doc2' },
        },
      ],
    });

    console.log('Deleted doc2');

    // Example 6: Estimate size
    const estimatedSize = this.vectorSearchService.estimatePointsSize(points);
    console.log('Estimated size:', estimatedSize, 'bytes');

    // Example 7: Check if collection is empty
    const isEmpty = await this.vectorSearchService.isCollectionEmpty();
    console.log('Collection is empty:', isEmpty);
  }
}

/**
 * Configuration Examples
 *
 * For Qdrant Backend:
 * ```yaml
 * vectorStore:
 *   backend: 'qdrant'
 *   url: 'http://localhost:6333'
 *   collectionName: 'refly_vectors'
 * ```
 *
 * For LanceDB Backend:
 * ```yaml
 * vectorStore:
 *   backend: 'lancedb'
 *   uri: './data/lancedb'  # Local directory
 *   # OR
 *   uri: 's3://my-bucket/lancedb'  # S3 storage
 *   # OR
 *   uri: 'gs://my-bucket/lancedb'  # Google Cloud Storage
 * ```
 *
 * Backend Comparison:
 *
 * Qdrant:
 * - Requires separate server
 * - Excellent for production deployments
 * - Advanced filtering capabilities
 * - Horizontal scaling support
 * - REST and gRPC APIs
 *
 * LanceDB:
 * - Embedded database (no server required)
 * - Perfect for development and small deployments
 * - Multi-modal AI support
 * - Local and cloud storage options
 * - SQL-like query syntax
 * - Optimized for read-heavy workloads
 */
