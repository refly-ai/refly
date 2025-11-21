import { Sandbox, type ExecutionResult } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteParams } from '@refly/openapi-schema';

import { guard } from '../../../utils/guard';

import {
  SandboxCreationException,
  SandboxMountException,
  CodeExecutionException,
  SandboxFileListException,
} from './scalebox.exception';
import {
  SANDBOX_DRIVE_MOUNT_POINT,
  SANDBOX_MOUNT_WAIT_MS,
  SANDBOX_MOUNT_MAX_RETRIES,
  SANDBOX_MOUNT_RETRY_DELAY_MS,
} from './scalebox.constants';
import { sleep } from './scalebox.utils';

export interface S3Config {
  endPoint: string; // MinIO SDK uses 'endPoint' with capital P
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export interface SandboxMetadata {
  sandboxId: string;
  canvasId: string;
  uid: string;
  cwd: string;
  createdAt: number;
  timeoutAt: number;
}

export interface SandboxContext {
  logger: PinoLogger;
  canvasId: string;
  uid: string;
  apiKey: string;
  s3Config: S3Config;
  s3DrivePath: string; // S3 path for drive files (user uploaded files + generated files): drive/{uid}/{canvasId}/
}

/**
 * Build s3fs mount command with AWS credentials via environment variables
 * @param s3Config - S3 configuration
 * @param path - S3 path to mount
 * @param mountPoint - Local mount point path
 * @param options - Mount options (e.g., readOnly, allowNonEmpty)
 */
function buildS3MountCommand(
  s3Config: S3Config,
  path: string,
  mountPoint: string,
  options?: { readOnly?: boolean; allowNonEmpty?: boolean },
): string {
  const s3EndpointUrl = `https://${s3Config.endPoint}`;
  const readOnlyFlag = options?.readOnly ? '-o ro' : '';
  const nonemptyFlag = options?.allowNonEmpty ? '-o nonempty' : '';
  return `AWSACCESSKEYID=${s3Config.accessKey} \
AWSSECRETACCESSKEY=${s3Config.secretKey} \
s3fs ${s3Config.bucket}:/${path} ${mountPoint} \
-o url=${s3EndpointUrl} \
-o endpoint=${s3Config.region} \
-o use_path_request_style \
-o compat_dir \
${readOnlyFlag} \
${nonemptyFlag}`.trim();
}

/**
 * SandboxWrapper encapsulates Sandbox SDK instance with lifecycle management
 * Handles health checks, timeout management, and state persistence
 */
export class SandboxWrapper {
  public readonly context: SandboxContext;

  private constructor(
    private readonly sandbox: Sandbox,
    context: SandboxContext,
    public readonly cwd: string,
    public readonly createdAt: number,
    private timeoutAt: number,
  ) {
    this.context = context;
  }

  get sandboxId(): string {
    return this.sandbox.sandboxId;
  }

  get canvasId(): string {
    return this.context.canvasId;
  }

  static async create(context: SandboxContext, timeoutMs: number): Promise<SandboxWrapper> {
    context.logger.info({ canvasId: context.canvasId }, 'Creating sandbox');

    const sandbox = await guard(() =>
      Sandbox.create('code-interpreter', {
        apiKey: context.apiKey,
        timeoutMs,
      }),
    ).orThrow((e) => new SandboxCreationException(e));

    const info = await sandbox.getInfo();

    const wrapper = new SandboxWrapper(
      sandbox,
      context,
      SANDBOX_DRIVE_MOUNT_POINT,
      Date.now(),
      info.timeoutAt.getTime(),
    );

    // Mount drive (read-write, contains user uploaded files and generated files)
    await wrapper.mountDrive();

    context.logger.info(
      { sandboxId: wrapper.sandboxId, canvasId: context.canvasId },
      'Sandbox created successfully',
    );

    return wrapper;
  }

  static async reconnect(
    context: SandboxContext,
    metadata: SandboxMetadata,
  ): Promise<SandboxWrapper | null> {
    context.logger.info({ sandboxId: metadata.sandboxId }, 'Reconnecting to sandbox');

    const sandbox = await guard(() =>
      Sandbox.connect(metadata.sandboxId, { apiKey: context.apiKey }),
    ).orElse((error) => {
      context.logger.warn(
        {
          sandboxId: metadata.sandboxId,
          error: (error as Error).message,
        },
        'Failed to reconnect sandbox',
      );
      return null;
    });

    if (!sandbox) return null;

    const wrapper = new SandboxWrapper(
      sandbox,
      context,
      metadata.cwd,
      metadata.createdAt,
      metadata.timeoutAt,
    );

    if (!(await wrapper.isHealthy())) {
      context.logger.warn({ sandboxId: metadata.sandboxId }, 'Sandbox is not healthy');
      return null;
    }

    context.logger.info({ sandboxId: metadata.sandboxId }, 'Reconnected to sandbox');

    return wrapper;
  }

  /**
   * Mount drive storage (read-write)
   * Contains user uploaded files and generated files
   */
  private async mountDrive(): Promise<void> {
    const { logger, s3Config, s3DrivePath, canvasId } = this.context;

    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const mountPoint = SANDBOX_DRIVE_MOUNT_POINT;

    logger.info({ canvasId, mountPoint, path: s3DrivePath }, 'Mounting drive storage');

    const mkdirResult = await guard(() => sandbox.commands.run(`mkdir -p ${mountPoint}`)).orThrow(
      (e) => new SandboxMountException(e, canvasId),
    );

    if (mkdirResult.exitCode !== 0) throw new SandboxMountException(mkdirResult.stderr, canvasId);

    const mountCmd = buildS3MountCommand(s3Config, s3DrivePath, mountPoint);

    const mountResult = await guard
      .retry(() => sandbox.commands.run(mountCmd), {
        maxAttempts: SANDBOX_MOUNT_MAX_RETRIES,
        delayMs: SANDBOX_MOUNT_RETRY_DELAY_MS,
      })
      .orThrow((e) => new SandboxMountException(e, canvasId));

    if (mountResult.exitCode !== 0) throw new SandboxMountException(mountResult.stderr, canvasId);

    await sleep(SANDBOX_MOUNT_WAIT_MS);

    logger.info({ canvasId, mountPoint }, 'Drive storage mounted successfully');
  }

  async isHealthy(): Promise<boolean> {
    if (!(await this.sandbox.isRunning())) {
      return false;
    }

    const info = await this.sandbox.getInfo();
    if (info.status !== 'running' && info.status !== 'paused') {
      return false;
    }

    return true;
  }

  async extendTimeout(ms: number): Promise<void> {
    await this.sandbox.setTimeout(ms);
    const info = await this.sandbox.getInfo();
    this.timeoutAt = info.timeoutAt.getTime();
  }

  getRemainingTime(): number {
    return this.timeoutAt - Date.now();
  }

  getTimeoutAt(): number {
    return this.timeoutAt;
  }

  getSandbox(): Sandbox {
    return this.sandbox;
  }

  async executeCode(params: SandboxExecuteParams, logger: PinoLogger): Promise<ExecutionResult> {
    logger.info(
      {
        sandboxId: this.sandboxId,
        canvasId: this.context.canvasId,
        language: params.language,
        s3DrivePath: this.context.s3DrivePath,
      },
      'Executing code in sandbox',
    );

    return guard(() =>
      this.sandbox.runCode(params.code, {
        language: params.language,
        cwd: this.cwd,
      }),
    ).orThrow((e) => new CodeExecutionException(e));
  }

  async listCwdFiles(): Promise<string[]> {
    return guard(() =>
      this.sandbox.files.list(this.cwd).then((files) => files.map((file) => file.name)),
    ).orThrow((error) => new SandboxFileListException(error));
  }

  toMetadata(): SandboxMetadata {
    return {
      uid: this.context.uid,
      sandboxId: this.sandboxId,
      canvasId: this.context.canvasId,
      cwd: this.cwd,
      createdAt: this.createdAt,
      timeoutAt: this.timeoutAt,
    };
  }
}
