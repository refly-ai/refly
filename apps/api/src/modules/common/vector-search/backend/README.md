# Enhanced VectorFilter System

This document describes the enhanced `VectorFilter` system that provides compatibility with both Qdrant and LanceDB vector search backends.

## Overview

The `VectorFilter` type has been refined to support multiple filter formats:
- **Simple Filters**: Basic key-value pairs for straightforward filtering
- **Qdrant Filters**: Structured object-based filters with logical operators
- **LanceDB Filters**: SQL-like string expressions
- **Raw Filters**: Direct Record<string, any> for custom implementations

## Type Definitions

### VectorFilter Union Type

```typescript
type VectorFilter = QdrantFilter | LanceDBFilter | SimpleFilter | string | Record<string, any>;
```

### QdrantFilter Interface

```typescript
interface QdrantFilter {
  must?: FilterCondition[];      // All conditions must be satisfied (AND)
  should?: FilterCondition[];    // At least one condition must be satisfied (OR)
  must_not?: FilterCondition[];  // None of these conditions should be satisfied (NOT)
}
```

### FilterCondition Types

```typescript
interface FilterCondition {
  key: string;
  match?: MatchCondition;
  range?: RangeCondition;
  geo_bounding_box?: GeoBoundingBoxCondition;
  geo_radius?: GeoRadiusCondition;
  geo_polygon?: GeoPolygonCondition;
  values_count?: ValuesCountCondition;
  is_empty?: IsEmptyCondition;
  is_null?: IsNullCondition;
  nested?: NestedCondition;
}
```

## Usage Examples

### 1. Simple Filters

Basic key-value filtering for common use cases:

```typescript
const simpleFilter: VectorFilter = {
  tenantId: 'tenant-123',
  category: 'document',
  status: 'active'
};
```

### 2. Qdrant-Style Filters

Structured filters with logical operators:

```typescript
const qdrantFilter: VectorFilter = {
  must: [
    {
      key: 'tenantId',
      match: { value: 'tenant-123' }
    },
    {
      key: 'score',
      range: { gte: 0.5, lte: 1.0 }
    }
  ],
  should: [
    {
      key: 'category',
      match: { value: 'document' }
    },
    {
      key: 'category',
      match: { value: 'image' }
    }
  ],
  must_not: [
    {
      key: 'status',
      match: { value: 'deleted' }
    }
  ]
};
```

### 3. LanceDB-Style Filters

SQL-like string expressions:

```typescript
const lancedbFilter: VectorFilter = "tenantId = 'tenant-123' AND score >= 0.5 AND category IN ('document', 'image')";
```

### 4. Advanced Filtering Conditions

#### Match Conditions

```typescript
// Exact match
{ key: 'category', match: { value: 'document' } }

// Match any of multiple values
{ key: 'tags', match: { any: ['important', 'urgent'] } }

// Match except specific values
{ key: 'status', match: { except: ['deleted', 'archived'] } }
```

#### Range Conditions

```typescript
// Numeric ranges
{ key: 'score', range: { gte: 0.5, lte: 1.0 } }
{ key: 'timestamp', range: { gt: 1640995200 } }

// Date ranges (as timestamps)
{ key: 'created_at', range: { gte: 1640995200, lt: 1672531200 } }
```

#### Geographic Conditions

```typescript
// Bounding box
{
  key: 'location',
  geo_bounding_box: {
    top_left: { lat: 40.8, lon: -74.0 },
    bottom_right: { lat: 40.7, lon: -73.9 }
  }
}

// Radius search
{
  key: 'location',
  geo_radius: {
    center: { lat: 40.75, lon: -73.95 },
    radius: 1000 // meters
  }
}
```

## FilterUtils Functions

The filter utility functions provide methods for filter type detection, conversion, and validation:

### Type Detection Functions

```typescript
import { isQdrantFilter, isLanceDBFilter, isSimpleFilter } from './filter-utils';

// Check filter types
if (isQdrantFilter(filter)) {
  // Handle Qdrant-style filter
}

if (isLanceDBFilter(filter)) {
  // Handle LanceDB-style filter
}

if (isSimpleFilter(filter)) {
  // Handle simple key-value filter
}
```

### Conversion Functions

```typescript
import { toQdrantFilter, toLanceDBFilter } from './filter-utils';

// Convert any filter to Qdrant format
const qdrantFilter = toQdrantFilter(filter);

// Convert any filter to LanceDB format
const lancedbFilter = toLanceDBFilter(filter);
```

### Validation Function

```typescript
import { validateFilter } from './filter-utils';

// Validate filter structure
const isValid = validateFilter(filter);
```

## Backend Integration

### Qdrant Backend

The Qdrant backend automatically converts filters using `FilterUtils.toQdrantFilter()`:

```typescript
import { toQdrantFilter } from './filter-utils';

async search(request: VectorSearchRequest, filter: VectorFilter): Promise<VectorSearchResult[]> {
  const qdrantFilter = toQdrantFilter(filter);
  const results = await this.client.search(this.collectionName, {
    vector: request.vector,
    limit: request.limit || 10,
    filter: qdrantFilter as Filter,
  });
  // ...
}
```

### LanceDB Backend

The LanceDB backend automatically converts filters using `FilterUtils.toLanceDBFilter()`:

```typescript
import { toLanceDBFilter } from './filter-utils';

async search(request: VectorSearchRequest, filter: VectorFilter): Promise<VectorSearchResult[]> {
  let query = this.table.search(request.vector);
  
  const whereClause = toLanceDBFilter(filter);
  if (whereClause) {
    query = query.where(whereClause);
  }
  // ...
}
```

## Performance Considerations

### Indexing

For optimal performance, ensure that frequently filtered fields are indexed:

**Qdrant:**
```typescript
await this.client.createPayloadIndex(collectionName, {
  field_name: 'tenantId',
  field_schema: 'keyword',
});
```

**LanceDB:**
```typescript
await table.createIndex('tenantId');
```

### Efficient Filter Patterns

1. **Use indexed fields first**: Place conditions on indexed fields at the beginning of your filters
2. **Prefer simple conditions**: Simple equality matches are faster than complex range queries
3. **Limit range queries**: Use specific ranges rather than open-ended queries when possible
4. **Avoid deep nesting**: Minimize nested field access for better performance

### Example Efficient Filters

```typescript
// Good: Uses indexed field first
const efficientFilter = {
  must: [
    { key: 'tenantId', match: { value: 'tenant-123' } }, // Indexed field
    { key: 'score', range: { gte: 0.7 } }                // Specific range
  ]
};

// Less efficient: Complex nested access
const lessEfficientFilter = {
  must: [
    { key: 'metadata.nested.deeply.field', match: { value: 'some-value' } }
  ]
};
```

## Real-World Usage Patterns

### Tenant-Based Filtering

```typescript
export const createTenantFilter = (tenantId: string): VectorFilter => ({
  tenantId
});
```

### User Document Access

```typescript
export const createUserDocumentFilter = (
  userId: string, 
  categories: string[]
): VectorFilter => ({
  must: [
    { key: 'userId', match: { value: userId } },
    { key: 'category', match: { any: categories } },
    { key: 'status', match: { value: 'active' } }
  ]
});
```

### Time-Based Filtering

```typescript
export const createRecentDocumentsFilter = (sinceTimestamp: number): VectorFilter => 
  `created_at >= ${sinceTimestamp} AND deleted_at IS NULL`;
```

### Advanced Search

```typescript
export const createAdvancedSearchFilter = (
  tenantId: string,
  minScore: number,
  excludeCategories: string[],
  tags?: string[]
): VectorFilter => ({
  must: [
    { key: 'tenantId', match: { value: tenantId } },
    { key: 'score', range: { gte: minScore } }
  ],
  should: tags ? [
    { key: 'tags', match: { any: tags } }
  ] : undefined,
  must_not: [
    { key: 'category', match: { any: excludeCategories } }
  ]
});
```

## Migration Guide

### From Old VectorFilter

If you were using the old `Record<string, any>` format:

**Before:**
```typescript
const filter = {
  tenantId: 'tenant-123',
  category: 'document'
};
```

**After (no changes needed):**
```typescript
const filter: VectorFilter = {
  tenantId: 'tenant-123',
  category: 'document'
};
```

### Adding Complex Conditions

**Before (limited functionality):**
```typescript
const filter = {
  tenantId: 'tenant-123'
};
```

**After (enhanced capabilities):**
```typescript
const filter: VectorFilter = {
  must: [
    { key: 'tenantId', match: { value: 'tenant-123' } },
    { key: 'score', range: { gte: 0.5 } }
  ],
  should: [
    { key: 'category', match: { any: ['document', 'image'] } }
  ]
};
```

## Testing

See `filter-examples.ts` for comprehensive examples and test cases demonstrating all filter types and conversion scenarios.

## Best Practices

1. **Use appropriate filter types**: Choose the filter format that best matches your use case
2. **Validate filters**: Use `FilterUtils.validateFilter()` to ensure filter correctness
3. **Index frequently filtered fields**: Create indexes for fields used in filters
4. **Test filter conversion**: Verify that filters work correctly with both backends
5. **Monitor performance**: Profile queries to identify slow filters and optimize accordingly
6. **Use type safety**: Leverage TypeScript types to catch filter errors at compile time

## Troubleshooting

### Common Issues

1. **Filter not working**: Check if the filter is valid using `FilterUtils.validateFilter()`
2. **Poor performance**: Ensure filtered fields are indexed
3. **Conversion errors**: Verify that complex filters are supported by the target backend
4. **Type errors**: Use the correct filter interface for your use case

### Debug Helpers

```typescript
// Check filter type
console.log('Filter type:', {
  isSimple: FilterUtils.isSimpleFilter(filter),
  isQdrant: FilterUtils.isQdrantFilter(filter),
  isLanceDB: FilterUtils.isLanceDBFilter(filter)
});

// View converted filters
console.log('Qdrant format:', FilterUtils.toQdrantFilter(filter));
console.log('LanceDB format:', FilterUtils.toLanceDBFilter(filter));

// Validate filter
console.log('Is valid:', FilterUtils.validateFilter(filter));
``` 