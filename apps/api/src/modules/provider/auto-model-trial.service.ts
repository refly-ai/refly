import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { getAutoModelTrialCount } from '@refly/utils';

/**
 * Result of checking user's auto model trial status
 */
export interface TrialStatus {
  /**
   * Whether the user is in the trial period
   */
  inTrial: boolean;

  /**
   * Current usage count (before this request)
   */
  currentCount: number;
}

/**
 * Service for managing auto model trial for new users.
 * Tracks user's Auto model usage count and determines if they are in trial period.
 *
 * Uses Redis caching for performance with DB fallback for cache misses.
 */
@Injectable()
export class AutoModelTrialService {
  private readonly logger = new Logger(AutoModelTrialService.name);

  /**
   * Redis key prefix for trial counter
   */
  private readonly CACHE_KEY_PREFIX = 'auto-model-trial:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Check if user is in the auto model trial period and update the counter.
   *
   * Flow:
   * 1. Check Redis cache for the counter
   * 2. If cache miss, query DB to get historical count
   * 3. Determine trial status based on count
   * 4. Increment Redis counter (async)
   *
   * @param userId - User ID to check
   * @returns TrialStatus indicating if user is in trial and current count
   */
  async checkAndUpdateTrialStatus(userId: string): Promise<TrialStatus> {
    const trialCount = getAutoModelTrialCount();
    const cacheTtl = 30 * 24 * 60 * 60; // 30 days
    const cacheKey = this.buildCacheKey(userId);

    try {
      // Try to get current count from Redis
      const cachedCount = await this.redis.get(cacheKey);

      let currentCount: number;

      if (cachedCount !== null) {
        // Cache hit - parse the counter value
        currentCount = Number.parseInt(cachedCount, 10);
        if (Number.isNaN(currentCount)) {
          currentCount = 0;
        }
      } else {
        // Cache miss - query DB to get historical count
        currentCount = await this.getCountFromDatabase(userId, trialCount);

        // Initialize Redis cache with DB count
        await this.redis.setex(cacheKey, cacheTtl, String(currentCount));
      }

      // Determine if user is in trial period (count < threshold)
      const inTrial = currentCount < trialCount;

      // Increment counter asynchronously (fire and forget)
      this.incrementCounterAsync(cacheKey, cacheTtl);

      return { inTrial, currentCount };
    } catch (error) {
      this.logger.warn(`Failed to check trial status for user ${userId}`, error);
      // On error, default to not in trial to avoid blocking
      return { inTrial: false, currentCount: 0 };
    }
  }

  /**
   * Get count from database with optimized query.
   * Uses findMany with take limit instead of count(*) for performance.
   *
   * @param userId - User ID
   * @param trialCount - Trial threshold (e.g., 20)
   * @returns Number of routing results found (capped at trialCount + 1)
   */
  private async getCountFromDatabase(userId: string, trialCount: number): Promise<number> {
    try {
      // Query at most (trialCount + 1) records to determine if trial is over
      // This uses the (userId, createdAt) index and limits scan to constant rows
      const results = await this.prisma.autoModelRoutingResult.findMany({
        where: { userId },
        take: trialCount + 1,
        select: { pk: true },
        orderBy: { createdAt: 'asc' },
      });

      return results.length;
    } catch (error) {
      this.logger.warn(`Failed to get trial count from DB for user ${userId}`, error);
      return 0;
    }
  }

  /**
   * Increment the trial counter in Redis asynchronously.
   * Uses INCR + EXPIRE to update counter and refresh TTL.
   *
   * @param cacheKey - Redis key
   * @param ttlSeconds - TTL in seconds
   */
  private incrementCounterAsync(cacheKey: string, ttlSeconds: number): void {
    // Fire and forget - don't await
    this.redis
      .incr(cacheKey)
      .then(async (newValue) => {
        // Refresh TTL after increment
        await this.redis.expire(cacheKey, ttlSeconds);
        return newValue;
      })
      .catch((error) => {
        this.logger.warn(`Failed to increment trial counter: ${cacheKey}`, error);
      });
  }

  /**
   * Build Redis cache key for user's trial counter
   */
  private buildCacheKey(userId: string): string {
    return `${this.CACHE_KEY_PREFIX}${userId}`;
  }
}
