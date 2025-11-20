import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { Config } from '../../config/config.decorator';
import { RedisService } from '../../common/redis.service';
import { DriveService } from '../../drive/drive.service';

import { QueueOverloadedException } from './scalebox.exception';
import { poll } from './scalebox.utils';
import { SandboxWrapper, SandboxMetadata, SandboxContext, S3Config } from './scalebox.wrapper';
import { ExecutionContext } from './scalebox.dto';
import {
  SCALEBOX_DEFAULT_MAX_SANDBOXES,
  SCALEBOX_DEFAULT_MIN_REMAINING_MS,
  SCALEBOX_DEFAULT_EXTEND_TIMEOUT_MS,
  S3_DEFAULT_CONFIG,
} from './scalebox.constants';
import { Trace, Measure, setSpanAttributes } from './scalebox.tracer';

@Injectable()
export class SandboxPool {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService, // Used by @Config decorators
    private readonly driveService: DriveService,
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
  private s3Config: S3Config;

  @Trace('pool.acquire', { 'operation.type': 'pool_acquire' })
  async acquire(context: ExecutionContext, maxWaitMs = 30000): Promise<SandboxWrapper> {
    setSpanAttributes({
      'pool.canvasId': context.canvasId,
      'pool.uid': context.uid,
      'pool.maxWait': maxWaitMs,
    });

    return poll(
      async () => {
        const wrapper = await this.tryAcquireWithMetrics(context);
        if (wrapper) {
          setSpanAttributes({ 'pool.strategy': 'reuse' });
          return wrapper;
        }

        const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
        setSpanAttributes({ 'pool.active.count': active.length });

        if (active.length < this.maxSandboxes) {
          setSpanAttributes({ 'pool.strategy': 'create' });
          return this.createNew(context);
        }

        return null;
      },
      async () => {
        const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
        throw new QueueOverloadedException(active.length, this.maxSandboxes);
      },
      { timeout: maxWaitMs },
    );
  }

  @Measure('pool.tryAcquire')
  private async tryAcquireWithMetrics(context: ExecutionContext): Promise<SandboxWrapper | null> {
    return this.tryAcquire(context);
  }

  private async tryAcquire(context: ExecutionContext): Promise<SandboxWrapper | null> {
    const lockKey = `scalebox:pool:acquire:${context.canvasId}`;
    const releaseLock = await this.redis.acquireLock(lockKey);

    if (!releaseLock) return null;

    return guard.defer(
      () => this.acquireFromIdlePool(context),
      () => void releaseLock(),
    );
  }

  private async acquireFromIdlePool(context: ExecutionContext): Promise<SandboxWrapper | null> {
    const metadata = await this.redis.getJSON<SandboxMetadata>(
      `scalebox:pool:idle:${context.canvasId}`,
    );
    if (!metadata) return null;

    if (metadata.timeoutAt <= Date.now()) {
      await this.redis.del(`scalebox:pool:idle:${context.canvasId}`);
      this.logger.info({ sandboxId: metadata.sandboxId }, 'Sandbox expired');
      return null;
    }

    await this.redis.del(`scalebox:pool:idle:${context.canvasId}`);

    const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
    active.push(metadata.sandboxId);
    await this.redis.setJSON('scalebox:pool:active', active);

    const s3DrivePath = this.driveService.buildS3DrivePath(context.uid, context.canvasId);

    const wrapper = await SandboxWrapper.reconnect(
      {
        logger: this.logger,
        uid: context.uid,
        canvasId: context.canvasId,
        apiKey: context.apiKey,
        s3Config: this.s3Config,
        s3DrivePath,
      },
      metadata,
    );

    if (!wrapper) {
      const activeList = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
      const filtered = activeList.filter((id) => id !== metadata.sandboxId);
      await this.redis.setJSON('scalebox:pool:active', filtered);
      return null;
    }

    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        active: active.length,
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
      (error) =>
        this.logger.warn(
          { context: wrapper.context, error },
          'Failed to release sandbox to idle pool',
        ),
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

  private async createNew(context: ExecutionContext): Promise<SandboxWrapper> {
    const lockKey = `scalebox:pool:create:${context.canvasId}`;
    const releaseLock = await this.redis.acquireLock(lockKey);

    if (!releaseLock) {
      // Retry acquire after short delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.acquire(context);
    }

    return guard.defer(
      () => this.createNewSandbox(context),
      () => void releaseLock(),
    );
  }

  private async createNewSandbox(context: ExecutionContext): Promise<SandboxWrapper> {
    const existing = await this.tryAcquire(context);
    if (existing) return existing;

    const active = (await this.redis.getJSON<string[]>('scalebox:pool:active')) || [];
    if (active.length >= this.maxSandboxes) {
      throw new QueueOverloadedException(active.length, this.maxSandboxes);
    }

    const s3DrivePath = this.driveService.buildS3DrivePath(context.uid, context.canvasId);

    const sandboxContext: SandboxContext = {
      logger: this.logger,
      uid: context.uid,
      canvasId: context.canvasId,
      apiKey: context.apiKey,
      s3Config: this.s3Config,
      s3DrivePath,
    };

    const wrapper = await SandboxWrapper.create(sandboxContext, this.extendTimeoutMs);

    active.push(wrapper.sandboxId);
    await this.redis.setJSON('scalebox:pool:active', active);

    const activeCount = active.length;
    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
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
