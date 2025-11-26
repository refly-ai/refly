import { Injectable, Logger } from '@nestjs/common';
import { ActionStep } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

const DEFAULT_TTL_SECONDS = 60 * 3;

/**
 * Service for managing steps of action results
 * Implements cache-first strategy: tries cache first, falls back to database
 */
@Injectable()
export class StepService {
  private readonly logger = new Logger(StepService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  buildCacheKey(resultId: string, version: number): string {
    return `skill:steps:${resultId}:${version}`;
  }

  /**
   * Set steps cache to Redis
   */
  async setStepsCache(
    resultId: string,
    version: number,
    steps: Record<string, ActionStep>,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(resultId, version);
    await this.redisService.setJSON(cacheKey, steps, ttlSeconds);
  }

  /**
   * Get steps with cache-first strategy
   * 1. Try to get from Redis cache
   * 2. If cache miss, fetch from database
   * 3. Cache the DB results for future requests
   */
  async getSteps(resultId: string, version: number): Promise<ActionStep[] | null> {
    // Try cache first
    const cacheKey = this.buildCacheKey(resultId, version);
    const cached = await this.redisService.getJSON<Record<string, ActionStep>>(cacheKey);

    if (cached && Object.keys(cached).length > 0) {
      // Convert Record to Array, sorted by step name
      const sortedSteps = Object.values(cached).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return sortedSteps;
    }

    const stepsFromDb = await this.prisma.actionStep.findMany({
      where: {
        resultId,
        version,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!stepsFromDb || stepsFromDb.length === 0) {
      return null;
    }

    // Convert array to Record<string, ActionStep> format for caching (using step name as key)
    const stepsMap: Record<string, ActionStep> = {};
    for (const step of stepsFromDb) {
      stepsMap[step.name] = step;
    }

    // Cache the DB results for future requests
    await this.setStepsCache(resultId, version, stepsMap);
    return stepsFromDb;
  }

  /**
   * Clear steps cache
   */
  async clearCache(resultId: string, version: number): Promise<void> {
    const cacheKey = this.buildCacheKey(resultId, version);
    await this.redisService.del(cacheKey);
  }
  /**
   * Alias for setStepsCache (backward compatibility with result.ts)
   * Accepts any snapshot structure for backward compatibility
   */
  async setCache<T = any>(
    cacheKey: string,
    object: T,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redisService.setJSON(cacheKey, object, ttlSeconds);
  }
}
