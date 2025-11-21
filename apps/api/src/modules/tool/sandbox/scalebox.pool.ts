import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { Config } from '../../config/config.decorator';
import { RedisService } from '../../common/redis.service';

import { QueueOverloadedException, SandboxCreationException } from './scalebox.exception';
import { SandboxWrapper, SandboxMetadata, SandboxContext, S3Config } from './scalebox.wrapper';
import { ExecutionContext } from './scalebox.dto';
import {
  SCALEBOX_DEFAULT_MAX_SANDBOXES,
  SCALEBOX_DEFAULT_MIN_REMAINING_MS,
  SCALEBOX_DEFAULT_EXTEND_TIMEOUT_MS,
  SCALEBOX_DEFAULT_MAX_LIFETIME_MS,
  S3_DEFAULT_CONFIG,
} from './scalebox.constants';
import { Trace, setSpanAttributes } from './scalebox.tracer';

@Injectable()
export class SandboxPool {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
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

  @Config.integer('sandbox.scalebox.maxLifetimeMs', SCALEBOX_DEFAULT_MAX_LIFETIME_MS)
  private maxLifetimeMs: number;

  @Config.object('objectStorage.minio.internal', S3_DEFAULT_CONFIG)
  private s3Config: S3Config;

  private get redisClient() {
    const client = this.redis.getClient();
    guard.ensure(!!client).orThrow(() => new SandboxCreationException('Redis client not found'));
    return client;
  }

  @Trace('pool.acquire', { 'operation.type': 'pool_acquire' })
  async acquire(context: ExecutionContext, maxWaitMs = 30000): Promise<SandboxWrapper> {
    setSpanAttributes({
      'pool.canvasId': context.canvasId,
      'pool.uid': context.uid,
      'pool.maxWait': maxWaitMs,
    });

    return guard.retry(() => this.tryAcquireOrCreate(context), { timeout: maxWaitMs }).orThrow();
  }

  private async tryAcquireOrCreate(context: ExecutionContext): Promise<SandboxWrapper> {
    const reused = await this.tryReuseFromPool(context);
    if (reused) {
      setSpanAttributes({ 'pool.strategy': 'reuse' });
      return reused;
    }

    setSpanAttributes({ 'pool.strategy': 'create' });
    await this.ensureHasCapacity();
    return this.createNew(context);
  }

  private async tryReuseFromPool(context: ExecutionContext): Promise<SandboxWrapper | null> {
    const sandboxId = await this.popIdleSandbox();
    if (!sandboxId) return null;

    const metadata = await guard(() => this.getValidMetadata(sandboxId)).orElse(() => null);
    if (!metadata) return null;

    const wrapper = await this.reconnectSandbox(sandboxId, metadata, context);
    return wrapper;
  }

  private async popIdleSandbox(): Promise<string | null> {
    return this.redisClient.lpop('scalebox:pool:idle');
  }

  private async getValidMetadata(sandboxId: string): Promise<SandboxMetadata> {
    const metadata = await this.redis.getJSON<SandboxMetadata>(`scalebox:pool:meta:${sandboxId}`);

    guard.ensure(!!metadata).orThrow(() => {
      this.logger.warn({ sandboxId }, 'Metadata not found for sandbox, discarding');
      return new SandboxCreationException('Metadata not found');
    });

    guard.ensure(metadata.timeoutAt > Date.now()).orThrow(() => {
      void this.redis.del(`scalebox:pool:meta:${sandboxId}`);
      this.logger.info({ sandboxId }, 'Sandbox expired, discarding');
      return new SandboxCreationException('Sandbox expired');
    });

    return metadata;
  }

  private async reconnectSandbox(
    sandboxId: string,
    metadata: SandboxMetadata,
    context: ExecutionContext,
  ): Promise<SandboxWrapper | null> {
    await this.redisClient.sadd('scalebox:pool:active', sandboxId);

    return guard(async () => {
      const wrapper = await SandboxWrapper.reconnect(
        {
          logger: this.logger,
          uid: context.uid,
          canvasId: context.canvasId,
          apiKey: context.apiKey,
          s3Config: this.s3Config,
        },
        metadata,
      );

      const activeCount = await this.redisClient.scard('scalebox:pool:active');
      this.logger.info(
        {
          sandboxId: wrapper.sandboxId,
          canvasId: context.canvasId,
          active: activeCount,
          max: this.maxSandboxes,
        },
        'Reconnected to sandbox from global pool (unmounted)',
      );

      return wrapper;
    }).orElse(async () => {
      await this.redisClient.srem('scalebox:pool:active', sandboxId);
      await this.redis.del(`scalebox:pool:meta:${sandboxId}`);
      return null;
    });
  }

  private async ensureHasCapacity(): Promise<void> {
    const activeCount = await this.redisClient.scard('scalebox:pool:active');
    setSpanAttributes({ 'pool.active.count': activeCount });

    guard
      .ensure(activeCount < this.maxSandboxes)
      .orThrow(() => new QueueOverloadedException(activeCount, this.maxSandboxes));
  }

  async release(wrapper: SandboxWrapper): Promise<void> {
    const sandboxId = wrapper.sandboxId;

    await this.redisClient.srem('scalebox:pool:active', sandboxId);
    const activeCount = await this.redisClient.scard('scalebox:pool:active');

    await guard.bestEffort(
      async () => {
        await wrapper.extendTimeout(this.extendTimeoutMs);
        const remainingMs = wrapper.remainingTime;

        const isHealthy = await wrapper.isHealthy();
        guard.ensure(isHealthy).orThrow(() => new Error('Sandbox is not healthy'));

        guard
          .ensure(remainingMs >= this.minRemainingMs)
          .orThrow(() => new Error('Sandbox remaining time too low'));

        const lifetimeMs = Date.now() - wrapper.createdAt;
        guard.ensure(lifetimeMs < this.maxLifetimeMs).orThrow(() => {
          this.logger.info(
            {
              sandboxId,
              lifetimeHours: (lifetimeMs / (60 * 60 * 1000)).toFixed(2),
              maxLifetimeHours: (this.maxLifetimeMs / (60 * 60 * 1000)).toFixed(2),
            },
            'Sandbox exceeded max lifetime, discarding',
          );
          return new Error('Sandbox exceeded max lifetime');
        });

        const metadata = wrapper.toMetadata();
        const ttlSeconds = Math.floor(remainingMs / 1000);

        await this.redis.setJSON(`scalebox:pool:meta:${sandboxId}`, metadata, ttlSeconds);
        await this.redisClient.rpush('scalebox:pool:idle', sandboxId);

        this.logger.info(
          {
            sandboxId,
            expiresIn: ttlSeconds,
            lifetimeHours: (lifetimeMs / (60 * 60 * 1000)).toFixed(2),
            active: activeCount,
            max: this.maxSandboxes,
          },
          'Released sandbox to global pool',
        );
      },
      (error) => this.logger.error(error, `Failed to return sandbox ${sandboxId} to pool`),
    );
  }

  private async createNew(context: ExecutionContext): Promise<SandboxWrapper> {
    const lockKey = 'scalebox:pool:create:global';

    return guard.defer(
      async () => {
        const releaseLock = await this.redis.acquireLock(lockKey);
        guard
          .ensure(!!releaseLock)
          .orThrow(() => new QueueOverloadedException(this.maxSandboxes, this.maxSandboxes));

        return [undefined, () => void releaseLock()] as const;
      },
      () => this.createNewSandbox(context),
    );
  }

  private async createNewSandbox(context: ExecutionContext): Promise<SandboxWrapper> {
    const existing = await this.tryReuseFromPool(context);
    if (existing) return existing;

    const activeCount = await this.redisClient.scard('scalebox:pool:active');
    guard
      .ensure(activeCount < this.maxSandboxes)
      .orThrow(() => new QueueOverloadedException(activeCount, this.maxSandboxes));

    const sandboxContext: SandboxContext = {
      logger: this.logger,
      uid: context.uid,
      canvasId: context.canvasId,
      apiKey: context.apiKey,
      s3Config: this.s3Config,
    };

    const wrapper = await SandboxWrapper.create(sandboxContext, this.extendTimeoutMs);

    await this.redisClient.sadd('scalebox:pool:active', wrapper.sandboxId);

    const newActiveCount = await this.redisClient.scard('scalebox:pool:active');
    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        canvasId: context.canvasId,
        active: newActiveCount,
        max: this.maxSandboxes,
      },
      'Sandbox created and added to active pool (unmounted)',
    );

    return wrapper;
  }

  async getStats() {
    const activeCount = await this.redisClient.scard('scalebox:pool:active');

    return {
      active: activeCount,
      max: this.maxSandboxes,
    };
  }

  async clear() {
    await this.redis.del('scalebox:pool:active');
  }
}
