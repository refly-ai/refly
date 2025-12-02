import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { RedisService } from '../../common/redis.service';
import { Config } from '../../config/config.decorator';
import { ISandboxWrapper, SandboxMetadata } from './wrapper/base';
import { REDIS_KEYS, SCALEBOX_DEFAULTS } from './scalebox.constants';

/**
 * Scalebox Storage Layer
 *
 * Encapsulates all Redis operations for sandbox pool management:
 * - Metadata CRUD (sandbox state persistence)
 * - Idle queue operations (FIFO pool management)
 */
@Injectable()
export class ScaleboxStorage {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScaleboxStorage.name);
    void this.config; // Suppress unused warning - used by @Config decorators
  }

  @Config.integer('sandbox.scalebox.sandboxTimeoutMs', SCALEBOX_DEFAULTS.SANDBOX_TIMEOUT_MS)
  private sandboxTimeoutMs: number;

  /** Idle queue TTL in seconds (sandboxTimeoutMs * multiplier) */
  private get idleQueueTtlSec(): number {
    return Math.floor((this.sandboxTimeoutMs * SCALEBOX_DEFAULTS.IDLE_QUEUE_TTL_MULTIPLIER) / 1000);
  }

  // ==================== Metadata Operations ====================

  async saveMetadata(wrapper: ISandboxWrapper): Promise<void> {
    const sandboxId = wrapper.sandboxId;
    const metadata = wrapper.toMetadata();
    const ttlSeconds = Math.floor(this.sandboxTimeoutMs / 1000);

    await this.redis.setJSON(`${REDIS_KEYS.METADATA_PREFIX}:${sandboxId}`, metadata, ttlSeconds);
  }

  async loadMetadata(sandboxId: string): Promise<SandboxMetadata | null> {
    return this.redis.getJSON<SandboxMetadata>(`${REDIS_KEYS.METADATA_PREFIX}:${sandboxId}`);
  }

  async deleteMetadata(sandboxId: string): Promise<void> {
    await this.redis.del(`${REDIS_KEYS.METADATA_PREFIX}:${sandboxId}`);
  }

  // ==================== Idle Queue Operations ====================

  /**
   * Get idle queue key partitioned by template name
   * This ensures sandboxes from different templates are not mixed
   */
  private getIdleQueueKey(templateName: string): string {
    return `${REDIS_KEYS.IDLE_QUEUE}:${templateName}`;
  }

  /**
   * Pop sandbox from idle queue, refresh TTL if queue still has items, delete if empty
   */
  async popFromIdleQueue(templateName: string): Promise<string | null> {
    const key = this.getIdleQueueKey(templateName);
    const client = this.redis.getClient();

    const sandboxId = await client.lpop(key);
    if (!sandboxId) {
      return null;
    }

    // Check remaining length and either refresh TTL or delete empty queue
    const remaining = await client.llen(key);
    if (remaining > 0) {
      await client.expire(key, this.idleQueueTtlSec);
    } else {
      await client.del(key);
    }

    return sandboxId;
  }

  /**
   * Push sandbox to idle queue and refresh TTL
   */
  async pushToIdleQueue(sandboxId: string, templateName: string): Promise<void> {
    const key = this.getIdleQueueKey(templateName);
    const client = this.redis.getClient();

    await client.rpush(key, sandboxId);
    await client.expire(key, this.idleQueueTtlSec);
  }

  async getTotalSandboxCount(): Promise<number> {
    // Count metadata keys as the source of truth for total sandbox count
    // Each sandbox has a metadata entry that expires with sandboxTimeoutMs
    const keys = await this.redis.getClient().keys(`${REDIS_KEYS.METADATA_PREFIX}:*`);
    return keys.length;
  }
}
