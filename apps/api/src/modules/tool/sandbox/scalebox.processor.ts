import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { QUEUE_SCALEBOX_EXECUTE, QUEUE_SCALEBOX_PAUSE } from '../../../utils/const';
import { Config } from '../../config/config.decorator';
import { ScaleboxService } from './scalebox.service';
import { ScaleboxStorage } from './scalebox.storage';
import { ScaleboxLock } from './scalebox.lock';
import { SandboxWrapper, SandboxMetadata } from './scalebox.wrapper';
import {
  SandboxExecuteJobData,
  SandboxPauseJobData,
  ScaleboxExecutionResult,
  ExecutionContext,
} from './scalebox.dto';
import { SCALEBOX_DEFAULTS } from './scalebox.constants';

/**
 * Sandbox Execution Processor
 *
 * Handles code execution jobs. Delegates to ScaleboxService.executeCode().
 * Concurrency controlled via localConcurrency config.
 */
@Injectable()
@Processor(QUEUE_SCALEBOX_EXECUTE, {
  concurrency: 1, // Will be overridden by getWorkerOptions
})
export class ScaleboxExecuteProcessor extends WorkerHost {
  constructor(
    private readonly scaleboxService: ScaleboxService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(ScaleboxExecuteProcessor.name);
    void this.config;
  }

  @Config.integer('sandbox.scalebox.localConcurrency', SCALEBOX_DEFAULTS.LOCAL_CONCURRENCY)
  private localConcurrency: number;

  getWorkerOptions() {
    return {
      concurrency: this.localConcurrency,
    };
  }

  async process(job: Job<SandboxExecuteJobData>): Promise<ScaleboxExecutionResult> {
    const { params, context } = job.data;

    this.logger.info(
      { jobId: job.id, canvasId: context.canvasId, uid: context.uid },
      'Processing sandbox execution job',
    );

    const result = await this.scaleboxService.executeCode(params, context);

    this.logger.info(
      { jobId: job.id, canvasId: context.canvasId, exitCode: result.exitCode },
      'Sandbox execution job completed',
    );

    return result;
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

    this.logger.info({ jobId: job.id, sandboxId }, 'Processing auto-pause job');

    const metadata = await this.storage.loadMetadata(sandboxId);
    if (!metadata) {
      this.logger.info({ sandboxId }, 'Sandbox metadata not found, skipping pause');
      return;
    }

    if (metadata.isPaused) {
      this.logger.info({ sandboxId }, 'Sandbox already paused, skipping');
      return;
    }

    await this.tryPauseSandbox(sandboxId, metadata);
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

  private async executePause(sandboxId: string, metadata: SandboxMetadata): Promise<void> {
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

    this.logger.info({ sandboxId }, 'Sandbox paused successfully');
  }
}
