import { isDesktop } from '../../utils/runtime';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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
      this.client = new Redis({
        host: configService.getOrThrow('redis.host'),
        port: configService.getOrThrow('redis.port'),
        username: configService.get('redis.username'),
        password: configService.get('redis.password'),
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
      await this.client.setex(key, seconds, value);
      return;
    }

    // In-memory implementation
    const expiresAt = Date.now() + seconds * 1000;
    this.inMemoryStore.set(key, { value, expiresAt });
  }

  async get(key: string) {
    if (this.client) {
      return this.client.get(key);
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
      return this.client.incr(key);
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

  async acquireLock(key: string): Promise<LockReleaseFn | null> {
    if (!this.client) {
      return async () => true;
    }

    try {
      const token = `${process.pid}-${Date.now()}`;
      const success = await this.client.set(key, token, 'EX', 10, 'NX');

      if (success) {
        return async () => await this.releaseLock(key, token);
      }
      return null;
    } catch (err) {
      this.logger.warn('Error acquiring lock:', err);
      return null;
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
