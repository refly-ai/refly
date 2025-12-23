import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
import { runModuleInitWithTimeoutAndRetry } from '@refly/utils';

import { guard } from '../../../utils/guard';
import { QUEUE_SCALEBOX_EXECUTE } from '../../../utils/const';
import { Config } from '../../config/config.decorator';
import { DriveService } from '../../drive/drive.service';
import { SandboxRequestParamsException, QueueOverloadedException } from './scalebox.exception';
import {
  ScaleboxExecutionResult,
  ExecutionContext,
  SandboxExecuteJobData,
  ScaleboxResponseFactory,
  ExecutorOutput,
} from './scalebox.dto';
import { extractErrorMessage } from './scalebox.utils';
import { SandboxPool } from './scalebox.pool';
import { ISandboxWrapper } from './wrapper/base';
import { S3Config } from './scalebox.dto';
import { Trace } from '@refly/observability';
import {
  S3_DEFAULT_CONFIG,
  SCALEBOX_DEFAULTS,
  CODE_SIZE_THRESHOLD,
  EXECUTOR_LIMITS_DEFAULTS,
  ExecutorLimits,
} from './scalebox.constants';
import { ScaleboxLock } from './scalebox.lock';

/**
 * Scalebox Service
 * Execute code in a secure sandbox environment using custom executor template
 */
@Injectable()
export class ScaleboxService implements OnModuleInit, OnModuleDestroy {
  private queueEvents: QueueEvents;

  constructor(
    private readonly config: ConfigService, // Used by @Config decorators
    private readonly lock: ScaleboxLock,
    private readonly driveService: DriveService,
    private readonly sandboxPool: SandboxPool,
    private readonly logger: PinoLogger,
    @InjectQueue(QUEUE_SCALEBOX_EXECUTE)
    private readonly sandboxQueue: Queue<SandboxExecuteJobData>,
  ) {
    this.logger.setContext(ScaleboxService.name);
    void this.config; // Suppress unused warning - used by @Config decorators
  }

  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      () => {
        this.queueEvents = new QueueEvents(QUEUE_SCALEBOX_EXECUTE, {
          connection: this.sandboxQueue.opts.connection,
        });
        this.logger.debug('QueueEvents initialized');
      },
      {
        logger: this.logger,
        label: 'ScaleboxService.onModuleInit',
      },
    );
  }

  async onModuleDestroy() {
    await this.queueEvents?.close();
    this.logger.debug('QueueEvents closed');
  }

  @Config.string('sandbox.scalebox.apiKey', '')
  private scaleboxApiKey: string;

  @Config.object('objectStorage.minio.internal', S3_DEFAULT_CONFIG)
  private s3Config: S3Config;

  @Config.integer('sandbox.scalebox.maxQueueSize', SCALEBOX_DEFAULTS.MAX_QUEUE_SIZE)
  private maxQueueSize: number;

  @Config.integer('sandbox.scalebox.codeSizeThreshold', CODE_SIZE_THRESHOLD)
  private codeSizeThreshold: number;

  @Config.object('sandbox.scalebox.limits', EXECUTOR_LIMITS_DEFAULTS)
  private executorLimits: ExecutorLimits;

  private async acquireSandboxWrapper(
    context: ExecutionContext,
  ): Promise<readonly [ISandboxWrapper, () => Promise<void>]> {
    const wrapper = await this.sandboxPool.acquire(context);
    return [wrapper, () => this.sandboxPool.release(wrapper)] as const;
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

      const executionTime = Date.now() - startTime;

      return ScaleboxResponseFactory.success(executionResult, executionTime);
    } catch (error) {
      this.logger.error({ error }, 'Sandbox execution failed');
      return ScaleboxResponseFactory.error(error, Date.now() - startTime);
    }
  }

  async executeCode(
    params: SandboxExecuteParams,
    context: ExecutionContext,
  ): Promise<ScaleboxExecutionResult> {
    guard
      .notEmpty(context.canvasId)
      .orThrow(() => new SandboxRequestParamsException('executeCode', 'canvasId is required'));

    // Simplified to 2-layer defer (removed mount and files management)
    return guard.defer(
      () => this.lock.acquireExecuteLock(context.uid, context.canvasId),
      () =>
        guard.defer(
          () => this.acquireSandboxWrapper(context),
          (wrapper) =>
            guard.defer(
              () => this.lock.acquireSandboxLock(wrapper.sandboxId),
              () => this.runCodeInSandbox(wrapper, params, context),
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
    wrapper: ISandboxWrapper,
    params: SandboxExecuteParams,
    context: ExecutionContext,
  ): Promise<ScaleboxExecutionResult> {
    const timeoutMs = this.lock.runCodeTimeoutMs;

    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        canvasId: context.canvasId,
        language: params.language,
        codeLength: params.code?.length,
      },
      '[runCodeInSandbox] Starting execution',
    );

    // Execute code via executor binary
    const executorOutput: ExecutorOutput = await wrapper.executeCode(params, {
      logger: this.logger,
      timeoutMs,
      s3Config: this.s3Config,
      s3DrivePath: context.s3DrivePath,
      limits: this.executorLimits,
      codeSizeThreshold: this.codeSizeThreshold,
    });

    // Log full executor output for debugging
    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        exitCode: executorOutput.exitCode,
        hasStdout: !!executorOutput.stdout,
        stdoutLength: executorOutput.stdout?.length,
        hasStderr: !!executorOutput.stderr,
        stderrLength: executorOutput.stderr?.length,
        hasError: !!executorOutput.error,
        hasDiff: !!executorOutput.diff,
        diffAdded: executorOutput.diff?.added,
        diffAddedLength: executorOutput.diff?.added?.length,
        executorLog: executorOutput.log?.split('\n').filter(Boolean),
      },
      '[runCodeInSandbox] Executor output received',
    );

    // Register files created during execution
    const addedFiles = executorOutput.diff?.added || [];
    this.logger.info(
      { sandboxId: wrapper.sandboxId, addedFiles, addedFilesCount: addedFiles.length },
      '[runCodeInSandbox] Files to register',
    );

    const files = await this.registerFiles(context, addedFiles);

    // Extract error message from executor output
    const errorMessage = extractErrorMessage(executorOutput);

    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        exitCode: executorOutput.exitCode ?? 0,
        errorMessage,
        registeredFilesCount: files.length,
      },
      '[runCodeInSandbox] Execution completed',
    );

    return {
      executorOutput,
      error: errorMessage,
      exitCode: executorOutput.exitCode ?? 0,
      files,
    };
  }

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

    const job = await this.sandboxQueue.add('execute', {
      params,
      context,
    });

    this.logger.info(
      { jobId: job.id, canvasId: context.canvasId, uid: context.uid },
      'Added sandbox execution job to queue',
    );

    return await job.waitUntilFinished(this.queueEvents);
  }
}
