import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { storage, Store } from 'nestjs-pino/storage';

import { guard } from '../../../utils/guard';
import {
  QUEUE_SCALEBOX_EXECUTE,
  QUEUE_SCALEBOX_PAUSE,
  QUEUE_SCALEBOX_KILL,
} from '../../../utils/const';
import { Config } from '../../config/config.decorator';
import { ScaleboxService } from './scalebox.service';
import { ScaleboxStorage } from './scalebox.storage';
import { ScaleboxLock } from './scalebox.lock';
import { Sandbox } from '@scalebox/sdk';
import { SandboxWrapper, SandboxMetadata } from './scalebox.wrapper';
import { SCALEBOX_DEFAULTS } from './scalebox.constants';
import {
  SandboxExecuteJobData,
  SandboxPauseJobData,
  SandboxKillJobData,
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

      try {
        const result = await this.scaleboxService.executeCode(params, context);
        this.logger.info({ exitCode: result.exitCode }, 'Execution completed');
        return result;
      } catch (error) {
        // System errors - let BullMQ handle them
        // Code errors (non-zero exit code) are returned as normal result, not thrown
        this.logger.error(error, 'Execution failed');
        throw error;
      }
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sandbox Kill Processor
 *
 * Handles async kill tasks for sandbox cleanup.
 * Uses retry logic to ensure sandboxes are properly terminated.
 */
@Injectable()
@Processor(QUEUE_SCALEBOX_KILL, {
  concurrency: 10,
})
export class ScaleboxKillProcessor extends WorkerHost {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(ScaleboxKillProcessor.name);
    void this.config;
  }

  @Config.string('sandbox.scalebox.apiKey', '')
  private scaleboxApiKey: string;

  async process(job: Job<SandboxKillJobData>): Promise<void> {
    const { sandboxId, label } = job.data;

    return storage.run(new Store(this.logger.logger), async () => {
      this.logger.assign({ jobId: job.id, sandboxId, label });
      this.logger.debug('Processing kill job');

      const result = await this.safeKill(sandboxId);

      if (result.success) {
        this.logger.info(
          { attempts: result.attempts, durationMs: result.durationMs },
          'Sandbox killed successfully',
        );
      } else {
        this.logger.error(
          { attempts: result.attempts, durationMs: result.durationMs, error: result.error },
          'Failed to kill sandbox after retries',
        );
      }
    });
  }

  private async safeKill(sandboxId: string): Promise<{
    success: boolean;
    attempts: number;
    durationMs: number;
    error?: string;
  }> {
    const { KILL_RETRY_MAX_ATTEMPTS, KILL_RETRY_INTERVAL_MS } = SCALEBOX_DEFAULTS;
    const start = Date.now();
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= KILL_RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        const sandbox = await Sandbox.connect(sandboxId, { apiKey: this.scaleboxApiKey });
        await sandbox.kill();

        return {
          success: true,
          attempts: attempt,
          durationMs: Date.now() - start,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.debug(
          { sandboxId, attempt, maxAttempts: KILL_RETRY_MAX_ATTEMPTS, error: lastError },
          'Kill attempt failed',
        );

        if (attempt < KILL_RETRY_MAX_ATTEMPTS) {
          await sleep(KILL_RETRY_INTERVAL_MS);
        }
      }
    }

    return {
      success: false,
      attempts: KILL_RETRY_MAX_ATTEMPTS,
      durationMs: Date.now() - start,
      error: lastError,
    };
  }
}
