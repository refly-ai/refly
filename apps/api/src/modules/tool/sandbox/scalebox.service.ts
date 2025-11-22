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
import { ScaleboxExecutionResult, ExecutionContext } from './scalebox.dto';
import { formatError, buildSuccessResponse, extractErrorMessage } from './scalebox.utils';
import { SandboxPool } from './scalebox.pool';
import { SandboxWrapper, S3Config } from './scalebox.wrapper';
import { Trace } from './scalebox.tracer';
import {
  SCALEBOX_DEFAULT_MAX_LIFETIME_MS,
  S3_DEFAULT_CONFIG,
  REDIS_KEYS,
  LOCK_RETRY_CONFIG,
  LOCK_TTL_CONFIG,
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

    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScaleboxService.name);
  }

  @Config.string('sandbox.scalebox.apiKey', '')
  private scaleboxApiKey: string;

  @Config.object('objectStorage.minio.internal', S3_DEFAULT_CONFIG)
  private s3Config: S3Config;

  @Config.integer('sandbox.scalebox.maxLifetimeMs', SCALEBOX_DEFAULT_MAX_LIFETIME_MS)
  private maxLifetimeMs: number;

  private getExecuteLockKey(context: ExecutionContext): string {
    return `${REDIS_KEYS.LOCK_EXECUTE_PREFIX}:${context.uid}:${context.canvasId}`;
  }

  async executeCode(
    params: SandboxExecuteParams,
    context: ExecutionContext,
  ): Promise<ScaleboxExecutionResult> {
    guard
      .notEmpty(context.canvasId)
      .orThrow(() => new SandboxRequestParamsException('executeCode', 'canvasId is required'));

    return guard.defer(
      () => this.acquireExecuteLock(context),
      () =>
        guard.defer(
          () => this.sandboxPool.acquire(context, this.maxLifetimeMs),
          (wrapper) => this.executeWithMount(wrapper, params, context.s3DrivePath),
        ),
    );
  }

  private async acquireExecuteLock(context: ExecutionContext) {
    const lockKey = this.getExecuteLockKey(context);

    const timeout = LOCK_RETRY_CONFIG.EXECUTE_TIMEOUT_MS;
    const ttl = LOCK_TTL_CONFIG.EXECUTE_TTL_SEC;

    const releaseLock = await guard
      .retry(async () => this.redis.acquireLock(lockKey, ttl), {
        timeout,
        initialDelay: LOCK_RETRY_CONFIG.POLL_INTERVAL_MS,
        maxDelay: LOCK_RETRY_CONFIG.POLL_INTERVAL_MS,
        backoffFactor: 1,
      })
      .orThrow(() => new SandboxLockTimeoutException(lockKey, timeout));

    return [undefined, () => void releaseLock()] as const;
  }

  private async executeWithMount(
    wrapper: SandboxWrapper,
    params: SandboxExecuteParams,
    s3DrivePath: string,
  ): Promise<ScaleboxExecutionResult> {
    const sandboxId = wrapper.sandboxId;

    return guard.defer(
      async () => {
        await wrapper.mountDrive(s3DrivePath, this.s3Config, { allowNonEmpty: true });
        return [wrapper, () => wrapper.unmountDrive()] as const;
      },
      (wrapper) => this.runCodeInSandbox(wrapper, params),
      (error) => this.logger.warn({ sandboxId, error }, 'Failed to unmount drive'),
    );
  }

  @Trace('sandbox.runCode')
  private async runCodeInSandbox(
    wrapper: SandboxWrapper,
    params: SandboxExecuteParams,
  ): Promise<ScaleboxExecutionResult> {
    const startTime = Date.now();

    const previousFiles = await wrapper.listCwdFiles();
    const prevSet = new Set(previousFiles);

    const result = await wrapper.executeCode(params, this.logger);

    const currentFiles = await wrapper.listCwdFiles();
    const diffFiles = currentFiles
      .filter((file) => !prevSet.has(file))
      .map((p) => p.replace(wrapper.cwd, ''));

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
