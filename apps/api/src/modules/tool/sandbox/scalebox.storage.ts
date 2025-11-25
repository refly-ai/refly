import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { RedisService } from '../../common/redis.service';
import { Config } from '../../config/config.decorator';
import { SandboxWrapper, SandboxMetadata } from './scalebox.wrapper';
import { SandboxLockTimeoutException } from './scalebox.exception';
import { REDIS_KEYS, SCALEBOX_DEFAULT_CONFIG } from './scalebox.constants';
import { ScaleboxLockConfig } from './scalebox.lock';

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

  @Config.integer('sandbox.scalebox.sandbox.timeoutMs', SCALEBOX_DEFAULT_CONFIG.sandbox.timeoutMs)
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

  // ==================== Lock Operations ====================

  async tryCommonLock(lockKey: string, ttlSec: number): Promise<() => Promise<void>> {
    const result = await this.redis.getClient().set(lockKey, '1', 'EX', ttlSec, 'NX');

    guard.ensure(result === 'OK').orThrow(() => new Error('Common lock is held'));

    return async () => {
      await this.redis.getClient().del(lockKey);
    };
  }

  async acquireCommonLock(
    lockKey: string,
    lockConfig: ScaleboxLockConfig,
  ): Promise<readonly [undefined, () => Promise<void>]> {
    const releaseLock = await guard
      .retry(() => this.tryCommonLock(lockKey, lockConfig.ttlSec), {
        timeout: lockConfig.timeoutMs,
        initialDelay: lockConfig.pollIntervalMs,
        maxDelay: lockConfig.pollIntervalMs,
        backoffFactor: 1,
      })
      .orThrow(() => new SandboxLockTimeoutException(lockKey, lockConfig.timeoutMs));

    return [undefined, releaseLock] as const;
  }

  async acquireSandboxLock(
    sandboxId: string,
    lockConfig: ScaleboxLockConfig,
  ): Promise<readonly [undefined, () => Promise<void>]> {
    const releaseLock = await guard
      .retry(() => this.trySandboxLock(sandboxId), {
        timeout: lockConfig.timeoutMs,
        initialDelay: lockConfig.pollIntervalMs,
        maxDelay: lockConfig.pollIntervalMs,
        backoffFactor: 1,
      })
      .orThrow(() => new SandboxLockTimeoutException(`sandbox:${sandboxId}`, lockConfig.timeoutMs));

    return [undefined, releaseLock] as const;
  }

  async trySandboxLock(sandboxId: string): Promise<() => Promise<void>> {
    const added = await this.redis.getClient().sadd(REDIS_KEYS.ACTIVE_SET, sandboxId);

    guard.ensure(added > 0).orThrow(() => new Error('Sandbox lock is held'));

    return async () => {
      await this.redis.getClient().srem(REDIS_KEYS.ACTIVE_SET, sandboxId);
    };
  }
}
