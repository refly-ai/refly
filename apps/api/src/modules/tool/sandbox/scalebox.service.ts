import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import {
  User,
  SandboxExecuteRequest,
  SandboxExecuteResponse,
  SandboxExecuteParams,
  DriveFile,
} from '@refly/openapi-schema';

import { buildResponse } from '../../../utils';
import { guard } from '../../../utils/guard';
import { QUEUE_SANDBOX } from '../../../utils/const';
import { Config } from '../../config/config.decorator';
import { DriveService } from '../../drive/drive.service';
import { SandboxRequestParamsException, QueueOverloadedException } from './scalebox.exception';
import { ScaleboxExecutionResult, ExecutionContext, SandboxExecuteJobData } from './scalebox.dto';
import {
  formatError,
  buildSuccessResponse,
  extractErrorMessage,
  checkCriticalError,
} from './scalebox.utils';
import { SandboxPool } from './scalebox.pool';
import { ScaleboxStorage } from './scalebox.storage';
import { SandboxWrapper, S3Config } from './scalebox.wrapper';
import { Trace } from './scalebox.tracer';
import { S3_DEFAULT_CONFIG, SCALEBOX_DEFAULTS } from './scalebox.constants';
import { ScaleboxLock } from './scalebox.lock';

/**
 * Scalebox Service
 * Execute code in a secure sandbox environment using Scalebox provider
 */
@Injectable()
export class ScaleboxService {
  constructor(
    private readonly config: ConfigService, // Used by @Config decorators
    private readonly storage: ScaleboxStorage,
    private readonly lock: ScaleboxLock,
    private readonly driveService: DriveService,
    private readonly sandboxPool: SandboxPool,
    private readonly logger: PinoLogger,
    @InjectQueue(QUEUE_SANDBOX)
    private readonly sandboxQueue: Queue<SandboxExecuteJobData>,
  ) {
    this.logger.setContext(ScaleboxService.name);
    void this.config; // Suppress unused warning - used by @Config decorators
  }

  @Config.string('sandbox.scalebox.apiKey', '')
  private scaleboxApiKey: string;

  @Config.object('objectStorage.minio.internal', S3_DEFAULT_CONFIG)
  private s3Config: S3Config;

  @Config.integer('sandbox.scalebox.autoPauseDelayMs', SCALEBOX_DEFAULTS.AUTO_PAUSE_DELAY_MS)
  private autoPauseDelayMs: number;

  @Config.integer('sandbox.scalebox.maxQueueSize', SCALEBOX_DEFAULTS.MAX_QUEUE_SIZE)
  private maxQueueSize: number;

  private async acquireSandboxWrapper(
    context: ExecutionContext,
  ): Promise<readonly [SandboxWrapper, () => Promise<void>]> {
    const wrapper = await this.sandboxPool.acquire(context);
    return [wrapper, () => this.sandboxPool.release(wrapper)] as const;
  }

  private async acquireMountDrive(
    wrapper: SandboxWrapper,
    context: ExecutionContext,
  ): Promise<readonly [undefined, () => Promise<void>]> {
    await wrapper.mountDrive(context.s3DrivePath, this.s3Config, { allowNonEmpty: true });
    return [undefined, () => wrapper.unmountDrive()] as const;
  }

  private async acquireRegisterFiles(
    wrapper: SandboxWrapper,
    context: ExecutionContext,
  ): Promise<readonly [Set<string>, () => Promise<void>]> {
    const previousFiles = await wrapper.listCwdFiles();
    const prevSet = new Set(previousFiles);

    this.logger.info({ context, previousFiles }, 'Previous files');

    return [
      prevSet,
      async () => {
        const currentFiles = await wrapper.listCwdFiles();
        const diffFiles = currentFiles
          .filter((file) => !prevSet.has(file))
          .map((p) => p.replace(wrapper.cwd, ''));

        this.logger.info({ context, diffFiles }, 'Diff files');

        context.registeredFiles = await this.registerFiles(context, diffFiles);
      },
    ] as const;
  }

  async execute(user: User, request: SandboxExecuteRequest): Promise<SandboxExecuteResponse> {
    const startTime = Date.now();

    try {
      const canvasId = guard
        .notEmpty(request.context?.canvasId)
        .orThrow(() => new SandboxRequestParamsException('execute', 'canvasId is required'));

      const apiKey = guard
        .notEmpty(this.scaleboxApiKey)
        .orThrow(() => new SandboxRequestParamsException('execute', 'apiKey is not configured'));

      const storagePath = this.driveService.buildS3DrivePath(user.uid, canvasId);

      const executionResult = await this.executeViaQueue(request.params, {
        uid: user.uid,
        apiKey,
        canvasId,
        s3DrivePath: storagePath,
        version: request.context?.version,
        parentResultId: request.context?.parentResultId,
      });

      const { originResult, files } = executionResult;

      const executionTime = Date.now() - startTime;

      return buildSuccessResponse(originResult?.text || '', files, executionResult, executionTime);
    } catch (error) {
      this.logger.error(error, 'Sandbox execution failed');
      return buildResponse<SandboxExecuteResponse>(false, { data: null }, formatError(error));
    }
  }

  async executeCode(
    params: SandboxExecuteParams,
    context: ExecutionContext,
  ): Promise<ScaleboxExecutionResult> {
    guard
      .notEmpty(context.canvasId)
      .orThrow(() => new SandboxRequestParamsException('executeCode', 'canvasId is required'));

    return guard.defer(
      () => this.lock.acquireExecuteLock(context.uid, context.canvasId),
      () =>
        guard.defer(
          () => this.acquireSandboxWrapper(context),
          (wrapper) =>
            guard.defer(
              () => this.lock.acquireSandboxLock(wrapper.sandboxId),
              () =>
                guard.defer(
                  () => this.acquireMountDrive(wrapper, context),
                  () => this.runCodeInSandbox(wrapper, params, context),
                  (error) =>
                    this.logger.warn(
                      { sandboxId: wrapper.sandboxId, error },
                      'Failed to unmount drive',
                    ),
                ),
            ),
        ),
    );
  }

  private async registerFiles(
    context: ExecutionContext,
    fileNames: string[],
  ): Promise<DriveFile[]> {
    this.logger.info({ context, fileNames }, 'Registering files');

    if (fileNames.length === 0) return [];

    const user = { uid: context.uid } as User;

    const files = await this.driveService.batchCreateDriveFiles(user, {
      canvasId: context.canvasId,
      files: fileNames.map((name: string) => ({
        canvasId: context.canvasId,
        name,
        source: 'agent' as const,
        storageKey: `${context.s3DrivePath}/${name}`,
        resultId: context.parentResultId,
        resultVersion: context.version,
      })),
    });

    this.logger.info({ context, fileNames, files }, 'Registered files');

    return files;
  }

  @Trace('sandbox.runCodeInSandbox')
  private async runCodeInSandbox(
    wrapper: SandboxWrapper,
    params: SandboxExecuteParams,
    context: ExecutionContext,
  ): Promise<ScaleboxExecutionResult> {
    const result = await guard.defer(
      () => this.acquireRegisterFiles(wrapper, context),
      () => this.executeDefenseCriticalError(wrapper, params),
      (error) => this.logger.error({ error }, 'Failed to register files'),
    );

    const errorMessage = extractErrorMessage(result);

    return {
      originResult: result,
      error: errorMessage,
      exitCode: result.exitCode,
      files: context.registeredFiles ?? [],
    };
  }

  private async executeDefenseCriticalError(wrapper: SandboxWrapper, params: SandboxExecuteParams) {
    const timeoutMs = this.lock.runCodeTimeoutMs;

    return guard(() => wrapper.executeCode(params, { logger: this.logger, timeoutMs })).orElse(
      async (error) => {
        this.logger.error({ error }, 'Defense critical error');

        const sandboxId = wrapper.sandboxId;

        // Check if error indicates critical sandbox failure that requires kill
        const result = checkCriticalError(error);
        if (result.isCritical) {
          this.logger.warn(
            { sandboxId, stderr: result.stderr },
            'Critical sandbox error detected, killing sandbox',
          );
          await guard.bestEffort(
            () => wrapper.kill(),
            (error) => this.logger.warn({ sandboxId, error }, 'Failed to kill sandbox'),
          );
        }

        throw error;
      },
    );
  }

  /**
   * TODO: use mq or cron job to auto-pause idle sandboxes
   * Schedule auto-pause for idle sandbox (cost optimization strategy)
   * Non-blocking: scheduled in background, errors are logged but don't affect caller
   */
  // private scheduleAutoPause(sandboxId: string): void {
  //   this.logger.info(
  //     {
  //       sandboxId,
  //       autoPauseInMinutes: this.autoPauseDelayMs / 60000,
  //     },
  //     'Scheduling auto-pause for idle sandbox',
  //   );

  //   setTimeout(
  //     () =>
  //       guard.bestEffort(
  //         () => this.tryAutoPause(sandboxId),
  //         (error) => this.logger.warn({ sandboxId, error }, 'Failed to auto-pause sandbox'),
  //       ),
  //     this.autoPauseDelayMs,
  //   );
  // }

  /**
   * Attempt to auto-pause an idle sandbox
   * Tries to acquire sandbox lock once, skips if lock is held
   */
  // private async tryAutoPause(sandboxId: string): Promise<void> {
  //   this.logger.info({ sandboxId }, 'Attempting to auto-pause sandbox');

  //   const metadata = await this.storage.loadMetadata(sandboxId);
  //   if (!metadata) {
  //     this.logger.info({ sandboxId }, 'Sandbox metadata not found, skipping auto-pause');
  //     return;
  //   }

  //   if (metadata.isPaused) {
  //     this.logger.info({ sandboxId }, 'Sandbox already paused, skipping auto-pause');
  //     return;
  //   }

  //   const idleDuration = Date.now() - metadata.idleSince;

  //   if (idleDuration < this.autoPauseDelayMs) {
  //     this.logger.info(
  //       { sandboxId, idleSeconds: (idleDuration / 1000).toFixed(1) },
  //       'Sandbox not idle long enough, skipping auto-pause',
  //     );
  //     return;
  //   }

  //   await guard.bestEffort(
  //     async () => {
  //       await guard.defer(
  //         async () => {
  //           const releaseLock = await this.lock.trySandboxLock(sandboxId);
  //           return [undefined, releaseLock] as const;
  //         },
  //         async () => {
  //           const context: ExecutionContext = {
  //             uid: '',
  //             apiKey: this.scaleboxApiKey,
  //             canvasId: '',
  //             s3DrivePath: '',
  //           };

  //           const wrapper = await SandboxWrapper.reconnect(this.logger, context, metadata);

  //           const info = await wrapper.getInfo();
  //           this.logger.info(
  //             { sandboxId, status: info.status, idleMinutes: (idleDuration / 60000).toFixed(1) },
  //             'Starting auto-pause for idle sandbox',
  //           );
  //           await wrapper.betaPause();
  //           wrapper.markAsPaused();
  //           await this.storage.saveMetadata(wrapper);
  //         },
  //       );
  //     },
  //     (error) => this.logger.warn({ sandboxId, error }, 'Failed to auto-pause sandbox'),
  //   );
  // }

  private async executeViaQueue(
    params: SandboxExecuteParams,
    context: ExecutionContext,
  ): Promise<ScaleboxExecutionResult> {
    if (this.maxQueueSize > 0) {
      const queueSize = await this.sandboxQueue.count();
      guard.ensure(queueSize < this.maxQueueSize).orThrow(() => {
        this.logger.warn(
          {
            queueSize,
            maxQueueSize: this.maxQueueSize,
            canvasId: context.canvasId,
          },
          'Sandbox queue is full, rejecting request',
        );
        return new QueueOverloadedException(queueSize, this.maxQueueSize);
      });
    }

    return guard.defer(
      () => this.acquireQueueEvents(),
      async (queueEvents) => {
        const job = await this.sandboxQueue.add('execute', {
          params,
          context,
        });

        this.logger.info(
          {
            jobId: job.id,
            canvasId: context.canvasId,
            uid: context.uid,
          },
          'Added sandbox execution job to queue',
        );

        return await job.waitUntilFinished(queueEvents);
      },
    );
  }

  private async acquireQueueEvents(): Promise<readonly [QueueEvents, () => Promise<void>]> {
    const queueEvents = new QueueEvents(QUEUE_SANDBOX, {
      connection: this.sandboxQueue.opts.connection,
    });
    return [queueEvents, () => queueEvents.close()] as const;
  }
}
