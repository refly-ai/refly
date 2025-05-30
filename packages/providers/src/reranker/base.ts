import { SearchResult, RerankerModelConfig } from '@refly/openapi-schema';

/**
 * Reranker configuration interface
 */
export interface RerankerConfig extends RerankerModelConfig {
  /** API credentials */
  apiKey: string;
  /** Base URL for API endpoint */
  baseUrl?: string;
}

/**
 * Base interface for reranking search results
 */
export abstract class BaseReranker {
  protected config: Partial<RerankerConfig>;

  constructor(config?: Partial<RerankerConfig>) {
    this.config = { ...config };
  }

  /**
   * Rerank search results based on the query
   *
   * @param query The user query
   * @param results The search results to rerank
   * @param options Additional options for reranking
   * @returns Reranked search results
   */
  abstract rerank(
    query: string,
    results: SearchResult[],
    options?: {
      topN?: number;
      relevanceThreshold?: number;
      [key: string]: any;
    },
  ): Promise<SearchResult[]>;

  /**
   * Fallback method when reranking fails
   *
   * @param results Original search results
   * @returns Fallback ranked results
   */
  protected defaultFallback(results: SearchResult[]): SearchResult[] {
    // When falling back, maintain the original order but add default relevance scores
    return results.map((result, index) => ({
      ...result,
      relevanceScore: 1 - index * 0.1, // Simple fallback scoring based on original order
    }));
  }
}
