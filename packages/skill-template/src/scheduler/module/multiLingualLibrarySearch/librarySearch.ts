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
  return items.map((item) => {
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
}: BatchSearchParams): Promise<Source[]> => {
  // Use the general search method with appropriate options
  const results = await Promise.all(
    queries.map((query) => {
      // Prepare search request based on semanticSearch.ts implementation
      return engine.service.search(
        user,
        {
          query: query.q,
          limit,
          mode: 'vector',
          domains: ['resource', 'document'] as SearchDomain[],
          // If enableSearchWholeSpace is true, don't specify entities to search the whole space
          entities: enableSearchWholeSpace ? [] : undefined,
        },
        // Pass options as any to avoid type errors with locale
        { enableReranker: false } as any,
      );
    }),
  );

  // Process and flatten results
  return results.flatMap((result, index) => {
    const query = queries[index];

    if (!result.data || result.data.length === 0) {
      return [];
    }

    // Process search results into grouped documents and resources
    const processedItems = processSearchResults(result.data);

    // Convert to Source format for compatibility with the rest of the system
    return convertToSources(processedItems, query, enableTranslateQuery);
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
}: {
  queryMap: Record<string, string[]>;
  searchLimit: number;
  concurrencyLimit: number;
  user: any;
  engine: any;
  enableTranslateQuery: boolean;
  enableSearchWholeSpace?: boolean;
}): Promise<Source[]> => {
  // Convert queryMap to array of query objects
  const allQueries = Object.entries(queryMap).flatMap(([locale, queries]) =>
    queries.map((query, index) => ({
      q: query,
      hl: locale.toLowerCase(),
      originalQuery: enableTranslateQuery ? queryMap[locale][index] : undefined,
    })),
  );

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
            s.metadata.entityId === source.metadata.entityId,
        ),
    );

    return uniqueResults;
  } catch (error) {
    throw new Error(`Library search failed: ${error.message}`);
  }
};
