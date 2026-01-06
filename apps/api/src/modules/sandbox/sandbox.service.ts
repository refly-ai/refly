import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  User,
  SandboxExecuteRequest,
  SandboxExecuteResponse,
  DriveFile,
} from '@refly/openapi-schema';
import { SandboxClient } from './sandbox.client';
import { DriveService } from '../drive/drive.service';
import { SandboxExecutionContext, S3Config } from './sandbox.schema';
import { SandboxCanvasIdRequiredError } from './sandbox.exception';
import { SandboxResponseFactory } from './sandbox.response';
import { guard } from '@refly/utils';
import { Config } from '../config/config.decorator';
import { SANDBOX_TIMEOUTS } from './sandbox.constants';

interface ExecutionContext {
  uid: string;
  canvasId: string;
  s3DrivePath: string;
  parentResultId?: string;
  version?: number;
}

@Injectable()
export class SandboxService {
  @Config.integer('sandbox.timeout', SANDBOX_TIMEOUTS.DEFAULT)
  private readonly timeoutMs: number;

  @Config.object<S3Config>('objectStorage.minio.internal', (raw) => raw as S3Config)
  private readonly s3Config: S3Config;

  constructor(
    private readonly config: ConfigService,
    private readonly client: SandboxClient,
    private readonly driveService: DriveService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SandboxService.name);
    void this.config; // Suppress unused warning - used by @Config decorators
  }

  async execute(user: User, request: SandboxExecuteRequest): Promise<SandboxExecuteResponse> {
    const startTime = Date.now();

    try {
      const canvasId = guard
        .notEmpty(request.context?.canvasId)
        .orThrow(() => SandboxCanvasIdRequiredError.create());

      const storagePath = this.driveService.buildS3DrivePath(user.uid, canvasId);

      const context: SandboxExecutionContext = {
        uid: user.uid,
        canvasId: canvasId,
        s3Config: this.s3Config,
        s3DrivePath: storagePath,
        timeout: this.timeoutMs,
        parentResultId: request.context?.parentResultId,
        version: request.context?.version,
      };

      const workerResponse = await this.client.executeCode(request.params, context);

      let files: DriveFile[] = [];
      if (workerResponse.status === 'success' && workerResponse.data?.files?.length) {
        files = await this.registerFiles(
          {
            uid: user.uid,
            canvasId: canvasId,
            s3DrivePath: storagePath,
            parentResultId: request.context?.parentResultId,
            version: request.context?.version,
          },
          workerResponse.data.files.map((f) => f.name),
        );
      }

      const executionTime = Date.now() - startTime;

      return workerResponse.status === 'failed'
        ? SandboxResponseFactory.failed(workerResponse)
        : SandboxResponseFactory.success(workerResponse, files, executionTime);
    } catch (error) {
      this.logger.error({
        error: error.message,
        stack: error.stack,
        canvasId: request.context?.canvasId,
        uid: user.uid,
      });

      return SandboxResponseFactory.error(error);
    }
  }

  private async registerFiles(
    context: ExecutionContext,
    fileNames: string[],
  ): Promise<DriveFile[]> {
    this.logger.info({
      context,
      fileNames,
      filesCount: fileNames.length,
    });

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

    this.logger.info({
      context,
      filesCount: files.length,
      registered: true,
    });

    return files;
  }
}
