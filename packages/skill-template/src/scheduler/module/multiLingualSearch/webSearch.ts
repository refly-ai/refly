import pLimit from 'p-limit';
import { BatchWebSearchRequest, Source, User } from '@refly/openapi-schema';
import { SkillEngine } from '../../../engine';

const BATCH_SIZE = 100; // Serper's batch limit

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
}

// Helper to chunk array into batches
const chunk = <T>(arr: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
};

// Perform batch search
const performBatchWebSearch = async ({
  queries,
  limit,
  user,
  engine,
  enableTranslateQuery,
}: BatchSearchParams): Promise<Source[]> => {
  const result = await engine.service.webSearch(user, {
    queries,
    limit,
  } as BatchWebSearchRequest);

  // 将结果映射回对应的查询
  return result.data.map((item) => {
    // 根据返回结果的 locale 找到对应的原始查询
    const queryIndex = queries.findIndex((q) => q.hl.toLowerCase() === item.locale?.toLowerCase());
    const query = queryIndex >= 0 ? queries[queryIndex] : null;

    return {
      url: item.url,
      title: item.name,
      pageContent: item.snippet,
      metadata: {
        originalLocale: item.locale || query?.hl || 'unknown',
        originalQuery: query?.originalQuery || query?.q,
        translatedQuery: enableTranslateQuery && query ? query.q : undefined,
        isTranslated: enableTranslateQuery,
      },
    };
  });
};

// Main function to handle concurrent web searches
export const performConcurrentWebSearch = async ({
  queryMap,
  searchLimit,
  concurrencyLimit,
  user,
  engine,
  enableTranslateQuery,
}: {
  queryMap: Record<string, string[]>;
  searchLimit: number;
  concurrencyLimit: number;
  user: any;
  engine: any;
  enableTranslateQuery: boolean;
}): Promise<Source[]> => {
  // Convert queryMap to array of query objects
  const allQueries = Object.entries(queryMap).flatMap(([locale, queries]) =>
    queries.map((query, index) => ({
      q: query,
      hl: locale.toLowerCase(),
      originalQuery: enableTranslateQuery ? queryMap[locale][index] : undefined,
    })),
  );

  // Split into batches of 100 queries
  const batches = chunk(allQueries, BATCH_SIZE);

  // Initialize concurrency limiter
  const limit = pLimit(concurrencyLimit);

  try {
    // Create batch search tasks
    const searchTasks = batches.map((batch) =>
      limit(() =>
        performBatchWebSearch({
          queries: batch,
          limit: searchLimit,
          user,
          engine,
          enableTranslateQuery,
        }),
      ),
    );

    // Execute all search tasks with concurrency control
    const results = await Promise.all(searchTasks);

    // Flatten results array
    return results.flat();
  } catch (error) {
    throw new Error(`Web search failed: ${error.message}`);
  }
};
