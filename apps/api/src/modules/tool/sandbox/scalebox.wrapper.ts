import { Sandbox, type ExecutionResult } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteParams } from '@refly/openapi-schema';

import { guard } from '../../../utils/guard';
import { Trace } from './scalebox.tracer';

import {
  SandboxCreationException,
  SandboxExecutionFailedException,
  SandboxConnectionException,
  SandboxExecutionBadResultException,
  SandboxRunCodeException,
  SandboxFileListException,
  SandboxAcquireException,
} from './scalebox.exception';
import { SANDBOX_DRIVE_MOUNT_POINT, SCALEBOX_DEFAULTS } from './scalebox.constants';
import { ExecutionContext, OnLifecycleFailed } from './scalebox.dto';

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
  cwd: string;
  createdAt: number;
  idleSince: number;
  isPaused?: boolean; // Whether the sandbox is currently paused
  lastPausedAt?: number; // Timestamp of last pause operation
}

export interface ExecuteCodeContext {
  logger: PinoLogger;
  timeoutMs: number;
}

const S3FS_PASSWD_FILE = '/tmp/s3fs_passwd';

const COMMAND_BUILDER = {
  mountS3: (
    s3Config: S3Config,
    path: string,
    mountPoint: string,
    options?: { readOnly?: boolean; allowNonEmpty?: boolean },
  ): string => {
    const passwdContent = `${s3Config.accessKey}:${s3Config.secretKey}`;
    const s3EndpointUrl = `https://${s3Config.endPoint}`;
    const optionalFlags = [
      options?.readOnly ? '-o ro' : '',
      options?.allowNonEmpty ? '-o nonempty' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const s3fsCmd = [
      `s3fs ${s3Config.bucket}:/${path} ${mountPoint}`,
      `-o url=${s3EndpointUrl}`,
      `-o endpoint=${s3Config.region}`,
      `-o passwd_file=${S3FS_PASSWD_FILE}`,
      '-o use_path_request_style',
      '-o compat_dir',
      optionalFlags,
    ]
      .filter(Boolean)
      .join(' ');

    // Subshell: mkdir → create passwd file → run s3fs → cleanup → return original exit code
    return `(mkdir -p ${mountPoint} && echo "${passwdContent}" > ${S3FS_PASSWD_FILE} && chmod 600 ${S3FS_PASSWD_FILE}; ${s3fsCmd}; ret=$?; rm -f ${S3FS_PASSWD_FILE}; exit $ret)`;
  },
};

export class SandboxWrapper {
  private isPaused = false;
  private lastPausedAt?: number;
  private _idleSince: number;

  private constructor(
    private readonly sandbox: Sandbox,
    private readonly logger: PinoLogger,
    public readonly context: ExecutionContext,
    public readonly cwd: string,
    public readonly createdAt: number,
    idleSince: number,
  ) {
    this._idleSince = idleSince;
    this.logger.setContext(SandboxWrapper.name);
  }

  get idleSince(): number {
    return this._idleSince;
  }

  get sandboxId(): string {
    return this.sandbox.sandboxId;
  }

  get canvasId(): string {
    return this.context.canvasId;
  }

  toMetadata(): SandboxMetadata {
    return {
      sandboxId: this.sandboxId,
      cwd: this.cwd,
      createdAt: this.createdAt,
      idleSince: this.idleSince,
      isPaused: this.isPaused,
      lastPausedAt: this.lastPausedAt,
    };
  }

  markAsPaused(): void {
    this.isPaused = true;
    this.lastPausedAt = Date.now();
  }

  markAsRunning(): void {
    this.isPaused = false;
  }

  markAsIdle(): void {
    this._idleSince = Date.now();
  }

  async getInfo() {
    return this.sandbox.getInfo();
  }

  @Trace('sandbox.pause')
  async betaPause(): Promise<void> {
    await guard.bestEffort(
      () =>
        guard
          .retry(
            async () => {
              this.logger.debug({ sandboxId: this.sandboxId }, 'Triggering sandbox pause');
              await this.sandbox.betaPause();
              this.logger.info({ sandboxId: this.sandboxId }, 'Sandbox paused');
            },
            {
              maxAttempts: SCALEBOX_DEFAULTS.PAUSE_RETRY_MAX_ATTEMPTS,
              initialDelay: SCALEBOX_DEFAULTS.PAUSE_RETRY_DELAY_MS,
              maxDelay: SCALEBOX_DEFAULTS.PAUSE_RETRY_DELAY_MS,
              backoffFactor: 1,
            },
          )
          .orThrow(),
      (error) => this.logger.error({ sandboxId: this.sandboxId, error }, 'Failed to pause sandbox'),
    );
  }

  /**
   * Inner function for create - throws SandboxAcquireException on failure
   */
  private static async createInner(
    logger: PinoLogger,
    context: ExecutionContext,
    timeoutMs: number,
  ): Promise<SandboxWrapper> {
    logger.info({ canvasId: context.canvasId }, 'Creating sandbox');

    const sandbox = await guard(() =>
      Sandbox.create('code-interpreter', {
        apiKey: context.apiKey,
        timeoutMs,
      }),
    ).orThrow((err) => new SandboxAcquireException(err));

    const now = Date.now();
    const wrapper = new SandboxWrapper(
      sandbox,
      logger,
      context,
      SANDBOX_DRIVE_MOUNT_POINT,
      now,
      now,
    );

    const isReady = await guard(() => wrapper.healthCheck()).orThrow(
      (err) => new SandboxAcquireException(err, wrapper.sandboxId),
    );

    guard
      .ensure(isReady)
      .orThrow(
        () =>
          new SandboxAcquireException(
            `Sandbox ${wrapper.sandboxId} failed health check after creation`,
            wrapper.sandboxId,
          ),
      );

    logger.info({ sandboxId: wrapper.sandboxId, canvasId: context.canvasId }, 'Sandbox created');

    return wrapper;
  }

  /**
   * Inner function for reconnect - throws SandboxAcquireException on failure
   */
  private static async reconnectInner(
    logger: PinoLogger,
    context: ExecutionContext,
    metadata: SandboxMetadata,
  ): Promise<SandboxWrapper> {
    logger.info({ sandboxId: metadata.sandboxId }, 'Reconnecting to sandbox');

    const sandbox = await guard(() =>
      Sandbox.connect(metadata.sandboxId, { apiKey: context.apiKey }),
    ).orThrow((err) => new SandboxAcquireException(err, metadata.sandboxId));

    const wrapper = new SandboxWrapper(
      sandbox,
      logger,
      context,
      metadata.cwd,
      metadata.createdAt,
      metadata.idleSince,
    );

    // Restore pause state from metadata
    if (metadata.isPaused) {
      wrapper.isPaused = true;
      wrapper.lastPausedAt = metadata.lastPausedAt;
    }

    const isReady = await guard(() => wrapper.healthCheck()).orThrow(
      (err) => new SandboxAcquireException(err, wrapper.sandboxId),
    );

    guard
      .ensure(isReady)
      .orThrow(
        () =>
          new SandboxAcquireException(
            `Sandbox ${wrapper.sandboxId} failed health check after reconnect`,
            wrapper.sandboxId,
          ),
      );

    logger.info({ sandboxId: metadata.sandboxId }, 'Reconnected to sandbox');

    return wrapper;
  }

  @Trace('sandbox.create', { 'operation.type': 'cold_start' })
  static async create(
    logger: PinoLogger,
    context: ExecutionContext,
    timeoutMs: number,
    onFailed?: OnLifecycleFailed,
  ): Promise<SandboxWrapper> {
    const { LIFECYCLE_RETRY_MAX_ATTEMPTS, LIFECYCLE_RETRY_DELAY_MS } = SCALEBOX_DEFAULTS;
    const errors: string[] = [];

    return guard
      .retry(() => SandboxWrapper.createInner(logger, context, timeoutMs), {
        maxAttempts: LIFECYCLE_RETRY_MAX_ATTEMPTS,
        initialDelay: LIFECYCLE_RETRY_DELAY_MS,
        maxDelay: LIFECYCLE_RETRY_DELAY_MS,
        backoffFactor: 1,
        onRetry: (err) => {
          const error = err as SandboxAcquireException;
          errors.push(error.message);
          logger.warn({ error: error.message }, 'Sandbox creation attempt failed');
          if (error.sandboxId) {
            onFailed?.(error.sandboxId, error);
          }
        },
      })
      .orThrow(
        () =>
          new SandboxCreationException(
            `createSandbox failed after ${LIFECYCLE_RETRY_MAX_ATTEMPTS} attempts: ${errors.join('; ')}`,
          ),
      );
  }

  @Trace('sandbox.reconnect', { 'operation.type': 'reconnect' })
  static async reconnect(
    logger: PinoLogger,
    context: ExecutionContext,
    metadata: SandboxMetadata,
    onFailed?: OnLifecycleFailed,
  ): Promise<SandboxWrapper> {
    const { LIFECYCLE_RETRY_MAX_ATTEMPTS, LIFECYCLE_RETRY_DELAY_MS } = SCALEBOX_DEFAULTS;
    const errors: string[] = [];

    return guard
      .retry(() => SandboxWrapper.reconnectInner(logger, context, metadata), {
        maxAttempts: LIFECYCLE_RETRY_MAX_ATTEMPTS,
        initialDelay: LIFECYCLE_RETRY_DELAY_MS,
        maxDelay: LIFECYCLE_RETRY_DELAY_MS,
        backoffFactor: 1,
        onRetry: (err) => {
          const error = err as SandboxAcquireException;
          errors.push(error.message);
          logger.warn(
            { sandboxId: metadata.sandboxId, error: error.message },
            'Sandbox reconnect attempt failed',
          );
          if (error.sandboxId) {
            onFailed?.(error.sandboxId, error);
          }
        },
      })
      .orThrow(
        () =>
          new SandboxConnectionException(
            `reconnectSandbox failed after ${LIFECYCLE_RETRY_MAX_ATTEMPTS} attempts: ${errors.join('; ')}`,
          ),
      );
  }

  @Trace('sandbox.mount')
  async mountDrive(
    s3DrivePath: string,
    s3Config: S3Config,
    options?: { allowNonEmpty?: boolean },
  ): Promise<void> {
    const canvasId = this.context.canvasId;
    const mountPoint = SANDBOX_DRIVE_MOUNT_POINT;

    this.logger.debug({ canvasId, mountPoint, s3DrivePath }, 'Mounting drive storage');

    await this.runCommand(COMMAND_BUILDER.mountS3(s3Config, s3DrivePath, mountPoint, options));

    this.logger.debug({ canvasId, mountPoint }, 'Drive storage mounted');
  }

  @Trace('sandbox.unmount')
  async unmountDrive(): Promise<void> {
    const mountPoint = SANDBOX_DRIVE_MOUNT_POINT;

    this.logger.debug({ sandboxId: this.sandboxId, mountPoint }, 'Unmounting drive storage');

    // Use fusermount with lazy unmount (-z) for FUSE filesystems
    // -u: unmount, -z: lazy unmount (detach even if busy)
    // Lazy unmount is asynchronous, completes in background
    await this.runCommand(`fusermount -uz ${mountPoint}`);

    this.logger.debug({ sandboxId: this.sandboxId, mountPoint }, 'Drive storage unmounted');
  }

  @Trace('sandbox.command')
  private async runCommand(command: string) {
    const result = await guard(() => this.sandbox.commands.run(command)).orThrow((error) => {
      this.logger.warn({ error, sandboxId: this.sandboxId }, 'Sandbox command failed');
      return new SandboxExecutionFailedException(error);
    });

    guard.ensure(result.exitCode === 0).orThrow(() => {
      this.logger.warn(
        { exitCode: result.exitCode, stderr: result.stderr },
        'Sandbox command non-zero exit',
      );
      return new SandboxExecutionFailedException(result.stderr, result.exitCode);
    });

    return result;
  }

  @Trace('sandbox.executeCode', { 'operation.type': 'code_execution' })
  async executeCode(
    params: SandboxExecuteParams,
    ctx: ExecuteCodeContext,
  ): Promise<ExecutionResult> {
    ctx.logger.info({ language: params.language }, 'Executing code');

    const result = await guard(() =>
      this.sandbox.runCode(params.code, {
        language: params.language,
        cwd: this.cwd,
        timeout: ctx.timeoutMs,
      }),
    ).orThrow((error) => {
      this.logger.warn(error, 'Sandbox runCode failed');
      return new SandboxRunCodeException(error);
    });

    guard
      .ensure(result.exitCode === 0)
      .orThrow(() => new SandboxExecutionBadResultException(result));

    return result;
  }

  @Trace('sandbox.listFiles')
  async listCwdFiles(): Promise<string[]> {
    return guard(() =>
      this.sandbox.files.list(this.cwd).then((files) => files.map((file) => file.name)),
    ).orThrow((error) => {
      this.logger.warn(error, 'Failed to list files');
      return new SandboxFileListException(error);
    });
  }

  async kill(): Promise<void> {
    await this.sandbox.kill();
  }

  /**
   * Check if sandbox gRPC endpoint is ready
   * Polls with commands.run('true') until success or max attempts
   */
  async healthCheck(): Promise<boolean> {
    const { HEALTH_CHECK_MAX_ATTEMPTS, HEALTH_CHECK_INTERVAL_MS } = SCALEBOX_DEFAULTS;

    return guard
      .retry(() => this.runCommand('true').then(() => true), {
        maxAttempts: HEALTH_CHECK_MAX_ATTEMPTS,
        initialDelay: HEALTH_CHECK_INTERVAL_MS,
        maxDelay: HEALTH_CHECK_INTERVAL_MS,
        backoffFactor: 1,
      })
      .orElse(async () => false);
  }
}
