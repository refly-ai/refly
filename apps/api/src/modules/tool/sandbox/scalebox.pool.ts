import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { Config } from '../../config/config.decorator';
import { RedisService } from '../../common/redis.service';

import { SandboxCreationException, SandboxLifetimeExceededException } from './scalebox.exception';
import { SandboxWrapper } from './scalebox.wrapper';
import { ExecutionContext } from './scalebox.dto';
import { ScaleboxStorage } from './scalebox.storage';
import {
  SCALEBOX_DEFAULT_SANDBOX_TIMEOUT_MS,
  SCALEBOX_DEFAULT_AUTO_PAUSE_DELAY_MS,
  SCALEBOX_DEFAULT_MIN_REMAINING_MS,
  REDIS_KEYS,
  LOCK_RETRY_CONFIG,
  LOCK_TTL_CONFIG,
} from './scalebox.constants';
import { Trace, setSpanAttributes } from './scalebox.tracer';

@Injectable()
export class SandboxPool {
  constructor(
    private readonly redis: RedisService,
    private readonly storage: ScaleboxStorage,
    private readonly config: ConfigService, // Used by @Config decorator
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SandboxPool.name);
  }

  @Config.string('sandbox.scalebox.apiKey', '')
  private scaleboxApiKey: string;

  @Trace('pool.acquire', { 'operation.type': 'pool_acquire' })
  async acquire(
    context: ExecutionContext,
    maxLifetimeMs: number,
    maxWaitMs = LOCK_RETRY_CONFIG.POOL_CAPACITY_TIMEOUT_MS,
  ): Promise<readonly [SandboxWrapper, () => Promise<void>]> {
    setSpanAttributes({
      'pool.canvasId': context.canvasId,
      'pool.uid': context.uid,
      'pool.maxWait': maxWaitMs,
    });

    return this.tryAcquireOrCreate(context, maxLifetimeMs, maxWaitMs);
  }

  private async tryAcquireOrCreate(
    context: ExecutionContext,
    maxLifetimeMs: number,
    maxWaitMs: number,
  ): Promise<readonly [SandboxWrapper, () => Promise<void>]> {
    return guard.defer(
      () => this.acquirePoolCapacityLock(maxWaitMs),
      async () => this.doAcquireOrCreate(context, maxLifetimeMs),
    );
  }

  private async doAcquireOrCreate(
    context: ExecutionContext,
    maxLifetimeMs: number,
  ): Promise<readonly [SandboxWrapper, () => Promise<void>]> {
    const sandboxId = await this.storage.popFromIdleQueue();

    this.logger.info(
      { sandboxId, hasIdleSandbox: !!sandboxId },
      'Checked idle queue for available sandbox',
    );

    this.logger.info({ sandboxId }, 'Attempting to reuse sandbox from idle pool');

    const wrapper = await guard(() => this.tryReconnect(sandboxId, context)).orElse(
      async (error) => {
        this.logger.warn({ sandboxId, error }, 'Failed to reuse sandbox');
        const created = await this.createNewSandbox(context);
        this.logger.info({ sandboxId }, 'Created new sandbox');
        return created;
      },
    );

    this.logger.info({ sandboxId }, 'Acquired sandbox successfully');

    const removeFromActive = await this.acquireSandboxLock(wrapper.sandboxId);

    return [wrapper, () => this.releaseSandbox(wrapper, removeFromActive, maxLifetimeMs)] as const;
  }

  private async releaseSandbox(
    wrapper: SandboxWrapper,
    removeFromActive: () => Promise<void>,
    maxLifetimeMs: number,
  ): Promise<void> {
    const sandboxId = wrapper.sandboxId;

    this.logger.info({ sandboxId }, 'Starting sandbox cleanup and release');

    await guard.bestEffort(
      () => this.tryReturnToIdle(wrapper, maxLifetimeMs),
      async (error) => {
        this.logger.warn({ sandboxId, error }, 'Failed to return to idle pool');
        await guard.bestEffort(
          () => this.storage.deleteMetadata(sandboxId),
          (error) => this.logger.error({ sandboxId, error }, 'Failed to delete metadata'),
        );
      },
    );

    await guard.bestEffort(removeFromActive, (error) =>
      this.logger.error({ sandboxId, error }, 'Failed to remove sandbox from active set'),
    );

    this.logger.info({ sandboxId }, 'Sandbox cleanup completed');
  }

  private async tryReturnToIdle(wrapper: SandboxWrapper, maxLifetimeMs: number): Promise<void> {
    const sandboxId = wrapper.sandboxId;
    const lifetimeMs = Date.now() - wrapper.createdAt;

    this.logger.info(
      { sandboxId, lifetimeHours: (lifetimeMs / (60 * 60 * 1000)).toFixed(2) },
      'Attempting to return sandbox to idle pool',
    );

    guard
      .ensure(lifetimeMs < maxLifetimeMs)
      .orThrow(
        () => new SandboxLifetimeExceededException(wrapper.sandboxId, lifetimeMs, maxLifetimeMs),
      );

    await this.storage.saveMetadata(wrapper);
    await this.storage.pushToIdleQueue(sandboxId);

    this.logger.info(
      {
        sandboxId,
        expiresIn: Math.floor(wrapper.remainingTime / 1000),
        autoPauseInMinutes: SCALEBOX_DEFAULT_AUTO_PAUSE_DELAY_MS / 60000,
      },
      'Sandbox returned to idle, auto-pause scheduled',
    );

    setTimeout(
      () =>
        guard.bestEffort(
          () => this.tryAutoPause(sandboxId),
          (error) => this.logger.warn({ sandboxId, error }, 'Failed to auto-pause sandbox'),
        ),
      SCALEBOX_DEFAULT_AUTO_PAUSE_DELAY_MS,
    );
  }

  private async tryReconnect(
    sandboxId: string,
    context: ExecutionContext,
  ): Promise<SandboxWrapper> {
    guard.ensure(!!sandboxId).orThrow(() => {
      this.logger.debug('No sandbox ID from idle queue (queue is empty)');
      return new SandboxCreationException('No idle sandbox available');
    });

    const metadata = await this.storage.loadMetadata(sandboxId);

    guard.ensure(!!metadata).orThrow(() => {
      this.logger.warn({ sandboxId }, 'Sandbox metadata not found in Redis');
      return new SandboxCreationException('Metadata not found');
    });

    const remainingMs = metadata.timeoutAt - Date.now();
    guard.ensure(metadata.timeoutAt > Date.now()).orThrow(() => {
      this.logger.warn({ sandboxId, expiredMs: -remainingMs }, 'Sandbox has expired, discarding');
      void this.storage.deleteMetadata(sandboxId);
      return new SandboxCreationException('Sandbox expired');
    });

    this.logger.info(
      {
        sandboxId,
        remainingSeconds: Math.floor(remainingMs / 1000),
        wasPaused: !!metadata.isPaused,
      },
      'Found valid metadata, attempting to reconnect',
    );

    const wrapper = await guard(() =>
      SandboxWrapper.reconnect(this.logger, context, metadata),
    ).orThrow((error) => {
      this.logger.error({ sandboxId, error }, 'Failed to reconnect to sandbox');
      void this.storage.deleteMetadata(sandboxId);
      return new SandboxCreationException(error);
    });

    // SDK auto-resumes on connect, so reset pause state
    if (metadata.isPaused) {
      this.logger.info({ sandboxId }, 'Sandbox auto-resumed by SDK, updating metadata');
      await guard.bestEffort(
        async () => {
          wrapper.markAsRunning();
          await this.storage.saveMetadata(wrapper);
        },
        (error) =>
          this.logger.warn({ sandboxId, error }, 'Failed to update pause state in metadata'),
      );
    }

    return wrapper;
  }

  private async createNewSandbox(context: ExecutionContext): Promise<SandboxWrapper> {
    this.logger.info({ canvasId: context.canvasId }, 'Creating new sandbox');

    const wrapper = await SandboxWrapper.create(
      this.logger,
      context,
      SCALEBOX_DEFAULT_SANDBOX_TIMEOUT_MS,
    );

    return wrapper;
  }

  private async tryAutoPause(sandboxId: string): Promise<void> {
    const metadata = await this.storage.loadMetadata(sandboxId);
    if (!metadata) return;

    // Skip if already paused to avoid frequent reconnect->resume->pause cycles
    if (metadata.isPaused) {
      this.logger.debug(
        { sandboxId, pausedAt: metadata.lastPausedAt },
        'Sandbox already paused, skipping auto-pause',
      );
      return;
    }

    const idleDuration = Date.now() - metadata.idleSince;
    const remainingMs = metadata.timeoutAt - Date.now();

    if (idleDuration < SCALEBOX_DEFAULT_AUTO_PAUSE_DELAY_MS) return;
    if (remainingMs < SCALEBOX_DEFAULT_MIN_REMAINING_MS) return;

    await guard.defer(
      async () => {
        const releaseLock = await this.acquireSandboxLock(sandboxId);
        return [undefined, () => void releaseLock()] as const;
      },
      async () => {
        const context: ExecutionContext = {
          uid: '',
          apiKey: this.scaleboxApiKey,
          canvasId: '',
          s3DrivePath: '',
        };

        const wrapper = await SandboxWrapper.reconnect(this.logger, context, metadata);

        await guard.bestEffort(
          async () => {
            const info = await wrapper.getInfo();
            this.logger.info(
              { sandboxId, status: info.status, idleMinutes: (idleDuration / 60000).toFixed(1) },
              'Starting auto-pause for idle sandbox',
            );

            await wrapper.betaPause();

            const finalInfo = await wrapper.getInfo();
            this.logger.info(
              { sandboxId, finalStatus: finalInfo.status },
              'Auto-pause completed successfully',
            );

            // Mark as paused and save metadata
            wrapper.markAsPaused();
            await this.storage.saveMetadata(wrapper);
          },
          (error) => this.logger.error({ sandboxId, error }, 'Failed to auto-pause idle sandbox'),
        );
      },
      (error) => this.logger.warn({ sandboxId, error }, 'Auto-pause process cleanup failed'),
    );
  }

  /**
   * Acquire pool capacity lock
   * Protects sandbox allocation to prevent exceeding maxSandboxes limit during concurrent requests
   */
  private async acquirePoolCapacityLock(maxWaitMs: number) {
    const releaseLock = await guard
      .retry(
        () =>
          this.redis.acquireLock(
            REDIS_KEYS.LOCK_POOL_CAPACITY,
            LOCK_TTL_CONFIG.POOL_CAPACITY_TTL_SEC,
          ),
        {
          timeout: maxWaitMs,
          initialDelay: LOCK_RETRY_CONFIG.POLL_INTERVAL_MS,
          maxDelay: LOCK_RETRY_CONFIG.POLL_INTERVAL_MS,
          backoffFactor: 1,
        },
      )
      .orThrow(
        () =>
          new SandboxCreationException(
            `Failed to acquire pool capacity lock within ${maxWaitMs}ms`,
          ),
      );
    return [undefined, () => void releaseLock()] as const;
  }

  private async acquireSandboxLock(sandboxId: string): Promise<() => Promise<void>> {
    await this.storage.addToActiveSet(sandboxId);
    return () => this.storage.removeFromActiveSet(sandboxId);
  }
}
