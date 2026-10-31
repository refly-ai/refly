import { Test, TestingModule } from '@nestjs/testing';
import { CachedWebSearcher, WebSearchCacheConfig } from './cached-searcher';
import { BaseWebSearcher, WebSearchConfig } from './base';
import { RedisService } from '../../modules/common/redis.service';
import { WebSearchRequest, WebSearchResult } from '@refly/openapi-schema';

/**
 * Mock Redis Service for testing
 */
class MockRedisService {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    seconds?: number,
    flag?: string,
  ): Promise<string | null> {
    if (flag === 'NX' && this.store.has(key)) {
      return null;
    }
    this.store.set(key, value);
    return 'OK';
  }

  async eval(
    script: string,
    numKeys: number,
    ...args: string[]
  ): Promise<unknown> {
    const key = args[0];
    const token = args[1];
    const stored = this.store.get(key);
    if (stored === token) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }

  async scan(
    cursor: string,
    ...args: (string | number)[]
  ): Promise<[string, string[]]> {
    const pattern = args[args.indexOf('MATCH') + 1] as string;
    const keys: string[] = [];
    
    for (const [key] of this.store.entries()) {
      if (key.startsWith(pattern.replace('*', ''))) {
        keys.push(key);
      }
    }
    
    return ['0', keys];
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Mock Web Searcher for testing
 */
class MockWebSearcher extends BaseWebSearcher {
  public searchCount = 0;
  private mockResults: WebSearchResult[];

  constructor(
    config?: WebSearchConfig,
    mockResults?: WebSearchResult[],
  ) {
    super(config);
    this.mockResults = mockResults || [
      {
        name: 'Test Result',
        url: 'https://example.com',
        snippet: 'Test snippet',
        locale: 'en',
      },
    ];
  }

  async search(): Promise<WebSearchResult[]> {
    this.searchCount++;
    return this.mockResults;
  }
}

describe('CachedWebSearcher', () => {
  let cachedSearcher: CachedWebSearcher;
  let mockSearcher: MockWebSearcher;
  let mockRedis: MockRedisService;

  beforeEach(() => {
    mockRedis = new MockRedisService();
    mockSearcher = new MockWebSearcher();
    cachedSearcher = new CachedWebSearcher(mockSearcher, mockRedis as any, {
      ttl: 60,
      maxCachedResults: 10,
    });
  });

  afterEach(() => {
    mockRedis.clear();
  });

  describe('Basic Caching', () => {
    it('should fetch from origin on cache miss', async () => {
      const req: WebSearchRequest = { q: 'nestjs tutorial', limit: 5 };
      
      const results = await cachedSearcher.search(req);
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test Result');
      expect(mockSearcher.searchCount).toBe(1);
    });

    it('should return cached results on cache hit', async () => {
      const req: WebSearchRequest = { q: 'nestjs tutorial', limit: 5 };
      
      // First call - cache miss
      await cachedSearcher.search(req);
      expect(mockSearcher.searchCount).toBe(1);
      
      // Second call - cache hit
      const results = await cachedSearcher.search(req);
      expect(results).toHaveLength(1);
      expect(mockSearcher.searchCount).toBe(1); // Should not increment
    });

    it('should generate consistent cache keys for same query', async () => {
      const req1: WebSearchRequest = { q: 'NestJS Tutorial', limit: 5 };
      const req2: WebSearchRequest = { q: 'nestjs tutorial', limit: 5 };
      
      await cachedSearcher.search(req1);
      await cachedSearcher.search(req2);
      
      // Both should hit the same cache (case insensitive normalization)
      expect(mockSearcher.searchCount).toBe(1);
    });
  });

  describe('Cache Key Normalization', () => {
    it('should normalize batch requests consistently', async () => {
      const req = {
        queries: [
          { q: 'query B', limit: 5 },
          { q: 'query A', limit: 5 },
        ],
        limit: 10,
      };
      
      await cachedSearcher.search(req);
      
      // Same queries in different order should hit cache
      const req2 = {
        queries: [
          { q: 'query A', limit: 5 },
          { q: 'query B', limit: 5 },
        ],
        limit: 10,
      };
      
      await cachedSearcher.search(req2);
      expect(mockSearcher.searchCount).toBe(1);
    });
  });

  describe('Cache Configuration', () => {
    it('should respect maxCachedResults limit', async () => {
      mockSearcher = new MockWebSearcher({}, [
        { name: 'Result 1', url: 'https://1.com', snippet: '1', locale: 'en' },
        { name: 'Result 2', url: 'https://2.com', snippet: '2', locale: 'en' },
        { name: 'Result 3', url: 'https://3.com', snippet: '3', locale: 'en' },
      ]);
      
      cachedSearcher = new CachedWebSearcher(mockSearcher, mockRedis as any, {
        ttl: 60,
        maxCachedResults: 2, // Only cache 2 results
      });
      
      const req: WebSearchRequest = { q: 'test', limit: 10 };
      await cachedSearcher.search(req);
      
      // Check cached value
      const keys = Array.from((mockRedis as any).store.keys());
      const cacheKey = keys.find((k: string) => k.startsWith('websearch:'));
      const cached = JSON.parse((mockRedis as any).store.get(cacheKey));
      
      expect(cached).toHaveLength(2);
    });

    it('should not cache empty results when cacheEmptyResults is false', async () => {
      mockSearcher = new MockWebSearcher({}, []);
      
      const req: WebSearchRequest = { q: 'test', limit: 10 };
      await cachedSearcher.search(req);
      
      // Should not have cached anything
      const keys = Array.from((mockRedis as any).store.keys());
      const cacheKeys = keys.filter((k: string) => k.startsWith('websearch:') && !k.includes(':lock'));
      
      expect(cacheKeys).toHaveLength(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache correctly', async () => {
      const req: WebSearchRequest = { q: 'test', limit: 5 };
      
      await cachedSearcher.search(req);
      expect(mockSearcher.searchCount).toBe(1);
      
      await cachedSearcher.invalidateCache(req);
      
      // After invalidation, should fetch from origin again
      await cachedSearcher.search(req);
      expect(mockSearcher.searchCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should fallback to origin on Redis error', async () => {
      // Simulate Redis failure
      mockRedis.get = async () => {
        throw new Error('Redis connection failed');
      };
      
      const req: WebSearchRequest = { q: 'test', limit: 5 };
      const results = await cachedSearcher.search(req);
      
      expect(results).toHaveLength(1);
      expect(mockSearcher.searchCount).toBe(1);
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', async () => {
      const req1: WebSearchRequest = { q: 'query1', limit: 5 };
      const req2: WebSearchRequest = { q: 'query2', limit: 5 };
      
      await cachedSearcher.search(req1);
      await cachedSearcher.search(req2);
      
      const stats = await cachedSearcher.getCacheStats();
      
      expect(stats.totalKeys).toBe(2);
      expect(stats.pattern).toBe('websearch:*');
    });
  });
});