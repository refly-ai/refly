import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { isDesktop } from '../../utils/runtime';
import { safeParseJSON, runModuleInitWithTimeoutAndRetry } from '@refly/utils';
import { OperationTooFrequent } from '@refly/errors';

interface InMemoryItem {
  value: string;
  expiresAt: number | null;
}

export type LockReleaseFn = () => Promise<boolean>;

/**
 * Metadata for tracking active lock renewal timers
 */
interface LockTimerInfo {
  timer: NodeJS.Timeout;
  maxLifetimeTimer: NodeJS.Timeout | null;
  key: string;
  token: string;
  createdAt: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout
  // Default maximum lifetime for lock renewal timers (5 minutes)
  private readonly DEFAULT_MAX_LOCK_LIFETIME_SECONDS = 300;

  private client: Redis | null = null;
  private inMemoryStore: Map<string, InMemoryItem> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  // Track active lock renewal timers to prevent resource leaks
  private activeLockTimers: Map<string, LockTimerInfo> = new Map();

  constructor(private configService: ConfigService) {
    if (!isDesktop()) {
      this.logger.log('Initializing Redis client');

      if (configService.get('redis.url')) {
        this.client = new Redis(configService.get('redis.url'), {
          maxRetriesPerRequest: null, // Required for BullMQ blocking commands
        });
      } else {
        this.client = new Redis({
          host: configService.getOrThrow('redis.host'),
          port: configService.getOrThrow('redis.port'),
          username: configService.get('redis.username'),
          password: configService.get('redis.password'),
          tls: configService.get<boolean>('redis.tls') ? {} : undefined,
          maxRetriesPerRequest: null, // Required for BullMQ blocking commands
        });
      }

      // Add event listeners for debugging
      this.client.on('connect', () => {
        this.logger.log('Redis client connected');
      });

      this.client.on('ready', () => {
        this.logger.log('Redis client ready');
      });

      this.client.on('error', (err) => {
        this.logger.error(`Redis client error: ${err.message}`, err.stack);
      });

      this.client.on('close', () => {
        this.logger.warn('Redis client connection closed');
      });

      this.client.on('reconnecting', (delay) => {
        this.logger.warn(`Redis client reconnecting in ${delay}ms`);
      });

      this.client.on('end', () => {
        this.logger.warn('Redis client connection ended');
      });
    } else {
      this.logger.log('Skip redis initialization in desktop mode');
      this.initInMemoryCleanup();
    }
  }

  private initInMemoryCleanup(): void {
    // Clean up expired items every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredItems();
    }, 30000);
  }

  private cleanupExpiredItems(): void {
    const now = Date.now();
    for (const [key, item] of this.inMemoryStore.entries()) {
      if (item.expiresAt <= now) {
        this.inMemoryStore.delete(key);
      }
    }
  }

  private isExpired(item: InMemoryItem): boolean {
    return item.expiresAt <= Date.now();
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client is not initialized yet');
    }
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    if (isDesktop() || !this.client) {
      this.logger.log('Skip redis initialization in desktop mode');
      return;
    }

    await runModuleInitWithTimeoutAndRetry(
      async () => {
        await this.client?.ping();
        this.logger.log('Redis connection established');
      },
      {
        logger: this.logger,
        label: 'RedisService.onModuleInit',
        timeoutMs: this.INIT_TIMEOUT,
      },
    );
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.setex(key, seconds, value);
      } catch (error) {
        this.logger.error(`Redis SETEX failed: key=${key}, error=${error}`);
        throw error;
      }
      return;
    }

    // In-memory implementation
    const expiresAt = Date.now() + seconds * 1000;
    this.inMemoryStore.set(key, { value, expiresAt });
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch (error) {
        this.logger.error(`Redis GET failed: key=${key}, error=${error}`);
        throw error;
      }
    }

    // In-memory implementation
    const item = this.inMemoryStore.get(key);
    if (!item) {
      return null;
    }

    if (this.isExpired(item)) {
      this.inMemoryStore.delete(key);
      return null;
    }

    return item.value;
  }

  async incr(key: string): Promise<number> {
    if (this.client) {
      try {
        return await this.client.incr(key);
      } catch (error) {
        this.logger.error(`Redis INCR failed: key=${key}, error=${error}`);
        throw error;
      }
    }

    // In-memory implementation
    const item = this.inMemoryStore.get(key);
    let currentValue = 0;

    if (item && !this.isExpired(item)) {
      currentValue = Number.parseInt(item.value, 10) || 0;
    }

    const newValue = currentValue + 1;
    const expiresAt = item?.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000; // Default 24h expiry if not set
    this.inMemoryStore.set(key, { value: newValue.toString(), expiresAt });

    return newValue;
  }

  async decr(key: string): Promise<number> {
    if (this.client) {
      try {
        return await this.client.decr(key);
      } catch (error) {
        this.logger.error(`Redis DECR failed: key=${key}, error=${error}`);
        throw error;
      }
    }

    // In-memory implementation
    const item = this.inMemoryStore.get(key);
    let currentValue = 0;

    if (item && !this.isExpired(item)) {
      currentValue = Number.parseInt(item.value, 10) || 0;
    }

    const newValue = Math.max(0, currentValue - 1);
    const expiresAt = item?.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000; // Default 24h expiry if not set
    this.inMemoryStore.set(key, { value: newValue.toString(), expiresAt });

    return newValue;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (this.client) {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    }

    // In-memory implementation
    const item = this.inMemoryStore.get(key);
    if (!item) {
      return false;
    }

    item.expiresAt = Date.now() + seconds * 1000;
    return true;
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(key);
      return;
    }
    this.inMemoryStore.delete(key);
  }

  async exists(key: string): Promise<number> {
    if (this.client) {
      try {
        return await this.client.exists(key);
      } catch (error) {
        this.logger.error(`Redis EXISTS failed: key=${key}, error=${error}`);
        throw error;
      }
    }

    // In-memory implementation
    const item = this.inMemoryStore.get(key);
    if (!item || this.isExpired(item)) {
      if (item && this.isExpired(item)) {
        this.inMemoryStore.delete(key);
      }
      return 0;
    }
    return 1;
  }

  /**
   * Store a JSON-serializable value in Redis with a TTL
   * @param key - Redis key
   * @param value - Value to store (will be JSON serialized)
   * @param ttlSeconds - Time to live in seconds (default: 180 seconds)
   */
  async setJSON<T>(key: string, value: T, ttlSeconds = 180): Promise<void> {
    try {
      // Use custom replacer to handle BigInt serialization
      const serialized = JSON.stringify(value, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
      await this.setex(key, ttlSeconds, serialized);
    } catch (error) {
      this.logger.warn(
        `Failed to write JSON to Redis for key "${key}": ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Retrieve a JSON-serialized value from Redis
   * @param key - Redis key
   * @returns The parsed value or null if not found or invalid
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const serialized = await this.get(key);
    if (!serialized) {
      return null;
    }

    try {
      // Note: BigInt values are stored as strings and remain as strings after parsing
      // This is generally safe as BigInt fields (like 'pk') are rarely used in business logic
      // If BigInt restoration is needed, implement a custom reviver function
      return safeParseJSON(serialized) as T;
    } catch (error) {
      this.logger.warn(`Failed to parse JSON from Redis for key "${key}"`, error);
      return null;
    }
  }

  /**
   * Delete multiple keys from Redis
   * @param keys - Array of Redis keys
   */
  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    try {
      await Promise.all(keys.map((key) => this.del(key)));
    } catch (error) {
      this.logger.warn('Failed to delete multiple keys from Redis', error);
    }
  }

  /**
   * Check if a key exists in Redis (returns boolean)
   * @param key - Redis key
   * @returns true if the key exists, false otherwise
   */
  async existsBoolean(key: string): Promise<boolean> {
    try {
      const result = await this.exists(key);
      return result > 0;
    } catch (error) {
      this.logger.warn(`Failed to check existence of key "${key}" in Redis`, error);
      return false;
    }
  }

  /**
   * Atomically increment counter and set expiry only if key is new (returns 1)
   * @param key - Redis key
   * @param expireSeconds - Expiry time in seconds
   * @returns The new counter value
   */
  async incrementWithExpire(key: string, expireSeconds: number): Promise<number> {
    if (this.client) {
      // Use Lua script for atomic operation
      const script = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        return count
      `;
      return this.client.eval(script, 1, key, expireSeconds) as unknown as number;
    }

    // In-memory implementation (not truly atomic but close enough for desktop mode)
    const item = this.inMemoryStore.get(key);
    const isValid = !!item && !this.isExpired(item);
    const currentValue = isValid ? Number.parseInt(item!.value, 10) || 0 : 0;
    const newValue = currentValue + 1;
    const expiresAt = isValid ? item!.expiresAt : Date.now() + 24 * 60 * 60 * 1000; // reset TTL when missing/expired
    if (item && !isValid) {
      // drop stale entry to avoid lingering expired records
      this.inMemoryStore.delete(key);
    }
    this.inMemoryStore.set(key, { value: String(newValue), expiresAt });

    return newValue;
  }

  /**
   * Extend the TTL of an existing lock
   * @param key - Lock key
   * @param token - Lock token for verification
   * @param ttlSeconds - New TTL in seconds
   * @returns true if extended successfully, false otherwise
   */
  private async extendLock(key: string, token: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) {
      return true;
    }

    try {
      // Only extend if the lock is still held by this token
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const success = await this.client.eval(script, 1, key, token, ttlSeconds);
      if (success === 1) {
        this.logger.debug(`Lock extended: key=${key}, token=${token}, ttl=${ttlSeconds}s`);
        return true;
      }
      this.logger.warn(`Failed to extend lock (token mismatch or lock lost): key=${key}`);
      return false;
    } catch (err) {
      this.logger.warn(`Error extending lock: key=${key}, error=${err}`);
      return false;
    }
  }

  /**
   * Acquire a distributed lock with automatic renewal.
   *
   * **IMPORTANT**: Callers MUST always invoke the returned release function when done,
   * preferably in a try/finally block to ensure cleanup even on exceptions:
   *
   * ```typescript
   * const release = await redisService.acquireLock('my-lock');
   * if (!release) {
   *   // Lock not acquired
   *   return;
   * }
   * try {
   *   // Do work while holding the lock
   * } finally {
   *   await release();
   * }
   * ```
   *
   * @param key - The lock key
   * @param ttlSeconds - Lock TTL in seconds (default: 10). The lock auto-renews at half this interval.
   * @param maxLifetimeSeconds - Maximum lifetime for the renewal timer in seconds (default: 300).
   *                             After this time, the renewal timer stops automatically to prevent
   *                             indefinite resource usage. Set to 0 for no limit (use with caution).
   * @returns A release function if lock acquired, null otherwise
   */
  async acquireLock(
    key: string,
    ttlSeconds = 10,
    maxLifetimeSeconds = this.DEFAULT_MAX_LOCK_LIFETIME_SECONDS,
  ): Promise<LockReleaseFn | null> {
    if (!this.client) {
      return async () => true;
    }

    try {
      const token = `${process.pid}-${Date.now()}`;
      const success = await this.client.set(key, token, 'EX', ttlSeconds, 'NX');

      if (success) {
        this.logger.log(`Lock acquired: key=${key}, token=${token}, ttl=${ttlSeconds}s`);

        const timerKey = `${key}:${token}`;
        const createdAt = Date.now();

        // Helper to clean up timers and tracking
        const cleanupTimers = () => {
          const timerInfo = this.activeLockTimers.get(timerKey);
          if (timerInfo) {
            clearInterval(timerInfo.timer);
            if (timerInfo.maxLifetimeTimer) {
              clearTimeout(timerInfo.maxLifetimeTimer);
            }
            this.activeLockTimers.delete(timerKey);
          }
        };

        // Start auto-renewal timer: renew at 1/2 of TTL interval
        const renewalInterval = (ttlSeconds * 1000) / 2;
        const renewalTimer = setInterval(() => {
          (async () => {
            try {
              const extended = await this.extendLock(key, token, ttlSeconds);
              if (!extended) {
                // If extension failed, clean up as we no longer hold the lock
                cleanupTimers();
                this.logger.warn(
                  `Lock auto-renewal failed and timer cleared: key=${key}, token=${token}`,
                );
              }
            } catch (err) {
              // Catch any unexpected errors from extendLock to prevent unhandled promise rejection
              this.logger.error(
                `Unexpected error during lock auto-renewal: key=${key}, token=${token}, error=${err}`,
              );
              // Conservatively clear the timer on error to avoid leaving a running timer
              // when we may no longer hold the lock
              cleanupTimers();
            }
          })();
        }, renewalInterval);

        // Set up maximum lifetime timer to prevent indefinite execution
        let maxLifetimeTimer: NodeJS.Timeout | null = null;
        if (maxLifetimeSeconds > 0) {
          maxLifetimeTimer = setTimeout(async () => {
            this.logger.warn(
              `Lock renewal timer reached maximum lifetime (${maxLifetimeSeconds}s), ` +
                `stopping auto-renewal: key=${key}, token=${token}`,
            );
            cleanupTimers();
            // Note: The lock itself will expire naturally in Redis after TTL
            // The caller should have released the lock long before this point
          }, maxLifetimeSeconds * 1000);
        }

        // Track this timer for cleanup in onModuleDestroy
        this.activeLockTimers.set(timerKey, {
          timer: renewalTimer,
          maxLifetimeTimer,
          key,
          token,
          createdAt,
        });

        // Return a release function that clears the timers and releases the lock
        return async () => {
          cleanupTimers();
          return await this.releaseLock(key, token);
        };
      }
      this.logger.log(`Failed to acquire lock: key=${key} (already held by another process)`);
      return null;
    } catch (err) {
      this.logger.warn(`Error acquiring lock: key=${key}, error=${err}`);
      return null;
    }
  }

  /**
   * Wait and retry to acquire a distributed lock.
   *
   * **IMPORTANT**: Callers MUST always invoke the returned release function when done,
   * preferably in a try/finally block to ensure cleanup even on exceptions.
   *
   * @param key - The lock key
   * @param options - Lock acquisition options
   * @param options.maxRetries - Maximum number of retry attempts (default: 15)
   * @param options.initialDelay - Initial delay between retries in ms (default: 100)
   * @param options.noThrow - If true, returns null instead of throwing on failure (default: false)
   * @param options.ttlSeconds - Lock TTL in seconds (default: 10)
   * @param options.maxLifetimeSeconds - Maximum lifetime for renewal timer in seconds (default: 300)
   * @returns A release function if lock acquired, null if noThrow=true and failed
   * @throws OperationTooFrequent if lock cannot be acquired and noThrow=false
   */
  async waitLock(
    key: string,
    options?: {
      maxRetries?: number;
      initialDelay?: number;
      noThrow?: boolean;
      ttlSeconds?: number;
      maxLifetimeSeconds?: number;
    },
  ): Promise<LockReleaseFn | null> {
    const {
      maxRetries = 15,
      initialDelay = 100,
      noThrow = false,
      ttlSeconds = 10,
      maxLifetimeSeconds = this.DEFAULT_MAX_LOCK_LIFETIME_SECONDS,
    } = options ?? {};
    let retries = 0;
    let delay = initialDelay;
    const startTime = Date.now();

    while (true) {
      const releaseLock = await this.acquireLock(key, ttlSeconds, maxLifetimeSeconds);
      if (releaseLock) {
        const waitTime = Date.now() - startTime;
        this.logger.debug(
          `Lock acquired after ${retries} retries and ${waitTime}ms wait: key=${key}`,
        );
        return releaseLock;
      }
      if (retries >= maxRetries) {
        const totalWaitTime = Date.now() - startTime;
        this.logger.warn(
          `Failed to acquire lock after ${retries} retries and ${totalWaitTime}ms wait: key=${key}`,
        );
        if (noThrow) {
          return null;
        }
        throw new OperationTooFrequent(
          `Failed to get lock for key ${key} after ${retries} retries (waited ${totalWaitTime}ms)`,
        );
      }
      // Exponential backoff before next retry, with max delay cap of 2000ms
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 2000);
      retries += 1;
    }
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    if (!this.client) {
      return true;
    }

    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const success = await this.client.eval(script, 1, key, token);

      if (success === 1) {
        this.logger.debug(`Lock released: key=${key}, token=${token}`);
        return true;
      }
      this.logger.warn(
        `Failed to release lock (token mismatch or already released): key=${key}, token=${token}`,
      );
      return false;
    } catch (err) {
      this.logger.error(`Error releasing lock: key=${key}, error=${err}`);
      throw new Error(`Error releasing lock: key=${key} - ${err}`);
    }
  }

  async onModuleDestroy() {
    // Clear in-memory store cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all active lock renewal timers to prevent resource leaks
    if (this.activeLockTimers.size > 0) {
      this.logger.log(`Clearing ${this.activeLockTimers.size} active lock renewal timer(s)`);
      for (const timerInfo of this.activeLockTimers.values()) {
        clearInterval(timerInfo.timer);
        if (timerInfo.maxLifetimeTimer) {
          clearTimeout(timerInfo.maxLifetimeTimer);
        }
        this.logger.debug(
          `Cleared lock timer on shutdown: key=${timerInfo.key}, token=${timerInfo.token}, ` +
            `age=${Date.now() - timerInfo.createdAt}ms`,
        );
      }
      this.activeLockTimers.clear();
    }

    if (this.client) {
      await this.client.quit();
    }
  }
}
