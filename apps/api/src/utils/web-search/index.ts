/**
 * Web Search Utilities
 * 
 * This module provides web search capabilities with caching support.
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const searcher = new SearXNGWebSearcher({ apiUrl: 'http://localhost:8080' });
 * const results = await searcher.search({ q: 'nestjs tutorial', limit: 10 });
 * 
 * // With caching
 * const cachedSearcher = new CachedWebSearcher(
 *   new SearXNGWebSearcher(config),
 *   redisService,
 *   { ttl: 3600 }
 * );
 * const results = await cachedSearcher.search({ q: 'nestjs tutorial' });
 * ```
 */

export { BaseWebSearcher, WebSearchConfig } from './base';
export { SearXNGWebSearcher } from './searxng';
export { SerperWebSearcher } from './serper';
export { 
  CachedWebSearcher, 
  WebSearchCacheConfig 
} from './cached-searcher';
