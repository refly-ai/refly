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
import { DriveService } from '../../drive/drive.service';
import {
  MissingApiKeyException,
  MissingCanvasIdException,
  SandboxExecutionFailedException,
} from './scalebox.exception';
import { ScaleboxExecutionResult, ExecutionContext } from './scalebox.dto';
import { formatError, buildSuccessResponse, extractErrorMessage } from './scalebox.utils';
import { SandboxPool } from './scalebox.pool';
import { SandboxWrapper } from './scalebox.wrapper';

/**
 * Scalebox Service
 * Execute code in a secure sandbox environment using Scalebox provider
 */
@Injectable()
export class ScaleboxService {
  constructor(
    private readonly config: ConfigService, // Used by @Config decorators
    private readonly driveService: DriveService,
    private readonly sandboxPool: SandboxPool,

    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScaleboxService.name);
  }

  @Config.string('sandbox.scalebox.apiKey', '')
  private scaleboxApiKey: string;

  async executeCode(
    params: SandboxExecuteParams,
    context: ExecutionContext,
  ): Promise<ScaleboxExecutionResult> {
    guard.notEmpty(context.canvasId).orThrow(() => new MissingCanvasIdException());

    const wrapper = await this.sandboxPool.acquire(context);

    return await guard.defer(
      () => this.runCodeInSandbox(wrapper, params),
      () => this.releaseSandbox(wrapper),
    );
  }

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

  private async releaseSandbox(wrapper: SandboxWrapper): Promise<void> {
    this.logger.info({ sandboxId: wrapper.sandboxId }, 'Releasing sandbox to pool');

    await guard.bestEffort(
      () => this.sandboxPool.release(wrapper),
      (error) => this.logger.warn(error, 'Failed to release sandbox after execution'),
    );

    this.logger.info({ sandboxId: wrapper.sandboxId }, 'Sandbox release completed');
  }

  async execute(user: User, request: SandboxExecuteRequest): Promise<SandboxExecuteResponse> {
    try {
      const canvasId = guard
        .notEmpty(request.context?.canvasId)
        .orThrow(() => new MissingCanvasIdException());

      const apiKey = guard
        .notEmpty(this.scaleboxApiKey)
        .orThrow(() => new MissingApiKeyException());

      const executionResult = await this.executeCode(request.params, {
        uid: user.uid,
        apiKey,
        canvasId,
        version: request.context?.version,
      });

      const { exitCode, error, originResult, files = [] } = executionResult;

      const storagePath = this.driveService.buildS3DrivePath(user.uid, canvasId);

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
