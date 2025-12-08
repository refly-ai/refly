import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { isDesktop } from '../../utils/runtime';
import { safeParseJSON } from '@refly/utils';
import { OperationTooFrequent } from '@refly/errors';

interface InMemoryItem {
  value: string;
  expiresAt: number;
}

export type LockReleaseFn = () => Promise<boolean>;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  private client: Redis | null = null;
  private inMemoryStore: Map<string, InMemoryItem> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    if (!isDesktop()) {
      this.logger.log('Initializing Redis client');

      if (configService.get('redis.url')) {
        this.client = new Redis(configService.get('redis.url'));
      } else {
        this.client = new Redis({
          host: configService.getOrThrow('redis.host'),
          port: configService.getOrThrow('redis.port'),
          username: configService.get('redis.username'),
          password: configService.get('redis.password'),
          tls: configService.get<boolean>('redis.tls') ? {} : undefined,
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

  private initInMemoryCleanup() {
    // Clean up expired items every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredItems();
    }, 30000);
  }

  private cleanupExpiredItems() {
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

  getClient() {
    return this.client;
  }

  async onModuleInit() {
    if (isDesktop() || !this.client) {
      this.logger.log('Skip redis initialization in desktop mode');
      return;
    }

    const initPromise = this.client.ping();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(`Redis connection timed out after ${this.INIT_TIMEOUT}ms`);
      }, this.INIT_TIMEOUT);
    });

    try {
      await Promise.race([initPromise, timeoutPromise]);
      this.logger.log('Redis connection established');
    } catch (error) {
      this.logger.error(`Failed to establish Redis connection: ${error}`);
      throw error;
    }
  }

  async setex(key: string, seconds: number, value: string) {
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

  async get(key: string) {
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

  async acquireLock(key: string, ttlSeconds = 10): Promise<LockReleaseFn | null> {
    if (!this.client) {
      return async () => true;
    }

    try {
      const token = `${process.pid}-${Date.now()}`;
      const success = await this.client.set(key, token, 'EX', ttlSeconds, 'NX');

      if (success) {
        return async () => await this.releaseLock(key, token);
      }
      return null;
    } catch (err) {
      this.logger.warn('Error acquiring lock:', err);
      return null;
    }
  }

  async waitLock(
    key: string,
    options?: { maxRetries?: number; initialDelay?: number; noThrow?: boolean },
  ) {
    const { maxRetries = 3, initialDelay = 100, noThrow = false } = options ?? {};
    let retries = 0;
    let delay = initialDelay;
    while (true) {
      const releaseLock = await this.acquireLock(key);
      if (releaseLock) {
        return releaseLock;
      }
      if (retries >= maxRetries) {
        if (noThrow) {
          return null;
        }
        throw new OperationTooFrequent('Failed to get lock for canvas');
      }
      // Exponential backoff before next retry
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
      retries += 1;
    }
  }

  async releaseLock(key: string, token: string) {
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
        return true;
      }
      return false;
    } catch (err) {
      this.logger.error('Error releasing lock:', err);
      throw false;
    }
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.client) {
      await this.client.quit();
    }
  }
}
