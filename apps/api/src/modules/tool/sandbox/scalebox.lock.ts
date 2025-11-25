/**
 * Scalebox Distributed Lock
 *
 * Execute Lifecycle (defer pattern):
 *   🔒 execute(uid, canvasId)
 *   └─ ↩️ wrapper [acquire/release]
 *      └─ 🔒 sandbox(sandboxId)
 *         └─ ↩️ drive [mount/unmount]
 *            └─ ↩️ file [pre/post]
 *               └─ runCode (timeout: runCodeTimeoutMs)
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { RedisService } from '../../common/redis.service';
import { Config } from '../../config/config.decorator';
import { SandboxLockTimeoutException } from './scalebox.exception';
import { REDIS_KEYS, SCALEBOX_DEFAULTS } from './scalebox.constants';

@Injectable()
export class ScaleboxLock {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScaleboxLock.name);
    void this.config;
  }

  @Config.integer('sandbox.scalebox.runCodeTimeoutSec', SCALEBOX_DEFAULTS.RUN_CODE_TIMEOUT_SEC)
  private runCodeTimeoutSec: number;

  @Config.integer('sandbox.scalebox.fileBufferSec', SCALEBOX_DEFAULTS.FILE_BUFFER_SEC)
  private fileBufferSec: number;

  @Config.integer('sandbox.scalebox.driveBufferSec', SCALEBOX_DEFAULTS.DRIVE_BUFFER_SEC)
  private driveBufferSec: number;

  @Config.integer('sandbox.scalebox.queueDepth', SCALEBOX_DEFAULTS.QUEUE_DEPTH)
  private queueDepth: number;

  @Config.integer('sandbox.scalebox.lockPollIntervalMs', SCALEBOX_DEFAULTS.LOCK_POLL_INTERVAL_MS)
  private lockPollIntervalMs: number;

  get runCodeTimeoutMs(): number {
    return this.runCodeTimeoutSec * 1000;
  }

  async acquireExecuteLock(
    uid: string,
    canvasId: string,
  ): Promise<readonly [undefined, () => Promise<void>]> {
    const lockKey = `${REDIS_KEYS.LOCK_EXECUTE_PREFIX}:${uid}:${canvasId}`;
    const ttlSec = this.runCodeTimeoutSec + this.fileBufferSec + this.driveBufferSec;
    const timeoutMs = this.queueDepth * ttlSec * 1000;

    this.logger.debug({ lockKey, ttlSec, timeoutMs }, 'Acquiring execute lock');

    const releaseLock = await guard
      .retry(() => this.tryExecuteLock(lockKey, ttlSec), {
        timeout: timeoutMs,
        initialDelay: this.lockPollIntervalMs,
        maxDelay: this.lockPollIntervalMs,
        backoffFactor: 1,
      })
      .orThrow(() => new SandboxLockTimeoutException(lockKey, timeoutMs));

    this.logger.info({ lockKey }, 'Execute lock acquired');

    return [undefined, releaseLock] as const;
  }

  async acquireSandboxLock(sandboxId: string): Promise<readonly [undefined, () => Promise<void>]> {
    const ttlSec = this.runCodeTimeoutSec + this.fileBufferSec;
    const timeoutMs = this.queueDepth * ttlSec * 1000;

    this.logger.debug({ sandboxId, ttlSec, timeoutMs }, 'Acquiring sandbox lock');

    const releaseLock = await guard
      .retry(() => this.trySandboxLock(sandboxId), {
        timeout: timeoutMs,
        initialDelay: this.lockPollIntervalMs,
        maxDelay: this.lockPollIntervalMs,
        backoffFactor: 1,
      })
      .orThrow(() => new SandboxLockTimeoutException(`sandbox:${sandboxId}`, timeoutMs));

    this.logger.info('Sandbox lock acquired');

    return [undefined, releaseLock] as const;
  }

  async trySandboxLock(sandboxId: string): Promise<() => Promise<void>> {
    const lockKey = `${REDIS_KEYS.LOCK_SANDBOX_PREFIX}:${sandboxId}`;
    const ttlSec = this.runCodeTimeoutSec + this.fileBufferSec;

    const result = await this.redis.getClient().set(lockKey, '1', 'EX', ttlSec, 'NX');
    if (result !== 'OK') {
      this.logger.debug({ sandboxId }, 'Sandbox lock held, waiting...');
    }
    guard.ensure(result === 'OK').orThrow(() => new Error('Sandbox lock is held'));

    return async () => {
      await this.redis.getClient().del(lockKey);
      this.logger.debug({ sandboxId }, 'Sandbox lock released');
    };
  }

  private async tryExecuteLock(lockKey: string, ttlSec: number): Promise<() => Promise<void>> {
    const result = await this.redis.getClient().set(lockKey, '1', 'EX', ttlSec, 'NX');
    if (result !== 'OK') {
      this.logger.debug({ lockKey }, 'Execute lock held, waiting...');
    }
    guard.ensure(result === 'OK').orThrow(() => new Error('Execute lock is held'));

    return async () => {
      await this.redis.getClient().del(lockKey);
      this.logger.debug({ lockKey }, 'Execute lock released');
    };
  }
}
