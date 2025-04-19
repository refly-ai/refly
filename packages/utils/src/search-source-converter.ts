import { SearchDomain, SearchResult, Source, SourceMeta } from '@refly/openapi-schema';

// Helper function to generate unique key for a source
const getSourceKey = (source: Source): string => {
  return `${source.url || ''}::${source.title || ''}::${source.pageContent}`;
};

export const mergeSearchResults = (results: Source[]): Source[] => {
  // Use Map to store unique sources, with composite key
  const sourceMap = new Map<string, Source>();

  for (const source of results) {
    const key = getSourceKey(source);

    if (!sourceMap.has(key)) {
      // If source doesn't exist, add it
      sourceMap.set(key, source);
    } else {
      // If source exists, merge metadata and selections if present
      const existingSource = sourceMap.get(key) as Source;

      // Merge metadata with translation information
      if (source.metadata && existingSource.metadata) {
        existingSource.metadata = {
          ...existingSource.metadata,
          ...source.metadata,
          // Preserve translation information
          originalQuery: source.metadata.originalQuery || existingSource.metadata.originalQuery,
          translatedQuery:
            source.metadata.translatedQuery || existingSource.metadata.translatedQuery,
          isTranslated: source.metadata.isTranslated || existingSource.metadata.isTranslated,
        };
      }

      // Merge selections if exists
      if (source.selections?.length) {
        existingSource.selections = [...(existingSource.selections || []), ...source.selections];
      }

      // Keep higher score if exists
      if (
        source.score !== undefined &&
        (existingSource.score === undefined || source.score > existingSource.score)
      ) {
        existingSource.score = source.score;
      }
    }
  }

  // Convert Map back to array and sort by score if available
  return Array.from(sourceMap.values()).sort((a, b) => {
    // Add translation boost if needed
    const getEffectiveScore = (source: Source) => {
      let score = source.score || 0;
      // Optionally boost scores for results from translated queries
      if (source.metadata?.isTranslated) {
        score *= 0.95; // Slight penalty for translated results
      }
      return score;
    };

    return getEffectiveScore(b) - getEffectiveScore(a);
  });
};

// Helper function to convert Source[] to SearchResult[]
export const sourcesToSearchResults = (sources: Source[]): SearchResult[] => {
  return sources.map((source) => ({
    id: source.url || '', // Use URL as ID for web sources
    domain: 'resource' as SearchDomain, // Web search results are treated as resources
    title: source.title || '',
    snippets: [
      {
        text: source.pageContent || '',
        highlights: [],
      },
    ],
    relevanceScore: source.score, // Preserve existing score if any
    metadata: {
      ...source.metadata,
      url: source.url,
    },
  }));
};

// Helper function to convert SearchResult[] back to Source[]
export const searchResultsToSources = (results: SearchResult[]): Source[] => {
  return results.map((result) => ({
    url: (result.metadata?.url as string) || '',
    title: result.title,
    pageContent: result.snippets?.[0]?.text || '',
    score: result.relevanceScore, // Map relevanceScore to score
    metadata: {
      ...result.metadata,
      score: result.relevanceScore, // Also store in metadata for consistency
    } as any as SourceMeta,
  }));
};

// Add new function to deduplicate sources by title
export const deduplicateSourcesByTitle = (sources: Source[]): Source[] => {
  const titleMap = new Map<string, Source>();

  for (const source of sources) {
    const normalizedTitle = source.title?.trim().toLowerCase() || '';

    // Skip empty titles
    if (!normalizedTitle) continue;

    // If title exists, only replace if current source has higher score
    if (
      !titleMap.has(normalizedTitle) ||
      (source.score || 0) > (titleMap.get(normalizedTitle)?.score || 0)
    ) {
      titleMap.set(normalizedTitle, source);
    }
  }

  // Keep sources with unique titles and any sources without titles
  return sources.filter((source) => {
    const normalizedTitle = source.title?.trim().toLowerCase() || '';
    return !normalizedTitle || titleMap.get(normalizedTitle) === source;
  });
};
