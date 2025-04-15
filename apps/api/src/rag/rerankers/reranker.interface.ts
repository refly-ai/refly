import { SearchResult } from '@refly-packages/openapi-schema';

/**
 * Interface for all reranker implementations.
 */
export interface RerankerInterface {
  /**
   * Reranks the given search results based on the query.
   * @param query The search query.
   * @param results The initial list of search results to rerank.
   * @param options Optional parameters for reranking.
   *   - topN: The maximum number of results to return after reranking.
   *   - relevanceThreshold: The minimum relevance score for a result to be included.
   * @returns A promise that resolves to the list of reranked search results.
   */
  rerank(
    query: string,
    results: SearchResult[],
    options?: { topN?: number; relevanceThreshold?: number },
  ): Promise<SearchResult[]>;
}

/**
 * Interface for the structure of configuration objects passed to Reranker constructors.
 * Specific implementations might extend this or use specific parts.
 */
export interface RerankerConfig {
  type: string; // 'jina', 'xinference', 'ollama', etc.
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
  topN?: number;
  relevanceThreshold?: number;
  // Add other common or specific config fields as needed
}

// Define specific response structures if needed, e.g., for Xinference
// This helps in parsing the raw response from the API
export interface XinferenceRerankResult {
    index: number;
    relevance_score: number;
    document: string; // Assuming Xinference returns the original document text
}

export interface XinferenceRerankerResponse {
    id: string; // Assuming Xinference response has an ID
    results: XinferenceRerankResult[];
}