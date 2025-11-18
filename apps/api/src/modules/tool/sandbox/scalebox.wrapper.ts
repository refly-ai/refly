import { Sandbox, type Language, type ExecutionResult } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { guard } from '../../../utils/guard';
import {
  SandboxCreationException,
  SandboxMountException,
  CodeExecutionException,
} from './scalebox.exception';
import { SANDBOX_MOUNT_POINT, SANDBOX_MOUNT_WAIT_MS } from './scalebox.constants';
import { sleep } from './scalebox.utils';

export interface S3Config {
  endpoint: string;
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
  s3Path: string;
}

/**
 * Build s3fs mount command with AWS credentials via environment variables
 * @param s3Config - S3 configuration
 * @param path - S3 path to mount
 * @param mountPoint - Local mount point path
 */
function buildS3MountCommand(s3Config: S3Config, path: string, mountPoint: string): string {
  const s3EndpointUrl = `https://${s3Config.endpoint}`;
  return `AWSACCESSKEYID=${s3Config.accessKey} \
AWSSECRETACCESSKEY=${s3Config.secretKey} \
s3fs ${s3Config.bucket}:/${path} ${mountPoint} \
-o url=${s3EndpointUrl} \
-o endpoint=${s3Config.region} \
-o use_path_request_style \
-o compat_dir`;
}

/**
 * SandboxWrapper encapsulates Sandbox SDK instance with lifecycle management
 * Handles health checks, timeout management, and state persistence
 */
export class SandboxWrapper {
  private constructor(
    private readonly sandbox: Sandbox,
    public readonly uid: string,
    public readonly sandboxId: string,
    public readonly canvasId: string,
    public readonly cwd: string,
    public readonly createdAt: number,
    private timeoutAt: number,
  ) {}

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
      context.uid,
      sandbox.sandboxId,
      context.canvasId,
      SANDBOX_MOUNT_POINT,
      Date.now(),
      info.timeoutAt.getTime(),
    );

    await wrapper.mountS3(context);

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
      metadata.uid,
      metadata.sandboxId,
      metadata.canvasId,
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

  private async mountS3(context: SandboxContext): Promise<void> {
    const { logger, s3Config, s3Path } = context;

    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const mountPoint = SANDBOX_MOUNT_POINT;

    logger.info({ canvasId: this.canvasId, mountPoint }, 'Mounting S3 storage');

    const mkdirResult = await guard(() => sandbox.commands.run(`mkdir -p ${mountPoint}`)).orThrow(
      (e) => new SandboxMountException(e, this.canvasId),
    );

    if (mkdirResult.exitCode !== 0)
      throw new SandboxMountException(mkdirResult.stderr, this.canvasId);

    const mountCmd = buildS3MountCommand(s3Config, s3Path, mountPoint);

    const mountResult = await guard(() => sandbox.commands.run(mountCmd)).orThrow(
      (e) => new SandboxMountException(e, this.canvasId),
    );

    if (mountResult.exitCode !== 0)
      throw new SandboxMountException(mountResult.stderr, this.canvasId);

    await sleep(SANDBOX_MOUNT_WAIT_MS);

    logger.info({ canvasId: this.canvasId, mountPoint }, 'S3 storage mounted successfully');
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

  async executeCode(code: string, language: Language): Promise<ExecutionResult> {
    return guard(() =>
      this.sandbox.runCode(code, {
        language,
        cwd: this.cwd,
      }),
    ).orThrow((e) => new CodeExecutionException(e));
  }

  async listCwdFiles(): Promise<string[]> {
    return this.sandbox.files.list(this.cwd).then((files) => files.map((file) => file.name));
  }

  toMetadata(): SandboxMetadata {
    return {
      uid: this.uid,
      sandboxId: this.sandboxId,
      canvasId: this.canvasId,
      cwd: this.cwd,
      createdAt: this.createdAt,
      timeoutAt: this.timeoutAt,
    };
  }
}
