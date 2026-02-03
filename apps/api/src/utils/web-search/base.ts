import { Logger } from '@nestjs/common';
import { WebSearchRequest, WebSearchResult, BatchWebSearchRequest } from '@refly/openapi-schema';

/**
 * Web searcher configuration interface
 */
export interface WebSearchConfig {
  /** API credentials */
  apiKey?: string;

  /** API URL */
  apiUrl?: string;

  /** Default number of results to return */
  defaultLimit?: number;

  /** Default locale/language for search */
  defaultLocale?: string;

  /** Default country/region code */
  defaultCountry?: string;

  /** Default location string */
  defaultLocation?: string;
}

/**
 * Base abstract class for web search services
 */
export abstract class BaseWebSearcher {
  protected logger: Logger;
  protected config: Partial<WebSearchConfig>;

  constructor(config?: Partial<WebSearchConfig>) {
    this.logger = new Logger(this.constructor.name);
    this.config = {
      defaultLimit: 10,
      defaultLocale: 'en',
      defaultCountry: 'us',
      defaultLocation: 'United States',
      ...config,
    };
  }

  /**
   * Perform web search based on the request
   *
   * @param user The user performing the search
   * @param req The search request (single or batch)
   * @returns Web search results
   */
  abstract search(req: WebSearchRequest | BatchWebSearchRequest): Promise<WebSearchResult[]>;

  /**
   * Fallback method when search fails
   *
   * @returns Empty results with error information
   */
  protected defaultFallback(error: any): WebSearchResult[] {
    this.logger.error(`Web search failed: ${error?.message || 'Unknown error'}`);
    throw error;
  }
}
