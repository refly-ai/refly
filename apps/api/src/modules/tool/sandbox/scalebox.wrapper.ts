import { Sandbox, type ExecutionResult } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteParams } from '@refly/openapi-schema';

import { guard } from '../../../utils/guard';
import { poll } from './scalebox.utils';
import { Trace, Measure, setSpanAttributes } from './scalebox.tracer';

import {
  SandboxCreationException,
  SandboxMountException,
  CodeExecutionException,
  SandboxFileListException,
} from './scalebox.exception';
import {
  SANDBOX_DRIVE_MOUNT_POINT,
  SANDBOX_MOUNT_MAX_RETRIES,
  SANDBOX_MOUNT_RETRY_DELAY_MS,
  SANDBOX_MOUNT_VERIFICATION_TIMEOUT_MS,
  SANDBOX_MOUNT_VERIFICATION_INITIAL_DELAY_MS,
  SANDBOX_MOUNT_VERIFICATION_MAX_DELAY_MS,
  SANDBOX_MOUNT_VERIFICATION_BACKOFF_FACTOR,
} from './scalebox.constants';

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

  @Trace('sandbox.create', { 'operation.type': 'cold_start' })
  static async create(context: SandboxContext, timeoutMs: number): Promise<SandboxWrapper> {
    setSpanAttributes({
      'sandbox.canvasId': context.canvasId,
      'sandbox.uid': context.uid,
      'sandbox.timeoutMs': timeoutMs,
    });

    context.logger.info({ canvasId: context.canvasId }, 'Creating sandbox');

    const sandbox = await SandboxWrapper.createSandboxInstance(context, timeoutMs);

    setSpanAttributes({ 'sandbox.id': sandbox.sandboxId });

    const wrapper = new SandboxWrapper(
      sandbox,
      context,
      SANDBOX_DRIVE_MOUNT_POINT,
      Date.now(),
      Date.now() + timeoutMs,
    );

    await wrapper.mountDrive();

    context.logger.info(
      { sandboxId: wrapper.sandboxId, canvasId: context.canvasId },
      'Sandbox created successfully',
    );

    return wrapper;
  }

  @Trace('sandbox.sdk.create')
  private static async createSandboxInstance(
    context: SandboxContext,
    timeoutMs: number,
  ): Promise<Sandbox> {
    return guard(() =>
      Sandbox.create('code-interpreter', {
        apiKey: context.apiKey,
        timeoutMs,
      }),
    ).orThrow((e) => new SandboxCreationException(e));
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
  @Trace('sandbox.mount')
  private async mountDrive(): Promise<void> {
    const { logger, s3Config, s3DrivePath, canvasId } = this.context;
    const mountPoint = SANDBOX_DRIVE_MOUNT_POINT;

    setSpanAttributes({
      'mount.point': mountPoint,
      'mount.path': s3DrivePath,
      'mount.canvasId': canvasId,
    });

    logger.info({ canvasId, mountPoint, path: s3DrivePath }, 'Mounting drive storage');

    await this.createMountPoint(mountPoint);
    await this.mountS3FileSystem(s3Config, s3DrivePath, mountPoint);
    await this.waitForMountReady();

    logger.info({ canvasId, mountPoint }, 'Drive storage mounted successfully');
  }

  @Trace('mount.mkdir')
  private async createMountPoint(mountPoint: string): Promise<void> {
    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const result = await guard(() => sandbox.commands.run(`mkdir -p ${mountPoint}`)).orThrow(
      (e) => new SandboxMountException(e, this.context.canvasId),
    );

    if (result.exitCode !== 0) {
      throw new SandboxMountException(result.stderr, this.context.canvasId);
    }
  }

  @Trace('mount.s3fs')
  private async mountS3FileSystem(
    s3Config: S3Config,
    s3DrivePath: string,
    mountPoint: string,
  ): Promise<void> {
    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const mountCmd = buildS3MountCommand(s3Config, s3DrivePath, mountPoint);

    const result = await guard
      .retry(() => sandbox.commands.run(mountCmd), {
        maxAttempts: SANDBOX_MOUNT_MAX_RETRIES,
        delayMs: SANDBOX_MOUNT_RETRY_DELAY_MS,
      })
      .orThrow((e) => new SandboxMountException(e, this.context.canvasId));

    if (result.exitCode !== 0) {
      throw new SandboxMountException(result.stderr, this.context.canvasId);
    }
  }

  private async runCommand(command: string): Promise<void> {
    const result = await guard(() => this.sandbox.commands.run(command)).orElse(() =>
      Promise.resolve({ exitCode: 1, stdout: '', stderr: 'Command failed' }),
    );

    if (result.exitCode !== 0) {
      throw new SandboxMountException(result.stderr, this.context.canvasId);
    }
  }

  @Trace('mount.wait')
  private async waitForMountReady(): Promise<void> {
    await poll(
      async () =>
        guard(() => this.runCommand(`test -d ${SANDBOX_DRIVE_MOUNT_POINT}`)).orElse(() => null),
      async () => {
        throw new SandboxMountException(
          `Mount verification timeout after ${SANDBOX_MOUNT_VERIFICATION_TIMEOUT_MS}ms`,
          this.context.canvasId,
        );
      },
      {
        timeout: SANDBOX_MOUNT_VERIFICATION_TIMEOUT_MS,
        initialDelay: SANDBOX_MOUNT_VERIFICATION_INITIAL_DELAY_MS,
        maxDelay: SANDBOX_MOUNT_VERIFICATION_MAX_DELAY_MS,
        backoffFactor: SANDBOX_MOUNT_VERIFICATION_BACKOFF_FACTOR,
      },
    );
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

  @Trace('sandbox.executeCode', { 'operation.type': 'code_execution' })
  async executeCode(params: SandboxExecuteParams, logger: PinoLogger): Promise<ExecutionResult> {
    setSpanAttributes({
      'code.language': params.language,
      'code.length': params.code.length,
      'sandbox.id': this.sandboxId,
      'sandbox.canvasId': this.context.canvasId,
    });

    logger.info(
      {
        sandboxId: this.sandboxId,
        canvasId: this.context.canvasId,
        language: params.language,
        s3DrivePath: this.context.s3DrivePath,
      },
      'Executing code in sandbox',
    );

    return this.runCode(params);
  }

  @Trace('code.execution')
  private async runCode(params: SandboxExecuteParams): Promise<ExecutionResult> {
    return guard(() =>
      this.sandbox.runCode(params.code, {
        language: params.language,
        cwd: this.cwd,
      }),
    ).orThrow((e) => new CodeExecutionException(e));
  }

  @Trace('sandbox.listFiles')
  async listCwdFiles(): Promise<string[]> {
    const files = await this.listFiles();
    setSpanAttributes({ 'files.count': files.length });
    return files;
  }

  @Measure('files.list')
  private async listFiles(): Promise<string[]> {
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
