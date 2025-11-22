import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { RedisService } from '../../common/redis.service';
import { SandboxWrapper, SandboxMetadata } from './scalebox.wrapper';
import { REDIS_KEYS } from './scalebox.constants';

/**
 * Scalebox Storage Layer
 *
 * Encapsulates all Redis operations for sandbox pool management:
 * - Metadata CRUD (sandbox state persistence)
 * - Idle queue operations (FIFO pool management)
 * - Active set operations (concurrency tracking)
 */
@Injectable()
export class ScaleboxStorage {
  constructor(
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScaleboxStorage.name);
  }

  // ==================== Metadata Operations ====================

  async saveMetadata(wrapper: SandboxWrapper): Promise<void> {
    const sandboxId = wrapper.sandboxId;
    const metadata = wrapper.toMetadata();
    const ttlSeconds = Math.floor(wrapper.remainingTime / 1000);

    await this.redis.setJSON(`${REDIS_KEYS.METADATA_PREFIX}:${sandboxId}`, metadata, ttlSeconds);

    this.logger.debug({ sandboxId, ttlSeconds }, 'Saved sandbox metadata');
  }

  async loadMetadata(sandboxId: string): Promise<SandboxMetadata | null> {
    return this.redis.getJSON<SandboxMetadata>(`${REDIS_KEYS.METADATA_PREFIX}:${sandboxId}`);
  }

  async deleteMetadata(sandboxId: string): Promise<void> {
    await this.redis.del(`${REDIS_KEYS.METADATA_PREFIX}:${sandboxId}`);
  }

  // ==================== Idle Queue Operations ====================

  async popFromIdleQueue(): Promise<string | null> {
    return this.redis.getClient().lpop(REDIS_KEYS.IDLE_QUEUE);
  }

  async pushToIdleQueue(sandboxId: string): Promise<void> {
    await this.redis.getClient().rpush(REDIS_KEYS.IDLE_QUEUE, sandboxId);
  }

  // ==================== Active Set Operations ====================

  async addToActiveSet(sandboxId: string): Promise<void> {
    await this.redis.getClient().sadd(REDIS_KEYS.ACTIVE_SET, sandboxId);
  }

  async removeFromActiveSet(sandboxId: string): Promise<void> {
    await this.redis.getClient().srem(REDIS_KEYS.ACTIVE_SET, sandboxId);
  }

  async getActiveCount(): Promise<number> {
    return this.redis.getClient().scard(REDIS_KEYS.ACTIVE_SET);
  }
}
