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
import { SandboxExecutionContext, S3Config, S3LibConfig } from './sandbox.schema';
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

  @Config.boolean('sandbox.s3Lib.enabled', false)
  private readonly s3LibEnabled: boolean;

  @Config.string('sandbox.s3Lib.pathPrefix', '')
  private readonly s3LibPathPrefix: string;

  @Config.string('sandbox.s3Lib.hash', '')
  private readonly s3LibHash: string;

  @Config.boolean('sandbox.s3Lib.cache', true)
  private readonly s3LibCache: boolean;

  @Config.boolean('sandbox.s3Lib.reset', true)
  private readonly s3LibReset: boolean;

  @Config.boolean('sandbox.s3.overlap.enabled', false)
  private readonly s3OverlapEnabled: boolean;

  @Config.string('sandbox.s3.overlap.endpoint', '')
  private readonly s3OverlapEndpoint: string;

  @Config.integer('sandbox.s3.overlap.port', 0)
  private readonly s3OverlapPort: number;

  @Config.string('sandbox.anthropic.authToken', '')
  private readonly anthropicAuthToken: string;

  @Config.string('sandbox.anthropic.apiKey', '')
  private readonly anthropicApiKey: string;

  @Config.string('sandbox.anthropic.baseUrl', '')
  private readonly anthropicBaseUrl: string;

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
      const s3Config = this.buildS3Config();
      const s3LibConfig = this.buildS3LibConfig(s3Config);
      const requestEnv = (request.context as { env?: Record<string, string> } | undefined)?.env;
      const fixedEnv = {
        ...(this.anthropicAuthToken ? { ANTHROPIC_AUTH_TOKEN: this.anthropicAuthToken } : {}),
        ...(this.anthropicApiKey ? { ANTHROPIC_API_KEY: this.anthropicApiKey } : {}),
        ...(this.anthropicBaseUrl ? { ANTHROPIC_BASE_URL: this.anthropicBaseUrl } : {}),
      };
      const env = {
        ...requestEnv,
        ...fixedEnv,
        REFLY_EXECUTOR_SLIM_INVOKER: 'refly-api',
      };

      const context: SandboxExecutionContext = {
        uid: user.uid,
        canvasId: canvasId,
        s3Config,
        s3DrivePath: storagePath,
        s3LibConfig,
        env,
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

  private buildS3LibConfig(s3Config: S3Config): S3LibConfig | undefined {
    if (!this.s3LibEnabled || !this.s3LibPathPrefix || !this.s3LibHash) return undefined;

    const normalizedPrefix = this.s3LibPathPrefix.replace(/\/+$/, '');
    const endpoint = this.buildS3Endpoint(s3Config);

    return {
      ...(endpoint ? { endpoint } : {}),
      accessKey: s3Config.accessKey,
      secretKey: s3Config.secretKey,
      bucket: s3Config.bucket,
      region: s3Config.region,
      path: `${normalizedPrefix}/${this.s3LibHash}`,
      hash: this.s3LibHash,
      cache: this.s3LibCache,
      reset: this.s3LibReset,
    };
  }

  private buildS3Config(): S3Config {
    if (!this.s3OverlapEnabled) return this.s3Config;

    if (!this.s3OverlapEndpoint && !this.s3OverlapPort) {
      this.logger.warn({
        msg: 'sandbox.s3.overlap.enabled is true but no endpoint/port override provided',
      });
      return this.s3Config;
    }

    return {
      ...this.s3Config,
      ...(this.s3OverlapEndpoint ? { endPoint: this.s3OverlapEndpoint } : {}),
      ...(this.s3OverlapPort ? { port: this.s3OverlapPort } : {}),
    };
  }

  private buildS3Endpoint(
    s3Config: Partial<{ endPoint: string; port: number; useSSL: boolean }>,
  ): string {
    const endPoint = s3Config.endPoint;
    if (!endPoint) return '';
    if (endPoint.startsWith('http://') || endPoint.startsWith('https://')) {
      return endPoint;
    }

    const scheme = s3Config.useSSL ? 'https' : 'http';
    const port = s3Config.port;
    const includePort =
      port &&
      !Number.isNaN(port) &&
      !(scheme === 'http' && port === 80) &&
      !(scheme === 'https' && port === 443);

    return includePort ? `${scheme}://${endPoint}:${port}` : `${scheme}://${endPoint}`;
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
