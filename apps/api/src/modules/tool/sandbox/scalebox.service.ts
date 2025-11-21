import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  User,
  SandboxExecuteRequest,
  SandboxExecuteResponse,
  DriveFileCategory,
  SandboxExecuteParams,
} from '@refly/openapi-schema';

import { buildResponse } from '../../../utils';
import { guard } from '../../../utils/guard';
import { Config } from '../../config/config.decorator';
import { RedisService } from '../../common/redis.service';
import { DriveService } from '../../drive/drive.service';
import {
  SandboxRequestParamsException,
  SandboxExecutionFailedException,
  SandboxLockTimeoutException,
} from './scalebox.exception';
import { MEDIA_TYPES } from '../constant';
import { ToolExecutionSync } from '../common/decorators/tool-execution-sync.decorator';
import { ToolExecutionSyncInterceptor } from '../common/interceptors/tool-execution-sync.interceptor';
import { ScaleboxExecutionResult, ExecutionContext } from './scalebox.dto';
import { formatError, buildSuccessResponse, extractErrorMessage } from './scalebox.utils';
import { SandboxPool } from './scalebox.pool';
import { SandboxWrapper } from './scalebox.wrapper';
import { Trace, setSpanAttributes } from './scalebox.tracer';
import {
  SCALEBOX_DEFAULT_LOCK_WAIT_TIMEOUT_MS,
  SCALEBOX_DEFAULT_LOCK_POLL_INTERVAL_MS,
} from './scalebox.constants';

/**
 * Scalebox Service
 * Execute code in a secure sandbox environment using Scalebox provider
 */
@Injectable()
export class ScaleboxService {
  constructor(
    private readonly config: ConfigService, // Used by @Config decorators
    private readonly redis: RedisService,
    private readonly driveService: DriveService,
    private readonly sandboxPool: SandboxPool,
    private readonly toolExecutionSync: ToolExecutionSyncInterceptor,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScaleboxService.name);
  }

  @Config.string('sandbox.scalebox.apiKey', '')
  private scaleboxApiKey: string;

  @Config.integer('sandbox.scalebox.lockWaitTimeoutMs', SCALEBOX_DEFAULT_LOCK_WAIT_TIMEOUT_MS)
  private lockWaitTimeoutMs: number;

  @Config.integer('sandbox.scalebox.lockPollIntervalMs', SCALEBOX_DEFAULT_LOCK_POLL_INTERVAL_MS)
  private lockPollIntervalMs: number;

  async executeCode(
    params: SandboxExecuteParams,
    context: ExecutionContext,
  ): Promise<ScaleboxExecutionResult> {
    guard
      .notEmpty(context.canvasId)
      .orThrow(() => new SandboxRequestParamsException('executeCode', 'canvasId is required'));

    const lockKey = `scalebox:execute:lock:${context.uid}:${context.canvasId}`;

    return guard.defer(
      async () => {
        const releaseLock = await this.waitForLock(lockKey);
        return [undefined, () => void releaseLock()] as const;
      },
      () => this.executeCodeWithSandbox(params, context),
      (error) => this.logger.warn(error, 'Failed to release lock'),
    );
  }

  private async waitForLock(lockKey: string) {
    return guard
      .retry(
        async () => {
          const releaseLock = await this.redis.acquireLock(lockKey);
          guard.ensure(!!releaseLock).orThrow(() => new Error('Lock not acquired'));
          return releaseLock;
        },
        {
          timeout: this.lockWaitTimeoutMs,
          initialDelay: this.lockPollIntervalMs,
          maxDelay: this.lockPollIntervalMs,
          backoffFactor: 1,
        },
      )
      .orThrow(() => new SandboxLockTimeoutException(lockKey, this.lockWaitTimeoutMs));
  }

  private async executeCodeWithSandbox(
    params: SandboxExecuteParams,
    context: ExecutionContext,
  ): Promise<ScaleboxExecutionResult> {
    return guard.defer(
      async () => {
        const wrapper = await this.sandboxPool.acquire(context);
        return [wrapper, () => this.sandboxPool.release(wrapper)] as const;
      },
      (wrapper) => this.executeWithMount(wrapper, params, context.s3DrivePath),
      (error) => this.logger.warn(error, 'Failed to release sandbox'),
    );
  }

  private async executeWithMount(
    wrapper: SandboxWrapper,
    params: SandboxExecuteParams,
    s3DrivePath: string,
  ): Promise<ScaleboxExecutionResult> {
    return guard.defer(
      async () => {
        await wrapper.mountDrive(s3DrivePath, { allowNonEmpty: true });
        return [wrapper, () => wrapper.unmountDrive()] as const;
      },
      (wrapper) => this.runCodeInSandbox(wrapper, params),
      (error) => this.logger.warn(error, 'Failed to unmount drive'),
    );
  }

  @Trace('sandbox.runCode')
  private async runCodeInSandbox(
    wrapper: SandboxWrapper,
    params: SandboxExecuteParams,
  ): Promise<ScaleboxExecutionResult> {
    const startTime = Date.now();

    const previousFiles = await wrapper.listCwdFiles();
    setSpanAttributes({ 'files.before.count': previousFiles.length });
    const prevSet = new Set(previousFiles);

    const result = await wrapper.executeCode(params, this.logger);
    setSpanAttributes({
      'code.exitCode': result.exitCode,
      'code.hasError': result.exitCode !== 0,
    });

    const currentFiles = await wrapper.listCwdFiles();
    const diffFiles = currentFiles
      .filter((file) => !prevSet.has(file))
      .map((p) => p.replace(wrapper.cwd, ''));

    setSpanAttributes({
      'files.after.count': currentFiles.length,
      'files.new.count': diffFiles.length,
    });

    const executionTime = Date.now() - startTime;
    const errorMessage = extractErrorMessage(result);

    return {
      originResult: result,
      error: errorMessage,
      exitCode: result.exitCode,
      executionTime,
      files: diffFiles,
    };
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
        .notEmpty(request.context?.canvasId)
        .orThrow(() => new SandboxRequestParamsException('execute', 'canvasId is required'));

      const apiKey = guard
        .notEmpty(this.scaleboxApiKey)
        .orThrow(() => new SandboxRequestParamsException('execute', 'apiKey is not configured'));

      const storagePath = this.driveService.buildS3DrivePath(user.uid, canvasId);

      const executionResult = await this.executeCode(request.params, {
        uid: user.uid,
        apiKey,
        canvasId,
        s3DrivePath: storagePath,
        version: request.context?.version,
      });

      const { exitCode, error, originResult, files = [] } = executionResult;

      this.logger.info(
        {
          userId: user.uid,
          canvasId,
          parentResultId: request.context?.parentResultId,
          version: request.context?.version,
          files,
          count: files.length,
          storagePath,
        },
        '[Sandbox] Registering generated files to database',
      );

      const processedFiles = await guard(() =>
        this.driveService.batchCreateDriveFiles(user, {
          canvasId,
          files: files.map((name: string) => ({
            canvasId,
            name,
            source: 'agent',
            storageKey: `${storagePath}/${name}`,
            resultId: request.context?.parentResultId,
            resultVersion: request.context?.version,
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
          parentResultId: request.context?.parentResultId,
          version: request.context?.version,
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
