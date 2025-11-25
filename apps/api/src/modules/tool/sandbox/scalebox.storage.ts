import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { RedisService } from '../../common/redis.service';
import { Config } from '../../config/config.decorator';
import { SandboxWrapper, SandboxMetadata } from './scalebox.wrapper';
import { REDIS_KEYS, SCALEBOX_DEFAULTS } from './scalebox.constants';

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
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScaleboxStorage.name);
    void this.config; // Suppress unused warning - used by @Config decorators
  }

  @Config.integer('sandbox.scalebox.sandboxTimeoutMs', SCALEBOX_DEFAULTS.SANDBOX_TIMEOUT_MS)
  private sandboxTimeoutMs: number;

  // ==================== Metadata Operations ====================

  async saveMetadata(wrapper: SandboxWrapper): Promise<void> {
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

  async popFromIdleQueue(): Promise<string | null> {
    return this.redis.getClient().lpop(REDIS_KEYS.IDLE_QUEUE);
  }

  async pushToIdleQueue(sandboxId: string): Promise<void> {
    await this.redis.getClient().rpush(REDIS_KEYS.IDLE_QUEUE, sandboxId);
  }

  async getTotalSandboxCount(): Promise<number> {
    const [idleCount, activeCount] = await Promise.all([
      this.redis.getClient().llen(REDIS_KEYS.IDLE_QUEUE),
      this.redis.getClient().scard(REDIS_KEYS.ACTIVE_SET),
    ]);
    return idleCount + activeCount;
  }
}
