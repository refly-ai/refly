# Vector Search Service

A flexible, backend-agnostic vector search service that supports multiple vector database backends including Qdrant and LanceDB.

## Features

- 🔄 **Swappable Backends**: Easy switching between different vector databases
- 🎯 **Consistent API**: Same interface regardless of backend
- 🚀 **High Performance**: Optimized for vector operations
- 🔍 **Advanced Filtering**: Support for complex metadata filters
- 📊 **Batch Operations**: Efficient bulk save and delete operations
- 🧪 **Easy Testing**: Simple mocking and testing capabilities

## Supported Backends

### Qdrant
- **Type**: Client-server vector database
- **Best for**: Production deployments, large-scale applications
- **Features**: Advanced filtering, horizontal scaling, REST/gRPC APIs
- **Setup**: Requires separate Qdrant server

### LanceDB
- **Type**: Embedded vector database
- **Best for**: Development, small deployments, local applications
- **Features**: No server required, multi-modal support, cloud storage
- **Setup**: No additional setup required

### Milvus
- **Type**: Distributed vector database
- **Best for**: Enterprise deployments, high-scale applications, cloud-native
- **Features**: Horizontal scaling, high availability, advanced indexing, cloud-native
- **Setup**: Requires Milvus cluster or standalone instance

## Installation

The service is automatically available when you import the common module:

```typescript
import { VECTOR_SEARCH } from '../common/vector-search/tokens';
```

## Configuration

### Qdrant Backend
```yaml
vectorStore:
  backend: 'qdrant'
  url: 'http://localhost:6333'
  collectionName: 'refly_vectors'
```

### LanceDB Backend
```yaml
vectorStore:
  backend: 'lancedb'
  uri: './data/lancedb'  # Local directory
  # OR
  uri: 's3://my-bucket/lancedb'  # S3 storage
  # OR
  uri: 'gs://my-bucket/lancedb'  # Google Cloud Storage
```

### Milvus Backend
```yaml
vectorStore:
  backend: 'milvus'
  milvus:
    address: 'localhost:19530'
    username: 'your_username'
    password: 'your_password'
    ssl: false
    collectionName: 'refly_vectors'
    vectorDimension: 1536
```

## Usage

### Basic Setup

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { VectorSearchService } from '../common/vector-search';
import { VECTOR_SEARCH } from '../common/vector-search/tokens';

@Injectable()
export class MyService {
  constructor(
    @Inject(VECTOR_SEARCH)
    private readonly vectorSearchService: VectorSearchService,
  ) {}
}
```

### Save Vector Points

```typescript
const points = [
  {
    id: 'doc1',
    vector: [0.1, 0.2, 0.3, 0.4],
    payload: {
      title: 'Document Title',
      content: 'Document content...',
      type: 'document',
      userId: 'user123',
    },
  },
];

await this.vectorSearchService.batchSaveData(points);
```

### Search for Similar Vectors

```typescript
const results = await this.vectorSearchService.search(
  {
    vector: [0.1, 0.2, 0.3, 0.4],
    limit: 10,
  },
  {
    must: [
      { key: 'type', match: { value: 'document' } },
      { key: 'userId', match: { value: 'user123' } },
    ],
  }
);
```

### Scroll Through Points

```typescript
const points = await this.vectorSearchService.scroll({
  filter: {
    must: [{ key: 'type', match: { value: 'document' } }],
  },
  limit: 100,
});
```

### Update Metadata

```typescript
await this.vectorSearchService.updatePayload(
  { must: [{ key: 'id', match: { value: 'doc1' } }] },
  { updated: true, lastModified: new Date().toISOString() }
);
```

### Delete Points

```typescript
await this.vectorSearchService.batchDelete({
  must: [{ key: 'id', match: { value: 'doc1' } }],
});
```

## API Reference

### VectorSearchService

#### Methods

- `isCollectionEmpty(): Promise<boolean>` - Check if collection is empty
- `batchSaveData(points: VectorPoint[]): Promise<any>` - Save multiple points
- `batchDelete(filter: VectorFilter): Promise<any>` - Delete points by filter
- `search(request: VectorSearchRequest, filter: VectorFilter): Promise<VectorSearchResult[]>` - Search similar vectors
- `scroll(request: VectorScrollRequest): Promise<VectorPoint[]>` - Scroll through points
- `updatePayload(filter: VectorFilter, payload: Record<string, any>): Promise<any>` - Update metadata
- `estimatePointsSize(points: VectorPoint[]): number` - Estimate storage size

### Types

#### VectorPoint
```typescript
interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}
```

#### VectorSearchRequest
```typescript
interface VectorSearchRequest {
  vector: number[];
  limit?: number;
}
```

#### VectorFilter
```typescript
interface VectorFilter {
  must?: Array<{
    key: string;
    match: { value: any };
  }>;
  [key: string]: any;
}
```

#### VectorSearchResult
```typescript
interface VectorSearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}
```

## Testing

### Mock the Service

```typescript
const mockVectorSearchService = {
  isCollectionEmpty: jest.fn(),
  batchSaveData: jest.fn(),
  search: jest.fn(),
  scroll: jest.fn(),
  batchDelete: jest.fn(),
  updatePayload: jest.fn(),
  estimatePointsSize: jest.fn(),
};

beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      YourService,
      { provide: VECTOR_SEARCH, useValue: mockVectorSearchService },
    ],
  }).compile();
});
```

## Migration from QdrantService

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions from the old `QdrantService`.

## Adding New Backends

To add support for a new vector database:

1. **Implement the Backend Interface**:
```typescript
export class MyVectorBackend implements VectorSearchBackend {
  // Implement all required methods
}
```

2. **Update the Factory**:
```typescript
// In index.ts
if (backendType === 'my-backend') {
  backend = new MyVectorBackend(configService);
}
```

3. **Add Configuration Support**:
```yaml
vectorStore:
  backend: 'my-backend'
  # Add backend-specific config
```

## Performance Considerations

### Qdrant
- Excellent for large-scale deployments
- Supports horizontal scaling
- Network latency considerations
- Advanced indexing options

### LanceDB
- Optimized for read-heavy workloads
- No network overhead for local deployments
- Automatic indexing
- Efficient storage format

## Troubleshooting

### Common Issues

1. **Backend Not Found**: Check configuration backend type
2. **Connection Timeout**: Verify network connectivity (Qdrant) or file permissions (LanceDB)
3. **Type Errors**: Ensure using correct interface types

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
// The service automatically logs initialization and errors
// Check your application logs for vector search related messages
```

## Examples

See [example.ts](./example.ts) for complete usage examples with both backends.

## Architecture

```
VectorSearchService
├── VectorSearchBackend (interface)
├── QdrantVectorSearchBackend
├── LanceDBVectorSearchBackend
└── [Future backends...]
```

The service uses a factory pattern to create the appropriate backend based on configuration, ensuring a consistent API regardless of the underlying vector database. 