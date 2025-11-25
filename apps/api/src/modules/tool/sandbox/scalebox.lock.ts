/**
 * Scalebox Distributed Lock with Auto-Renewal
 *
 * Features:
 * - Short initial TTL with periodic renewal (prevents long lock hold on crash)
 * - UUID-based lock ownership (prevents accidental release of other's lock)
 * - AbortController integration (abort execution on renewal failure)
 * - Lua script for atomic release (check-then-delete)
 *
 * Execute Lifecycle (defer pattern):
 *   🔒 execute(uid, canvasId) [AbortController created by service layer]
 *   └─ ↩️ wrapper [acquire/release]
 *      └─ 🔒 sandbox(sandboxId)
 *         └─ ↩️ drive [mount/unmount]
 *            └─ ↩️ file [pre/post]
 *               └─ runCode (timeout: runCodeTimeoutMs)
 */

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { RedisService } from '../../common/redis.service';
import { Config } from '../../config/config.decorator';
import { SandboxLockTimeoutException } from './scalebox.exception';
import { REDIS_KEYS, SCALEBOX_DEFAULTS } from './scalebox.constants';

// Lua script for atomic release: only delete if value matches
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

// Lua script for atomic renewal: only extend TTL if value matches
const RENEW_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("expire", KEYS[1], ARGV[2])
  else
    return 0
  end
`;

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

  @Config.integer('sandbox.scalebox.lockWaitTimeoutSec', SCALEBOX_DEFAULTS.LOCK_WAIT_TIMEOUT_SEC)
  private lockWaitTimeoutSec: number;

  @Config.integer('sandbox.scalebox.lockPollIntervalMs', SCALEBOX_DEFAULTS.LOCK_POLL_INTERVAL_MS)
  private lockPollIntervalMs: number;

  @Config.integer('sandbox.scalebox.lockInitialTtlSec', SCALEBOX_DEFAULTS.LOCK_INITIAL_TTL_SEC)
  private lockInitialTtlSec: number;

  @Config.integer(
    'sandbox.scalebox.lockRenewalIntervalMs',
    SCALEBOX_DEFAULTS.LOCK_RENEWAL_INTERVAL_MS,
  )
  private lockRenewalIntervalMs: number;

  get runCodeTimeoutMs(): number {
    return this.runCodeTimeoutSec * 1000;
  }

  /**
   * Acquire execute lock with auto-renewal
   */
  async acquireExecuteLock(
    uid: string,
    canvasId: string,
  ): Promise<readonly [undefined, () => Promise<void>]> {
    const lockKey = `${REDIS_KEYS.LOCK_EXECUTE_PREFIX}:${uid}:${canvasId}`;
    return this.acquireLockWithRenewal(lockKey);
  }

  /**
   * Acquire sandbox lock with auto-renewal
   */
  async acquireSandboxLock(sandboxId: string): Promise<readonly [undefined, () => Promise<void>]> {
    const lockKey = `${REDIS_KEYS.LOCK_SANDBOX_PREFIX}:${sandboxId}`;
    return this.acquireLockWithRenewal(lockKey);
  }

  /**
   * Core lock acquisition with auto-renewal
   * Shared by acquireExecuteLock and acquireSandboxLock
   */
  private async acquireLockWithRenewal(
    lockKey: string,
  ): Promise<readonly [undefined, () => Promise<void>]> {
    const lockValue = randomUUID();
    const timeoutMs = this.lockWaitTimeoutSec * 1000;

    this.logger.debug({ lockKey, timeoutMs }, 'Acquiring lock');

    await guard
      .retry(() => this.tryAcquireLock(lockKey, lockValue), {
        timeout: timeoutMs,
        initialDelay: this.lockPollIntervalMs,
        maxDelay: this.lockPollIntervalMs,
        backoffFactor: 1,
      })
      .orThrow(() => new SandboxLockTimeoutException(lockKey, timeoutMs));

    this.logger.info({ lockKey }, 'Lock acquired');

    // Start renewal timer
    const stopRenewal = this.startRenewal(lockKey, lockValue);

    return [
      undefined,
      async () => {
        stopRenewal();
        await this.safeReleaseLock(lockKey, lockValue);
        this.logger.debug({ lockKey }, 'Lock released');
      },
    ] as const;
  }

  /**
   * Try to acquire sandbox lock without blocking (for auto-pause)
   * Returns release function if acquired, throws if lock is held
   */
  async trySandboxLock(sandboxId: string): Promise<() => Promise<void>> {
    const lockKey = `${REDIS_KEYS.LOCK_SANDBOX_PREFIX}:${sandboxId}`;
    const lockValue = randomUUID();

    const result = await this.redis
      .getClient()
      .set(lockKey, lockValue, 'EX', this.lockInitialTtlSec, 'NX');
    if (result !== 'OK') {
      this.logger.debug({ sandboxId }, 'Sandbox lock held, cannot acquire');
      throw new Error('Sandbox lock is held');
    }

    // For short-lived operations like pause, no renewal needed
    return async () => {
      await this.safeReleaseLock(lockKey, lockValue);
      this.logger.debug({ sandboxId }, 'Sandbox lock released');
    };
  }

  /**
   * Try to acquire lock with SET NX
   */
  private async tryAcquireLock(lockKey: string, lockValue: string): Promise<void> {
    const result = await this.redis
      .getClient()
      .set(lockKey, lockValue, 'EX', this.lockInitialTtlSec, 'NX');
    if (result !== 'OK') {
      this.logger.debug({ lockKey }, 'Lock held, waiting...');
      throw new Error('Lock is held');
    }
  }

  /**
   * Start renewal timer that periodically extends lock TTL
   * On failure: logs warning and stops renewal (lock will expire after TTL)
   */
  private startRenewal(lockKey: string, lockValue: string): () => void {
    const timer = setInterval(async () => {
      try {
        const renewed = await this.renewLock(lockKey, lockValue);
        if (!renewed) {
          this.logger.warn({ lockKey }, 'Lock renewal failed: lock lost or value mismatch');
          clearInterval(timer);
        }
      } catch (error) {
        this.logger.warn({ lockKey, error }, 'Lock renewal error');
        clearInterval(timer);
      }
    }, this.lockRenewalIntervalMs);

    return () => clearInterval(timer);
  }

  /**
   * Renew lock TTL atomically (only if value matches)
   */
  private async renewLock(lockKey: string, lockValue: string): Promise<boolean> {
    const result = await this.redis
      .getClient()
      .eval(RENEW_LOCK_SCRIPT, 1, lockKey, lockValue, this.lockInitialTtlSec);
    return result === 1;
  }

  /**
   * Release lock atomically (only if value matches)
   * Safe to call even if lock expired or was taken by another holder
   */
  private async safeReleaseLock(lockKey: string, lockValue: string): Promise<void> {
    const result = await this.redis.getClient().eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockValue);
    if (result !== 1) {
      this.logger.warn(
        { lockKey },
        'Lock release: key not found or value mismatch (may have expired)',
      );
    }
  }
}
