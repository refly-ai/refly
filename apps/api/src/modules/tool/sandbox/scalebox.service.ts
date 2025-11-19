import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  User,
  SandboxExecuteRequest,
  SandboxExecuteResponse,
  DriveFileCategory,
} from '@refly/openapi-schema';
import { Queue, QueueEvents } from 'bullmq';
import type { Language, ExecutionResult } from '@scalebox/sdk';

import { buildResponse } from '../../../utils';
import { guard } from '../../../utils/guard';
import { Config } from '../../config/config.decorator';
import { DriveService } from '../../drive/drive.service';
import {
  MissingApiKeyException,
  MissingCanvasIdException,
  QueueUnavailableException,
  QueueOverloadedException,
  SandboxExecutionFailedException,
} from './scalebox.exception';
import { MEDIA_TYPES } from '../common/constant/media-types';
import { ToolExecutionSync } from '../common/decorators/tool-execution-sync.decorator';
import { ToolExecutionSyncInterceptor } from '../common/interceptors/tool-execution-sync.interceptor';
import {
  SCALEBOX_EXECUTION_QUEUE,
  SCALEBOX_DEFAULT_TIMEOUT,
  SCALEBOX_DEFAULT_MAX_QUEUE_SIZE,
  ERROR_MESSAGE_MAX_LENGTH,
} from './scalebox.constants';
import stripAnsi from 'strip-ansi';
import { ScaleboxExecutionJobData, ScaleboxExecutionResult } from './scalebox.dto';
import { formatError, buildSuccessResponse } from './scalebox.utils';
import { SandboxPool } from './scalebox.pool';
import { SandboxWrapper } from './scalebox.wrapper';

/**
 * Scalebox Service
 * Execute code in a secure sandbox environment using Scalebox provider
 */
@Injectable()
export class ScaleboxService implements OnModuleInit, OnModuleDestroy {
  private queueEvents?: QueueEvents;
  private queueEventsReady = false;

  constructor(
    private readonly config: ConfigService, // Used by @Config decorators
    private readonly driveService: DriveService,
    private readonly sandboxPool: SandboxPool,
    private readonly toolExecutionSync: ToolExecutionSyncInterceptor,
    private readonly logger: PinoLogger,
    @Optional()
    @InjectQueue(SCALEBOX_EXECUTION_QUEUE)
    private readonly executionQueue?: Queue<ScaleboxExecutionJobData, ScaleboxExecutionResult>,
  ) {
    this.logger.setContext(ScaleboxService.name);

    // Create QueueEvents for job result listening if queue is available
    if (this.executionQueue) {
      this.queueEvents = new QueueEvents(SCALEBOX_EXECUTION_QUEUE, {
        connection: this.executionQueue.opts.connection,
      });
    }
  }

  @Config.string('sandbox.scalebox.apiKey', '')
  private scaleboxApiKey: string;

  @Config.integer('sandbox.scalebox.maxQueueSize', SCALEBOX_DEFAULT_MAX_QUEUE_SIZE)
  private maxQueueSize: number;

  @Config.integer('sandbox.scalebox.timeout', SCALEBOX_DEFAULT_TIMEOUT)
  private timeout: number;

  async onModuleInit() {
    // Wait for QueueEvents to be ready before accepting requests
    if (this.queueEvents) {
      try {
        await this.queueEvents.waitUntilReady();
        this.queueEventsReady = true;
        this.logger.info('QueueEvents ready for sandbox execution');
      } catch (error) {
        this.logger.error(error, 'Failed to initialize QueueEvents');
        this.queueEventsReady = false;
      }
    }
  }

  async onModuleDestroy() {
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
  }

  async executeCode(params: {
    code: string;
    language: Language;
    apiKey: string;
    canvasId: string;
    uid: string;
    version?: number;
  }): Promise<ScaleboxExecutionResult> {
    const canvasId = guard.notEmpty(params.canvasId).orThrow(() => new MissingCanvasIdException());

    const wrapper = await this.sandboxPool.acquire(params.uid, canvasId, params.apiKey);

    return await guard.defer(
      () =>
        this.runCodeInSandbox(wrapper, {
          code: params.code,
          language: params.language,
          uid: params.uid,
          canvasId: params.canvasId,
          version: params.version,
        }),
      () => this.releaseSandbox(wrapper),
    );
  }

  private async runCodeInSandbox(
    wrapper: SandboxWrapper,
    params: { code: string; language: Language; uid: string; canvasId: string; version?: number },
  ): Promise<ScaleboxExecutionResult> {
    const startTime = Date.now();

    // Build S3 path for this execution using DriveService
    const drivePath = this.driveService.buildS3DrivePath(params.uid, params.canvasId);

    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        canvasId: wrapper.canvasId,
        uid: params.uid,
        version: params.version,
        language: params.language,
        s3DrivePath: drivePath,
      },
      '[Sandbox] Executing code in sandbox',
    );

    const previousFiles = await wrapper.listCwdFiles();
    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        canvasId: wrapper.canvasId,
        uid: params.uid,
        version: params.version,
        previousFiles,
        count: previousFiles.length,
      },
      '[Sandbox] Previous files in sandbox before execution',
    );
    const prevSet = new Set(previousFiles);

    const result = await wrapper.executeCode(params.code, params.language, this.logger);
    const currentFiles = await wrapper.listCwdFiles();
    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        canvasId: wrapper.canvasId,
        uid: params.uid,
        version: params.version,
        currentFiles,
        count: currentFiles.length,
      },
      '[Sandbox] Current files in sandbox after execution',
    );
    const diffFiles = currentFiles
      .filter((file) => !prevSet.has(file))
      .map((p) => p.replace(wrapper.cwd, ''));
    this.logger.info(
      {
        sandboxId: wrapper.sandboxId,
        canvasId: wrapper.canvasId,
        uid: params.uid,
        version: params.version,
        diffFiles,
        count: diffFiles.length,
        previousCount: previousFiles.length,
        currentCount: currentFiles.length,
      },
      '[Sandbox] Diff: New files generated in this execution',
    );

    const executionTime = Date.now() - startTime;

    const errorMessage = this.extractErrorMessage(result);

    this.logger.info(
      {
        executionTime,
        exitCode: result.exitCode,
        hasError: !!errorMessage,
        hasStderr: !!result.stderr,
        files: diffFiles,
        s3DrivePath: drivePath,
      },
      'Code execution completed',
    );

    return {
      originResult: result,
      error: errorMessage,
      exitCode: result.exitCode,
      executionTime,
      files: diffFiles,
    };
  }

  private async releaseSandbox(wrapper: SandboxWrapper): Promise<void> {
    this.logger.info({ sandboxId: wrapper.sandboxId }, 'Releasing sandbox to pool');

    await guard.bestEffort(
      () => this.sandboxPool.release(wrapper),
      (error) => this.logger.warn(error, 'Failed to release sandbox after execution'),
    );

    this.logger.info({ sandboxId: wrapper.sandboxId }, 'Sandbox release completed');
  }

  private truncateErrorMessage(message: string): string {
    // Strip ANSI escape codes for better readability in JSON responses
    const cleanMessage = stripAnsi(message);

    if (cleanMessage.length <= ERROR_MESSAGE_MAX_LENGTH) {
      return cleanMessage;
    }
    return `${cleanMessage.slice(0, ERROR_MESSAGE_MAX_LENGTH)}[... more info]`;
  }

  private extractErrorMessage(result: ExecutionResult): string {
    if (result.error?.traceback) return this.truncateErrorMessage(result.error.traceback);
    if (result.error?.message) return this.truncateErrorMessage(result.error.message);
    if (result.stderr) return this.truncateErrorMessage(result.stderr);
    if (result.exitCode !== 0 && result.stdout) return this.truncateErrorMessage(result.stdout);
    return '';
  }

  @ToolExecutionSync({
    resultType: MEDIA_TYPES.DOC,
    getParentResultId: (req) => req.parentResultId,
    getTitle: (req) => `sandbox-execute-${req.language}`,
    getModel: (req) => req.model,
    getProviderItemId: (req) => req.providerItemId,
    createCanvasNode: true,
    updateWorkflowNode: true,
    getMetadata: (_req, result) => ({
      output: result?.data?.output,
      exitCode: result?.data?.exitCode,
      executionTime: result?.data?.executionTime,
    }),
  })
  async execute(user: User, request: SandboxExecuteRequest): Promise<SandboxExecuteResponse> {
    try {
      const canvasId = guard
        .notEmpty(request.canvasId)
        .orThrow(() => new MissingCanvasIdException());

      const apiKey = guard
        .notEmpty(this.scaleboxApiKey)
        .orThrow(() => new MissingApiKeyException());

      const maxQueueSize = this.maxQueueSize;
      const timeout = this.timeout;

      this.logger.info(
        {
          userId: user.uid,
          canvasId,
          language: request.language,
        },
        'Executing sandbox code',
      );

      guard.ensure(!!this.executionQueue).orThrow(() => new QueueUnavailableException());
      guard
        .ensure(!!this.queueEvents && this.queueEventsReady)
        .orThrow(() => new QueueUnavailableException('QueueEvents is not ready'));

      const waitingCount = await this.executionQueue.getWaitingCount();

      guard
        .ensure(waitingCount < maxQueueSize)
        .orThrow(() => new QueueOverloadedException(waitingCount, maxQueueSize));

      const job = await this.executionQueue.add(
        'execute',
        {
          uid: user.uid,
          code: request.code,
          language: request.language,
          timeout: request.timeout,
          canvasId,
          apiKey,
          version: request.version,
        },
        {
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      this.logger.info(
        {
          jobId: job.id,
          queueSize: waitingCount + 1,
        },
        'Sandbox job queued',
      );

      this.logger.info(
        {
          jobId: job.id,
          timeout,
          queueEventsReady: this.queueEventsReady,
        },
        'Waiting for job to finish',
      );

      const executionResult = await job.waitUntilFinished(this.queueEvents, timeout);

      this.logger.info(
        {
          jobId: job.id,
          exitCode: executionResult?.exitCode,
        },
        'Job finished successfully',
      );

      const { exitCode, error, originResult, files = [] } = executionResult;

      const storagePath = this.driveService.buildS3DrivePath(user.uid, canvasId);

      this.logger.info(
        {
          userId: user.uid,
          canvasId,
          parentResultId: request.parentResultId,
          version: request.version,
          files,
          count: files.length,
          storagePath,
        },
        '[Sandbox] Registering generated files to database',
      );

      const processedFiles = await guard(() =>
        this.driveService.batchCreateDriveFiles(user, {
          files: files.map((name) => ({
            canvasId,
            name,
            source: 'agent',
            storageKey: `${storagePath}/${name}`,
            resultId: request.parentResultId,
            resultVersion: request.version,
          })),
        }),
      ).orThrow((error) => new SandboxExecutionFailedException(error, exitCode));

      const formattedFiles = processedFiles.map((file) => ({
        fileId: file.fileId,
        canvasId: file.canvasId,
        name: file.name,
        type: file.type,
        category: file.category as DriveFileCategory,
      }));

      this.logger.info(
        {
          userId: user.uid,
          canvasId,
          parentResultId: request.parentResultId,
          version: request.version,
          registeredFiles: formattedFiles.map((f) => ({ fileId: f.fileId, name: f.name })),
          count: formattedFiles.length,
        },
        '[Sandbox] Successfully registered files to database',
      );

      guard
        .ensure(exitCode === 0)
        .orThrow(() => new SandboxExecutionFailedException(error, exitCode));

      return buildSuccessResponse(originResult?.text || '', formattedFiles, executionResult);
    } catch (error) {
      this.logger.error(error, 'Sandbox execution failed');
      return buildResponse<SandboxExecuteResponse>(false, { data: null }, formatError(error));
    }
  }
}
