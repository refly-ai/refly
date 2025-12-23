import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { QUEUE_SCALEBOX_PAUSE, QUEUE_SCALEBOX_KILL } from '../../../utils/const';
import { Config } from '../../config/config.decorator';

import { SandboxCreationException } from './scalebox.exception';
import { ISandboxWrapper } from './wrapper/base';
import { SandboxWrapperFactory } from './scalebox.factory';
import { ExecutionContext, SandboxPauseJobData, SandboxKillJobData } from './scalebox.dto';
import { ScaleboxStorage } from './scalebox.storage';
import { SCALEBOX_DEFAULTS } from './scalebox.constants';
import { Trace } from '@refly/observability';

@Injectable()
export class SandboxPool {
  constructor(
    private readonly storage: ScaleboxStorage,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly wrapperFactory: SandboxWrapperFactory,
    @InjectQueue(QUEUE_SCALEBOX_PAUSE)
    private readonly pauseQueue: Queue<SandboxPauseJobData>,
    @InjectQueue(QUEUE_SCALEBOX_KILL)
    private readonly killQueue: Queue<SandboxKillJobData>,
  ) {
    this.logger.setContext(SandboxPool.name);
    void this.config; // Suppress unused warning - used by @Config decorators
  }

  @Config.integer('sandbox.scalebox.sandboxTimeoutMs', SCALEBOX_DEFAULTS.SANDBOX_TIMEOUT_MS)
  private sandboxTimeoutMs: number;

  @Config.integer('sandbox.scalebox.maxSandboxes', SCALEBOX_DEFAULTS.MAX_SANDBOXES)
  private maxSandboxes: number;

  @Config.integer('sandbox.scalebox.autoPauseDelayMs', SCALEBOX_DEFAULTS.AUTO_PAUSE_DELAY_MS)
  private autoPauseDelayMs: number;

  /**
   * Get current template name from factory (for idle queue partitioning)
   */
  private get templateName(): string {
    return this.wrapperFactory.getCurrentTemplateName();
  }

  @Trace('pool.acquire', { 'operation.type': 'pool_acquire' })
  async acquire(context: ExecutionContext): Promise<ISandboxWrapper> {
    const onFailed = (sandboxId: string, error: Error) => {
      this.enqueueKill(sandboxId, `acquire:${error.message.slice(0, 50)}`);
    };

    const wrapper = await guard(async () => {
      const sandboxId = await this.storage.popFromIdleQueue(this.templateName);
      await this.cancelPause(sandboxId);
      return await this.reconnect(sandboxId, context);
    }).orElse(async (error) => {
      this.logger.warn({ error }, 'Failed to reuse idle sandbox');

      const totalCount = await this.storage.getTotalSandboxCount();
      guard
        .ensure(totalCount < this.maxSandboxes)
        .orThrow(
          () =>
            new SandboxCreationException(
              `Sandbox resource limit exceeded (${totalCount}/${this.maxSandboxes})`,
            ),
        );

      return await this.wrapperFactory.create(context, this.sandboxTimeoutMs, onFailed);
    });

    // Inject sandboxId into logger context for all subsequent logs
    this.logger.assign({ sandboxId: wrapper.sandboxId });

    // Mark as running and update metadata (unified for cache hit, reconnect, and create)
    await guard.bestEffort(
      async () => {
        wrapper.markAsRunning();
        await this.storage.saveMetadata(wrapper);
      },
      (error) =>
        this.logger.warn(
          { sandboxId: wrapper.sandboxId, error },
          'Failed to mark sandbox as running',
        ),
    );

    this.logger.info('Sandbox acquired');

    return wrapper;
  }

  async release(wrapper: ISandboxWrapper): Promise<void> {
    const sandboxId = wrapper.sandboxId;

    this.logger.debug({ sandboxId }, 'Starting sandbox cleanup and release');

    // Mark sandbox as idle before saving metadata
    wrapper.markAsIdle();

    await guard.bestEffort(
      async () => {
        await this.storage.saveMetadata(wrapper);
        await this.storage.pushToIdleQueue(sandboxId, this.templateName);
        await this.schedulePause(sandboxId);
      },
      async (error) => {
        this.logger.warn({ sandboxId, error }, 'Failed to return to idle pool');
        await this.deleteMetadata(sandboxId);
      },
    );

    this.logger.info('Sandbox released to idle pool');
  }

  private pauseJobId(sandboxId: string): string {
    return `pause:${sandboxId}`;
  }

  private async schedulePause(sandboxId: string): Promise<void> {
    const jobId = this.pauseJobId(sandboxId);

    await this.pauseQueue.add(
      'pause',
      { sandboxId },
      {
        delay: this.autoPauseDelayMs,
        jobId,
      },
    );

    this.logger.debug(
      { sandboxId, jobId, delayMs: this.autoPauseDelayMs },
      'Scheduled auto-pause job',
    );
  }

  private async cancelPause(sandboxId: string): Promise<void> {
    const jobId = this.pauseJobId(sandboxId);
    const job = await this.pauseQueue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.debug({ sandboxId, jobId }, 'Cancelled pending auto-pause job');
    }
  }

  private async deleteMetadata(sandboxId: string) {
    await guard.bestEffort(
      () => this.storage.deleteMetadata(sandboxId),
      (error) => this.logger.warn({ sandboxId, error }, 'Failed to delete metadata'),
    );
  }

  private async reconnect(sandboxId: string, context: ExecutionContext): Promise<ISandboxWrapper> {
    guard.ensure(!!sandboxId).orThrow(() => {
      this.logger.debug('No sandbox ID from idle queue (queue is empty)');
      return new SandboxCreationException('No idle sandbox available');
    });

    const metadata = await this.storage.loadMetadata(sandboxId);

    guard.ensure(!!metadata).orThrow(() => new SandboxCreationException('Metadata not found'));

    const onFailed = (failedSandboxId: string, error: Error) => {
      this.enqueueKill(failedSandboxId, `reconnect:${error.message.slice(0, 50)}`);
    };

    return guard(() => this.wrapperFactory.reconnect(context, metadata, onFailed)).orThrow(
      async (error) => {
        await this.deleteMetadata(sandboxId);
        return new SandboxCreationException(error);
      },
    );
  }

  /**
   * Enqueue async kill task for sandbox cleanup
   * Fire-and-forget pattern - does not block caller
   */
  private enqueueKill(sandboxId: string, label: string): void {
    this.killQueue
      .add('kill', { sandboxId, label }, { removeOnComplete: true, removeOnFail: true })
      .then(() => {
        this.logger.debug({ sandboxId, label }, 'Enqueued async kill task');
      })
      .catch((error) => {
        this.logger.warn({ sandboxId, label, error }, 'Failed to enqueue kill task');
      });
  }
}
