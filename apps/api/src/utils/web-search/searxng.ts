import { Injectable } from '@nestjs/common';
import { SearxngClient, searxng } from '@agentic/searxng';
import { WebSearchRequest, WebSearchResult, BatchWebSearchRequest } from '@refly/openapi-schema';
import { BaseWebSearcher, WebSearchConfig } from './base';

/**
 * SearXNG API implementation of the web searcher
 */
@Injectable()
export class SearXNGWebSearcher extends BaseWebSearcher {
  private readonly client: SearxngClient;

  // Default engines to use if none specified
  private readonly defaultEngines: searxng.SearchEngine[] = [
    'google',
    'brave',
    'bing',
    'duckduckgo',
  ];

  // Default categories to use if none specified
  private readonly defaultCategories: searxng.SearchCategory[] = ['general'];

  constructor(config?: WebSearchConfig) {
    super(config);

    const apiUrl = config?.apiUrl || process.env.SEARXNG_BASE_URL || 'http://localhost:8080/';
    this.client = new SearxngClient({ apiBaseUrl: apiUrl });
  }

  /**
   * Perform web search using SearXNG API.
   *
   * @param req The search request (single or batch)
   * @returns Web search results
   */
  async search(req: WebSearchRequest | BatchWebSearchRequest): Promise<WebSearchResult[]> {
    try {
      const queries: WebSearchRequest[] = 'queries' in req ? req.queries : [req];
      const results: WebSearchResult[] = [];

      // Process each query
      for (const query of queries) {
        if (!query?.q) {
          continue;
        }

        const searchResults = await this.executeSearXNGQuery(query);
        results.push(...searchResults);
      }

      const limit = req?.limit || this.config.defaultLimit;
      return 'queries' in req ? results : results?.slice(0, limit);
    } catch (error) {
      this.logger.error(
        `SearXNG search error: ${error?.stack || error?.message || 'Unknown error'}`,
      );
      return this.defaultFallback(error);
    }
  }

  /**
   * Execute a single SearXNG query
   *
   * @param query The search query request
   * @returns Processed web search results
   */
  private async executeSearXNGQuery(query: WebSearchRequest): Promise<WebSearchResult[]> {
    const { q, limit = this.config.defaultLimit, hl = this.config.defaultLocale } = query;

    // Prepare search options for SearxngClient
    const searchOptions: searxng.SearchOptions = {
      query: q,
      language: hl,
      // Add pagination support - SearxNG defaults to 10 results per page
      // Calculate pageno based on limit
      pageno: Math.ceil(limit / 10) || 1,
      // Use default engines and categories if not specified in config
      engines: this.defaultEngines,
      categories: this.defaultCategories,
    };

    // Use the client to perform the search
    const response = await this.client.search(searchOptions);

    return this.parseSearchResults(response, hl, limit);
  }

  /**
   * Parse search results from SearXNG API
   *
   * @param data The response from SearxngClient search
   * @param locale The locale used for the search
   * @param limit The maximum number of results to return
   * @returns Processed web search results
   */
  private parseSearchResults(
    data: searxng.SearchResponse,
    locale: string,
    limit: number,
  ): WebSearchResult[] {
    const results: WebSearchResult[] = [];

    // Check if results array exists and has items
    if (data?.results?.length > 0) {
      // Process only up to the limit
      const resultsToProcess = data.results.slice(0, limit);

      for (const result of resultsToProcess) {
        // Skip results without required fields
        if (!result?.url || !result?.title) continue;

        // Create a properly typed WebSearchResult object
        const webResult: WebSearchResult = {
          name: result.title,
          url: result.url,
          snippet: result.content || '',
          locale,
        };

        results.push(webResult);
      }
    }

    // Include any search suggestions if there's space
    if (data?.suggestions?.length > 0 && results.length < limit) {
      results.push({
        name: 'Related Searches',
        url: '',
        snippet: data.suggestions.join(', '),
        locale,
      });
    }

    return results;
  }
}
