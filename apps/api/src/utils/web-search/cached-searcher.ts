import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  WebSearchRequest,
  WebSearchResult,
  BatchWebSearchRequest,
} from '@refly/openapi-schema';
import { RedisService } from '../../modules/common/redis.service';
import { BaseWebSearcher, WebSearchConfig } from './base';

/**
 * Cache configuration interface
 */
export interface WebSearchCacheConfig {
  /** Cache TTL in seconds (default: 3600 = 1 hour) */
  ttl?: number;
  /** Maximum number of cached results to store per query (default: 100) */
  maxCachedResults?: number;
  /** Whether to cache empty results (default: false) */
  cacheEmptyResults?: boolean;
  /** Cache key prefix (default: 'websearch') */
  keyPrefix?: string;
}

/**
 * Decorator/Wrapper that adds Redis caching capabilities to any WebSearcher implementation.
 * 
 * This implements the Cache-Aside pattern with the following features:
 * - Automatic cache key generation based on query content
 * - Configurable TTL for cache expiration
 * - Cache stampede protection using Redis SET NX
 * - Fallback to origin searcher on cache miss or Redis failure
 * 
 * @example
 * ```typescript
 * const searcher = new CachedWebSearcher(
 *   new SearXNGWebSearcher(config),
 *   redisService,
 *   { ttl: 1800, maxCachedResults: 50 }
 * );
 * ```
 */
@Injectable()
export class CachedWebSearcher extends BaseWebSearcher {
  private readonly logger = new Logger(CachedWebSearcher.name);
  private readonly cacheConfig: Required<WebSearchCacheConfig>;

  constructor(
    private readonly originSearcher: BaseWebSearcher,
    private readonly redisService: RedisService,
    cacheConfig?: WebSearchCacheConfig,
  ) {
    super(originSearcher['config']);
    
    this.cacheConfig = {
      ttl: 3600, // 1 hour default
      maxCachedResults: 100,
      cacheEmptyResults: false,
      keyPrefix: 'websearch',
      ...cacheConfig,
    };
  }

  /**
   * Perform web search with caching support.
   * 
   * Algorithm:
   * 1. Generate cache key from request
   * 2. Try to get from cache (cache hit → return cached results)
   * 3. On cache miss:
   *    - Check if another process is fetching (cache stampede protection)
   *    - If yes, wait and retry
   *    - If no, acquire lock, fetch from origin, store in cache, release lock
   * 4. On any error, fallback to origin searcher
   */
  async search(req: WebSearchRequest | BatchWebSearchRequest): Promise<WebSearchResult[]> {
    const cacheKey = this.generateCacheKey(req);
    
    try {
      // Try to get from cache
      const cached = await this.getFromCache(cacheKey);
      if (cached !== null) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return cached;
      }

      // Cache miss - check for stampede
      const lockKey = `${cacheKey}:lock`;
      const lockToken = this.generateLockToken();
      
      // Try to acquire lock (prevents cache stampede)
      const lockAcquired = await this.acquireLock(lockKey, lockToken);
      
      if (!lockAcquired) {
        // Another process is fetching, wait and retry from cache
        this.logger.debug(`Cache stampede detected for key: ${cacheKey}, waiting...`);
        await this.sleep(100); // Wait 100ms
        return this.search(req); // Retry
      }

      try {
        // Fetch from origin searcher
        this.logger.debug(`Cache miss for key: ${cacheKey}, fetching from origin`);
        const results = await this.originSearcher.search(req);

        // Store in cache (async, don't block response)
        if (this.shouldCacheResults(results)) {
          this.storeInCache(cacheKey, results).catch((err) => {
            this.logger.warn(`Failed to store in cache: ${err.message}`);
          });
        }

        return results;
      } finally {
        // Release lock
        await this.releaseLock(lockKey, lockToken);
      }
    } catch (error) {
      // On any cache error, fallback to origin
      this.logger.warn(
        `Cache operation failed for key ${cacheKey}: ${error?.message}, falling back to origin`,
      );
      return this.originSearcher.search(req);
    }
  }

  /**
   * Generate deterministic cache key from request
   * Uses SHA256 hash of normalized request parameters
   */
  private generateCacheKey(req: WebSearchRequest | BatchWebSearchRequest): string {
    const normalized = this.normalizeRequest(req);
    const hash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    return `${this.cacheConfig.keyPrefix}:${hash}`;
  }

  /**
   * Normalize request for consistent cache key generation
   */
  private normalizeRequest(
    req: WebSearchRequest | BatchWebSearchRequest,
  ): Record<string, unknown> {
    if ('queries' in req && Array.isArray(req.queries)) {
      // Batch request - sort queries for consistency
      return {
        type: 'batch',
        queries: req.queries
          .map((q) => ({ q: q.q?.toLowerCase().trim(), hl: q.hl, limit: q.limit }))
          .sort((a, b) => (a.q || '').localeCompare(b.q || '')),
        limit: req.limit,
      };
    }
    
    // Single request
    return {
      type: 'single',
      q: (req as WebSearchRequest).q?.toLowerCase().trim(),
      hl: (req as WebSearchRequest).hl,
      limit: (req as WebSearchRequest).limit,
    };
  }

  /**
   * Try to get results from cache
   * @returns Cached results or null if not found/expired
   */
  private async getFromCache(key: string): Promise<WebSearchResult[] | null> {
    const cached = await this.redisService.get(key);
    if (!cached) {
      return null;
    }

    try {
      const parsed = JSON.parse(cached) as WebSearchResult[];
      
      // Validate cached data structure
      if (Array.isArray(parsed)) {
        return parsed;
      }
      
      this.logger.warn(`Invalid cache data structure for key: ${key}`);
      return null;
    } catch (error) {
      this.logger.warn(`Failed to parse cached data for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Store results in cache with TTL
   */
  private async storeInCache(key: string, results: WebSearchResult[]): Promise<void> {
    const trimmedResults = results.slice(0, this.cacheConfig.maxCachedResults);
    const serialized = JSON.stringify(trimmedResults);
    
    await this.redisService.setex(key, this.cacheConfig.ttl, serialized);
    this.logger.debug(`Stored ${trimmedResults.length} results in cache for key: ${key}`);
  }

  /**
   * Check if results should be cached
   */
  private shouldCacheResults(results: WebSearchResult[]): boolean {
    if (results.length === 0) {
      return this.cacheConfig.cacheEmptyResults;
    }
    return true;
  }

  /**
   * Acquire distributed lock for cache stampede protection
   * Uses Redis SET NX (set if not exists) with expiration
   */
  private async acquireLock(lockKey: string, token: string): Promise<boolean> {
    try {
      // SET key value NX EX seconds
      // NX = only set if not exists
      // EX = expiration time in seconds (10 seconds for lock)
      const result = await this.redisService.set(lockKey, token, 'EX', 10, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(`Failed to acquire lock ${lockKey}: ${error.message}`);
      // On lock error, allow proceeding (degrades to no stampede protection)
      return true;
    }
  }

  /**
   * Release distributed lock
   * Only releases if token matches (prevents releasing another process's lock)
   */
  private async releaseLock(lockKey: string, token: string): Promise<void> {
    try {
      // Use Redis Lua script for atomic check-and-delete
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redisService.eval(script, 1, lockKey, token);
    } catch (error) {
      // Lock will auto-expire after 10s, so this is not critical
      this.logger.debug(`Failed to release lock ${lockKey}: ${error.message}`);
    }
  }

  /**
   * Generate unique lock token
   */
  private generateLockToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Sleep utility for async delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manually invalidate cache for a specific query
   * Useful for cache warming or cache invalidation scenarios
   */
  async invalidateCache(req: WebSearchRequest | BatchWebSearchRequest): Promise<void> {
    const cacheKey = this.generateCacheKey(req);
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(`Invalidated cache for key: ${cacheKey}`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache for key ${cacheKey}: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   * Returns approximate number of cached search queries
   */
  async getCacheStats(): Promise<{ totalKeys: number; pattern: string }> {
    try {
      const pattern = `${this.cacheConfig.keyPrefix}:*`;
      // Note: This uses Redis SCAN, may not be 100% accurate for large datasets
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await this.redisService.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      return {
        totalKeys: keys.length,
        pattern,
      };
    } catch (error) {
      this.logger.warn(`Failed to get cache stats: ${error.message}`);
      return { totalKeys: -1, pattern: `${this.cacheConfig.keyPrefix}:*` };
    }
  }
}