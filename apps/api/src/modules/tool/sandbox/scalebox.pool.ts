import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { Config } from '../../config/config.decorator';
import { RedisService } from '../../common/redis.service';

import { QueueOverloadedException } from './scalebox.exception';
import { poll, buildS3Path } from './scalebox.utils';
import { SandboxWrapper, SandboxMetadata, SandboxContext, S3Config } from './scalebox.wrapper';
import {
  SCALEBOX_DEFAULT_MAX_SANDBOXES,
  SCALEBOX_DEFAULT_MIN_REMAINING_MS,
  SCALEBOX_DEFAULT_EXTEND_TIMEOUT_MS,
  S3_DEFAULT_CONFIG,
} from './scalebox.constants';

@Injectable()
export class SandboxPool {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService, // Used by @Config decorators
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SandboxPool.name);
  }

  @Config.integer('sandbox.scalebox.maxSandboxes', SCALEBOX_DEFAULT_MAX_SANDBOXES)
  private maxSandboxes: number;

  @Config.integer('sandbox.scalebox.minRemainingMs', SCALEBOX_DEFAULT_MIN_REMAINING_MS)
  private minRemainingMs: number;

  @Config.integer('sandbox.scalebox.extendTimeoutMs', SCALEBOX_DEFAULT_EXTEND_TIMEOUT_MS)
  private extendTimeoutMs: number;

  @Config.object('objectStorage.minio.internal', S3_DEFAULT_CONFIG)
  private s3ConfigRaw: S3Config;

  @Config.string('drive.storageKeyPrefix', 'drive')
  private driveStorageKeyPrefix: string;

  private getS3Config(): S3Config {
    guard
      .notEmpty(this.s3ConfigRaw.accessKey)
      .orThrow(() => new Error('S3 accessKey is required (SANDBOX_S3_ACCESS_KEY)'));

    guard
      .notEmpty(this.s3ConfigRaw.secretKey)
      .orThrow(() => new Error('S3 secretKey is required (SANDBOX_S3_SECRET_KEY)'));

    return this.s3ConfigRaw;
  }

  async acquire(
    uid: string,
    canvasId: string,
    apiKey: string,
    maxWaitMs = 30000,
  ): Promise<SandboxWrapper> {
    const wrapper = await this.tryAcquire(uid, canvasId, apiKey);
    if (wrapper) return wrapper;

    const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
    if (active.length < this.maxSandboxes) {
      return this.createNew(uid, canvasId, apiKey);
    }

    return poll(
      () => this.tryAcquireOrCreate(uid, canvasId, apiKey),
      async () => {
        const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
        throw new QueueOverloadedException(active.length, this.maxSandboxes);
      },
      { timeout: maxWaitMs },
    );
  }

  private async tryAcquireOrCreate(
    uid: string,
    canvasId: string,
    apiKey: string,
  ): Promise<SandboxWrapper | null> {
    const wrapper = await this.tryAcquire(uid, canvasId, apiKey);
    if (wrapper) return wrapper;

    const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
    if (active.length < this.maxSandboxes) {
      return this.createNew(uid, canvasId, apiKey);
    }

    return null;
  }

  private async tryAcquire(
    uid: string,
    canvasId: string,
    apiKey: string,
  ): Promise<SandboxWrapper | null> {
    const lockKey = `scalebox:pool:acquire:${canvasId}`;
    const releaseLock = await this.redis.acquireLock(lockKey);

    if (!releaseLock) return null;

    return guard.defer(
      () => this.acquireFromIdlePool(uid, canvasId, apiKey),
      () => void releaseLock(),
    );
  }

  private async acquireFromIdlePool(
    uid: string,
    canvasId: string,
    apiKey: string,
  ): Promise<SandboxWrapper | null> {
    const metadata = await this.redis.getJSON<SandboxMetadata>(`scalebox:pool:idle:${canvasId}`);
    if (!metadata) return null;

    if (metadata.timeoutAt <= Date.now()) {
      await this.redis.del(`scalebox:pool:idle:${canvasId}`);
      this.logger.info({ sandboxId: metadata.sandboxId }, 'Sandbox expired');
      return null;
    }

    await this.redis.del(`scalebox:pool:idle:${canvasId}`);

    const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
    active.push(metadata.sandboxId);
    await this.redis.setJSON('scalebox:pool:active', active);

    const context: SandboxContext = {
      logger: this.logger,
      uid,
      canvasId,
      apiKey,
      s3Config: this.getS3Config(),
      s3InputPath: buildS3Path.input(this.driveStorageKeyPrefix, uid, canvasId),
    };

    const wrapper = await SandboxWrapper.reconnect(context, metadata);
    if (!wrapper) {
      const activeList = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
      const filtered = activeList.filter((id) => id !== metadata.sandboxId);
      await this.redis.setJSON('scalebox:pool:active', filtered);
      return null;
    }

    const activeCount = active.length;
    this.logger.info(
      {
        sandboxId: metadata.sandboxId,
        canvasId,
        active: activeCount,
        max: this.maxSandboxes,
      },
      'Reused sandbox from idle pool',
    );

    return wrapper;
  }

  async release(wrapper: SandboxWrapper): Promise<void> {
    const activeList = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
    const filtered = activeList.filter((id) => id !== wrapper.sandboxId);
    await this.redis.setJSON('scalebox:pool:active', filtered);

    await guard.bestEffort(
      () => this.returnToIdlePool(wrapper, filtered.length),
      (error) => {
        this.logger.warn(
          {
            sandboxId: wrapper.sandboxId,
            error: (error as Error).message,
          },
          'Failed to release sandbox to idle pool',
        );
      },
    );
  }

  private async returnToIdlePool(wrapper: SandboxWrapper, activeCount: number): Promise<void> {
    await wrapper.extendTimeout(this.extendTimeoutMs);

    const remainingMs = wrapper.getRemainingTime();

    if (!(await wrapper.isHealthy())) {
      this.logger.info({ sandboxId: wrapper.sandboxId }, 'Sandbox is not healthy, discarding');
      return;
    }

    if (remainingMs < this.minRemainingMs) {
      this.logger.info(
        {
          sandboxId: wrapper.sandboxId,
          remainingSeconds: Math.floor(remainingMs / 1000),
        },
        'Sandbox remaining time too low, discarding',
      );
      return;
    }

    const ttlSeconds = Math.floor(remainingMs / 1000);
    await this.redis.setJSON(
      `scalebox:pool:idle:${wrapper.canvasId}`,
      wrapper.toMetadata(),
      ttlSeconds,
    );

    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        expiresIn: ttlSeconds,
        active: activeCount,
        max: this.maxSandboxes,
      },
      'Released sandbox to pool',
    );
  }

  private async createNew(uid: string, canvasId: string, apiKey: string): Promise<SandboxWrapper> {
    const lockKey = `scalebox:pool:create:${canvasId}`;
    const releaseLock = await this.redis.acquireLock(lockKey);

    if (!releaseLock) {
      // Retry acquire after short delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.acquire(uid, canvasId, apiKey);
    }

    return guard.defer(
      () => this.createNewSandbox(uid, canvasId, apiKey),
      () => void releaseLock(),
    );
  }

  private async createNewSandbox(
    uid: string,
    canvasId: string,
    apiKey: string,
  ): Promise<SandboxWrapper> {
    const existing = await this.tryAcquire(uid, canvasId, apiKey);
    if (existing) return existing;

    const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
    if (active.length >= this.maxSandboxes) {
      throw new QueueOverloadedException(active.length, this.maxSandboxes);
    }

    const context: SandboxContext = {
      logger: this.logger,
      uid,
      canvasId,
      apiKey,
      s3Config: this.getS3Config(),
      s3InputPath: buildS3Path.input(this.driveStorageKeyPrefix, uid, canvasId),
    };

    const wrapper = await SandboxWrapper.create(context, this.extendTimeoutMs);

    active.push(wrapper.sandboxId);
    await this.redis.setJSON('scalebox:pool:active', active);

    const activeCount = active.length;
    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        uid,
        canvasId,
        active: activeCount,
        max: this.maxSandboxes,
        expiresAt: new Date(wrapper.getTimeoutAt()).toISOString(),
      },
      'Sandbox added to active pool',
    );

    return wrapper;
  }

  async getStats() {
    const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];

    return {
      active: active.length,
      max: this.maxSandboxes,
    };
  }

  async clear() {
    await this.redis.del('scalebox:pool:active');
    // Note: Can't efficiently clear all scalebox:pool:idle:* keys without scanning
    // Let TTL handle expiration naturally
  }
}
