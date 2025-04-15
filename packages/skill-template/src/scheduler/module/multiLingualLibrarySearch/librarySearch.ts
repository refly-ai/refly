import pLimit from 'p-limit';
import { Source, User, SearchDomain } from '@refly-packages/openapi-schema';
import { SkillEngine } from '../../../engine';
import { assembleChunks } from '../../utils/semanticSearch';
import { SkillContextDocumentItem, SkillContextResourceItem } from '@refly-packages/openapi-schema';

const BATCH_SIZE = 100; // Maximum batch size for library search

interface BatchSearchParams {
  queries: Array<{
    q: string;
    hl: string;
    originalQuery?: string;
  }>;
  limit: number;
  user: User;
  engine: SkillEngine;
  enableTranslateQuery: boolean;
  enableSearchWholeSpace?: boolean;
  projectId?: string;
}

// Helper to chunk array into batches
const chunk = <T>(arr: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
};

// Define a custom interface for our document chunks
interface SearchChunk {
  id: string;
  pageContent: string;
  metadata: {
    title?: string;
    domain?: string;
    url?: string;
    [key: string]: any;
  };
}

// Process search results into grouped documents and resources
const processSearchResults = (
  results: any[],
): (SkillContextDocumentItem | SkillContextResourceItem)[] => {
  // Group chunks by domain and id
  const groupedChunks: Record<string, SearchChunk[]> = {};

  for (const item of results) {
    const id = item.id;
    const domain = item.domain;
    const key = `${domain}-${id}`;

    if (!groupedChunks[key]) {
      groupedChunks[key] = [];
    }

    groupedChunks[key].push({
      id: item.id,
      pageContent: item?.snippets?.map((s: any) => s.text).join('\n\n') || '',
      metadata: {
        title: item.title,
        domain: item.domain,
        url: item.url,
      },
    });
  }

  // Process each group into a document or resource
  const result: (SkillContextDocumentItem | SkillContextResourceItem)[] = [];

  for (const key in groupedChunks) {
    const [domain, id] = key.split('-');
    const chunks = groupedChunks[key].map((chunk) => ({
      pageContent: chunk.pageContent,
      metadata: chunk.metadata,
    }));

    const assembledContent = assembleChunks(chunks as any);

    if (domain === 'resource') {
      result.push({
        resource: {
          resourceId: id,
          content: assembledContent,
          title: groupedChunks[key][0]?.metadata?.title || '',
          resourceType: 'text',
          data: {
            url: groupedChunks[key][0]?.metadata?.url || '',
          },
        },
      } as SkillContextResourceItem);
    } else if (domain === 'document') {
      result.push({
        document: {
          docId: id,
          content: assembledContent,
          title: groupedChunks[key][0]?.metadata?.title || '',
        },
      } as SkillContextDocumentItem);
    }
  }

  return result;
};

// Convert documents and resources to Source format for compatibility
const convertToSources = (
  items: (SkillContextDocumentItem | SkillContextResourceItem)[],
  query: { hl: string; q: string; originalQuery?: string },
  enableTranslateQuery: boolean,
): Source[] => {
  // Basic validation
  if (!items || !Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    try {
      let url = '';
      let title = '';
      let pageContent = '';
      let domain = '';
      let id = '';

      if ('resource' in item && item.resource) {
        url = item.resource.data?.url || '';
        title = item.resource.title || '';
        pageContent = item.resource.content || '';
        domain = 'resource';
        id = item.resource.resourceId;
      } else if ('document' in item && item.document) {
        url = ''; // Documents may not have URLs
        title = item.document.title || '';
        pageContent = item.document.content || '';
        domain = 'document';
        id = item.document.docId;
      }

      return {
        url,
        title,
        pageContent,
        metadata: {
          originalLocale: query?.hl || 'unknown',
          originalQuery: query?.originalQuery || query?.q,
          translatedQuery: enableTranslateQuery && query ? query.q : undefined,
          isTranslated: enableTranslateQuery,
          source: 'library',
          sourceType: 'library',
          entityId: id,
          entityType: domain,
        },
      };
    } catch (error) {
      console.error('Error converting item to source:', error);
      // Return a minimal valid source in case of error
      return {
        url: '',
        title: 'Error Processing Item',
        pageContent: '',
        metadata: {
          entityType: 'error',
          entityId: 'error',
          source: 'library',
          sourceType: 'library',
        },
      };
    }
  });
};

// Perform batch library search
const performBatchLibrarySearch = async ({
  queries,
  limit,
  user,
  engine,
  enableTranslateQuery,
  enableSearchWholeSpace,
  projectId,
}: BatchSearchParams): Promise<Source[]> => {
  // Use the general search method with appropriate options
  const results = await Promise.all(
    queries.map(async (query) => {
      try {
        // Validate query parameters
        if (!query || !query.q || query.q.trim() === '') {
          engine.logger.warn('Empty query in batch library search');
          return { data: [] };
        }

        // Prepare search request based on semanticSearch.ts implementation
        return await engine.service.search(
          user,
          {
            query: query.q,
            limit,
            mode: 'vector',
            domains: ['resource', 'document'] as SearchDomain[],
            // If enableSearchWholeSpace is true, don't specify entities to search the whole space
            entities: enableSearchWholeSpace ? [] : undefined,
            projectId,
          },
          // Pass options as any to avoid type errors with locale
          { enableReranker: false } as any,
        );
      } catch (error) {
        engine.logger.error(`Error in individual search query (${query.q}): ${error.message}`);
        return { data: [] };
      }
    }),
  );

  // Process and flatten results
  return results.flatMap((result, index) => {
    try {
      const query = queries[index];

      if (!result?.data || result.data.length === 0) {
        return [];
      }

      // Process search results into grouped documents and resources
      const processedItems = processSearchResults(result.data);

      // Convert to Source format for compatibility with the rest of the system
      return convertToSources(processedItems, query, enableTranslateQuery);
    } catch (error) {
      console.error('Error processing search result:', error);
      return []; // Return empty array for this result to not break the chain
    }
  });
};

// Main function to handle concurrent library searches
export const performConcurrentLibrarySearch = async ({
  queryMap,
  searchLimit,
  concurrencyLimit,
  user,
  engine,
  enableTranslateQuery,
  enableSearchWholeSpace,
  projectId,
}: {
  queryMap: Record<string, string[]>;
  searchLimit: number;
  concurrencyLimit: number;
  user: any;
  engine: any;
  enableTranslateQuery: boolean;
  enableSearchWholeSpace?: boolean;
  projectId?: string;
}): Promise<Source[]> => {
  // Validate queryMap
  if (!queryMap || typeof queryMap !== 'object' || Object.keys(queryMap).length === 0) {
    engine.logger.warn('Invalid or empty queryMap provided to performConcurrentLibrarySearch');
    return [];
  }

  // Convert queryMap to array of query objects, filtering out empty queries
  const allQueries = Object.entries(queryMap).flatMap(([locale, queries]) => {
    if (!Array.isArray(queries) || queries.length === 0) {
      engine.logger.warn(`Empty queries array for locale ${locale} in queryMap`);
      return [];
    }

    return queries
      .filter((query) => query && typeof query === 'string' && query.trim() !== '')
      .map((query, index) => ({
        q: query,
        hl: locale.toLowerCase(),
        originalQuery: enableTranslateQuery ? queryMap[locale][index] : undefined,
      }));
  });

  // Check if we have any valid queries after filtering
  if (allQueries.length === 0) {
    engine.logger.warn('No valid queries found in queryMap');
    return [];
  }

  // Split into batches
  const batches = chunk(allQueries, BATCH_SIZE);

  // Initialize concurrency limiter
  const limit = pLimit(concurrencyLimit);

  try {
    // Create batch search tasks
    const searchTasks = batches.map((batch) =>
      limit(() =>
        performBatchLibrarySearch({
          queries: batch,
          limit: searchLimit,
          user,
          engine,
          enableTranslateQuery,
          enableSearchWholeSpace,
          projectId,
        }),
      ),
    );

    // Execute all search tasks with concurrency control
    const results = await Promise.all(searchTasks);

    // Flatten results array and remove duplicates by entityId and entityType
    const allResults = results.flat();
    const uniqueResults = allResults.filter(
      (source, index, self) =>
        index ===
        self.findIndex(
          (s) =>
            s.metadata.entityType === source.metadata.entityType &&
            s.metadata.entityId === source.metadata.entityId &&
            s?.pageContent === source.pageContent,
        ),
    );

    return uniqueResults;
  } catch (error) {
    throw new Error(`Library search failed: ${error.message}`);
  }
};
