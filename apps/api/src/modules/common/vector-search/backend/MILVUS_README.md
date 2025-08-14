# Milvus Vector Search Backend

This document describes the Milvus backend implementation for the Refly vector search service.

## Overview

The Milvus backend provides vector search capabilities using the Milvus vector database. It implements the `VectorSearchBackend` interface and supports all standard vector operations including search, insert, delete, and update operations.

## Features

- **Vector Search**: Similarity search using cosine distance
- **Batch Operations**: Efficient batch insert and delete operations
- **Filtering**: Support for complex filtering expressions
- **Multi-tenancy**: Built-in support for tenant and project isolation
- **Dynamic Fields**: Flexible metadata storage using dynamic fields
- **Indexing**: Automatic index creation for optimal search performance

## Configuration

### Environment Variables

```bash
# Vector store backend type
VECTOR_STORE_BACKEND=milvus

# Milvus connection settings
MILVUS_ADDRESS=localhost:19530
MILVUS_USERNAME=your_username
MILVUS_PASSWORD=your_password
MILVUS_SSL=false

# Collection settings
MILVUS_COLLECTION_NAME=refly_vectors
MILVUS_VECTOR_DIMENSION=1536
```

### Configuration Structure

```typescript
vectorStore: {
  backend: 'milvus',
  milvus: {
    address: 'localhost:19530',
    username: 'your_username',
    password: 'your_password',
    ssl: false,
    collectionName: 'refly_vectors',
    vectorDimension: 1536,
  },
}
```

## Schema Design

The Milvus collection is created with the following schema:

| Field | Type | Description | Max Length |
|-------|------|-------------|------------|
| `id` | VarChar | Primary key for vector points | 65535 |
| `vector` | FloatVector | Vector embedding | 1536 (configurable) |
| `tenantId` | VarChar | Tenant identifier | 100 |
| `projectId` | VarChar | Project identifier | 100 |
| `type` | VarChar | Vector type classification | 50 |
| `metadata` | VarChar | JSON string for additional payload | 65535 |

### Dynamic Fields

The collection enables dynamic fields, allowing flexible storage of additional metadata beyond the predefined schema fields.

## Operations

### Initialization

The backend automatically:
1. Connects to the Milvus instance
2. Checks if the collection exists
3. Creates the collection with proper schema if it doesn't exist
4. Creates an IVF_FLAT index for vector similarity search
5. Loads the collection for operations

### Vector Search

```typescript
const results = await vectorSearchService.search(
  { vector: embedding, limit: 10 },
  { tenantId: 'tenant1', projectId: 'project1' }
);
```

**Search Parameters:**
- `vector`: Query vector for similarity search
- `limit`: Maximum number of results to return
- `expr`: Milvus expression for filtering

**Index Type:** IVF_FLAT with cosine distance metric

### Batch Insert

```typescript
const points: VectorPoint[] = [
  {
    id: 'point1',
    vector: [0.1, 0.2, ...],
    payload: { tenantId: 'tenant1', content: 'text' }
  }
];

await vectorSearchService.batchSaveData(points);
```

**Data Processing:**
- Common fields (`tenantId`, `projectId`, `type`) are stored as separate columns
- Remaining payload is serialized to JSON and stored in the `metadata` field
- Automatic collection creation if it doesn't exist

### Batch Delete

```typescript
await vectorSearchService.batchDelete({
  tenantId: 'tenant1',
  projectId: 'project1'
});
```

**Filter Support:**
- Simple key-value filters
- Qdrant-style structured filters
- SQL WHERE clause filters
- Complex logical expressions (AND, OR, NOT)

### Update Operations

Due to Milvus limitations, payload updates are implemented as delete-and-reinsert operations:

1. Query existing records matching the filter
2. Delete matching records
3. Re-insert with updated payload

## Filter Conversion

The backend includes comprehensive filter conversion utilities:

### Simple Filters
```typescript
{ tenantId: 'tenant1' } → 'tenantId == "tenant1"'
```

### Complex Filters
```typescript
{
  must: [{ key: 'tenantId', match: { value: 'tenant1' } }],
  should: [{ key: 'type', match: { any: ['text', 'image'] } }]
}
→ 'tenantId == "tenant1" && (type in ["text", "image"])'
```

### SQL Filters
```sql
WHERE tenantId = 'tenant1' AND type IN ('text', 'image')
→ 'tenantId == "tenant1" && type in ["text", "image"]'
```

## Performance Considerations

### Index Configuration
- **Index Type**: IVF_FLAT for balanced performance and accuracy
- **Metric**: Cosine distance for normalized vectors
- **Parameters**: nlist=1024 for optimal clustering

### Batch Operations
- Efficient batch insert with configurable batch sizes
- Bulk delete operations with expression filtering
- Connection pooling for concurrent operations

### Memory Management
- Automatic collection loading/unloading
- Configurable timeout for initialization
- Error handling for connection issues

## Error Handling

The backend implements comprehensive error handling:

- **Connection Timeouts**: 10-second timeout for initialization
- **Graceful Degradation**: Fallback behavior for missing collections
- **Detailed Logging**: Structured logging for debugging
- **Exception Propagation**: Proper error propagation to calling services

## Monitoring and Logging

### Log Levels
- **Info**: Successful operations and initialization
- **Debug**: Collection existence checks and schema details
- **Warn**: Non-critical errors (e.g., collection not found)
- **Error**: Critical errors requiring attention

### Metrics
- Vector insertion counts
- Search operation performance
- Collection statistics
- Error rates and types

## Deployment Considerations

### Milvus Instance
- **Standalone**: Suitable for development and testing
- **Cluster**: Recommended for production with high availability
- **Cloud**: Managed Milvus services available

### Resource Requirements
- **Memory**: Depends on collection size and index type
- **Storage**: Vector data + metadata storage
- **CPU**: Index building and search operations

### Security
- **Authentication**: Username/password authentication
- **SSL/TLS**: Encrypted connections
- **Network**: Firewall rules for Milvus ports

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check Milvus service status
   - Verify address and port configuration
   - Check network connectivity

2. **Collection Creation Failed**
   - Verify Milvus permissions
   - Check available disk space
   - Review Milvus logs for errors

3. **Search Performance Issues**
   - Monitor index building progress
   - Check collection statistics
   - Consider index type optimization

### Debug Commands

```bash
# Check Milvus service status
docker ps | grep milvus

# View Milvus logs
docker logs milvus-standalone

# Check collection status
curl -X GET "http://localhost:9091/api/v1/collections"
```

## Migration from Other Backends

### From Qdrant
- Filters are automatically converted
- Vector dimensions should match
- Metadata structure may need adjustment

### From LanceDB
- SQL filters are converted to Milvus expressions
- Table structure maps to collection schema
- Batch operations are optimized for Milvus

## Future Enhancements

- **Hybrid Search**: Combine vector and scalar search
- **Partitioning**: Support for collection partitioning
- **Backup/Restore**: Automated backup strategies
- **Metrics Integration**: Prometheus metrics export
- **Health Checks**: Automated health monitoring 