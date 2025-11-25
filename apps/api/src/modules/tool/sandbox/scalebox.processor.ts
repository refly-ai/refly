import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { storage, Store } from 'nestjs-pino/storage';

import { guard } from '../../../utils/guard';
import { QUEUE_SCALEBOX_EXECUTE, QUEUE_SCALEBOX_PAUSE } from '../../../utils/const';
import { Config } from '../../config/config.decorator';
import { ScaleboxService } from './scalebox.service';
import { ScaleboxStorage } from './scalebox.storage';
import { ScaleboxLock } from './scalebox.lock';
import { SandboxWrapper, SandboxMetadata } from './scalebox.wrapper';
import { SCALEBOX_DEFAULTS } from './scalebox.constants';
import {
  SandboxExecuteJobData,
  SandboxPauseJobData,
  ScaleboxExecutionResult,
  ExecutionContext,
} from './scalebox.dto';

// Note: @Processor decorator options are evaluated at compile-time, not runtime.
// Dynamic config via getWorkerOptions() is NOT supported by @nestjs/bullmq.
// Concurrency must be set directly in the decorator using static values.

/**
 * Sandbox Execution Processor
 *
 * Handles code execution jobs. Delegates to ScaleboxService.executeCode().
 * Concurrency controlled via SCALEBOX_DEFAULTS.LOCAL_CONCURRENCY.
 */
@Injectable()
@Processor(QUEUE_SCALEBOX_EXECUTE, {
  concurrency: SCALEBOX_DEFAULTS.LOCAL_CONCURRENCY,
})
export class ScaleboxExecuteProcessor extends WorkerHost {
  constructor(
    private readonly scaleboxService: ScaleboxService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(ScaleboxExecuteProcessor.name);
  }

  async process(job: Job<SandboxExecuteJobData>): Promise<ScaleboxExecutionResult> {
    const { params, context } = job.data;

    // Initialize AsyncLocalStorage context for non-HTTP worker
    return storage.run(new Store(this.logger.logger), async () => {
      this.logger.assign({ jobId: job.id, canvasId: context.canvasId, uid: context.uid });

      this.logger.debug('Processing execution job');

      const result = await this.scaleboxService.executeCode(params, context);

      this.logger.info({ exitCode: result.exitCode }, 'Execution completed');

      return result;
    });
  }
}

/**
 * Sandbox Pause Processor
 *
 * Handles auto-pause jobs for idle sandboxes (cost optimization).
 * Runs with concurrency=1 to avoid parallel pause operations.
 */
@Injectable()
@Processor(QUEUE_SCALEBOX_PAUSE, {
  concurrency: 5,
})
export class ScaleboxPauseProcessor extends WorkerHost {
  constructor(
    private readonly storage: ScaleboxStorage,
    private readonly lock: ScaleboxLock,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(ScaleboxPauseProcessor.name);
    void this.config;
  }

  @Config.string('sandbox.scalebox.apiKey', '')
  private scaleboxApiKey: string;

  async process(job: Job<SandboxPauseJobData>): Promise<void> {
    const { sandboxId } = job.data;

    // Initialize AsyncLocalStorage context for non-HTTP worker
    return storage.run(new Store(this.logger.logger), async () => {
      this.logger.assign({ jobId: job.id, sandboxId });

      this.logger.debug('Processing auto-pause job');

      const metadata = await this.storage.loadMetadata(sandboxId);
      if (!metadata) {
        this.logger.debug('Sandbox metadata not found, skipping pause');
        return;
      }

      if (metadata.isPaused) {
        this.logger.debug('Sandbox already paused, skipping');
        return;
      }

      await this.tryPauseSandbox(sandboxId, metadata);
    });
  }

  private async tryPauseSandbox(sandboxId: string, metadata: SandboxMetadata): Promise<void> {
    await guard.bestEffort(
      () =>
        guard.defer(
          () => this.acquirePauseLock(sandboxId),
          () => this.executePause(sandboxId, metadata),
        ),
      (error) => this.logger.debug({ sandboxId, error }, 'Skipped pause (sandbox in use or error)'),
    );
  }

  private async acquirePauseLock(
    sandboxId: string,
  ): Promise<readonly [undefined, () => Promise<void>]> {
    const release = await this.lock.trySandboxLock(sandboxId);
    return [undefined, release] as const;
  }

  private async executePause(_sandboxId: string, metadata: SandboxMetadata): Promise<void> {
    const context: ExecutionContext = {
      uid: '',
      apiKey: this.scaleboxApiKey,
      canvasId: '',
      s3DrivePath: '',
    };

    const wrapper = await SandboxWrapper.reconnect(this.logger, context, metadata);
    await wrapper.betaPause();
    wrapper.markAsPaused();
    await this.storage.saveMetadata(wrapper);
  }
}
