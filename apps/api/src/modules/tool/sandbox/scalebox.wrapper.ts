import { Sandbox, type ExecutionResult } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteParams } from '@refly/openapi-schema';

import { guard } from '../../../utils/guard';
import { Trace, setSpanAttributes } from './scalebox.tracer';

import {
  SandboxCreationException,
  SandboxExecutionFailedException,
  SandboxFileListException,
  SandboxConnectionException,
  SandboxExecutionBadResultException,
} from './scalebox.exception';
import { SANDBOX_DRIVE_MOUNT_POINT } from './scalebox.constants';
import { ExecutionContext } from './scalebox.dto';

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

const COMMAND_BUILDER = {
  mountS3: (
    s3Config: S3Config,
    path: string,
    mountPoint: string,
    options?: { readOnly?: boolean; allowNonEmpty?: boolean },
  ): string => {
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
      async () => {
        this.logger.info({ sandboxId: this.sandboxId }, 'Triggering sandbox pause');
        await this.sandbox.betaPause();
        this.logger.info({ sandboxId: this.sandboxId }, 'Sandbox paused successfully');
      },
      (error) => this.logger.error({ sandboxId: this.sandboxId, error }, 'Failed to pause sandbox'),
    );
  }

  @Trace('sandbox.create', { 'operation.type': 'cold_start' })
  static async create(
    logger: PinoLogger,
    context: ExecutionContext,
    timeoutMs: number,
  ): Promise<SandboxWrapper> {
    setSpanAttributes({
      'sandbox.canvasId': context.canvasId,
      'sandbox.uid': context.uid,
      'sandbox.timeoutMs': timeoutMs,
    });

    logger.info({ canvasId: context.canvasId }, 'Creating sandbox');

    const sandbox = await guard(() =>
      Sandbox.create('code-interpreter', {
        apiKey: context.apiKey,
        timeoutMs,
      }),
    ).orThrow((e) => new SandboxCreationException(e));

    setSpanAttributes({ 'sandbox.id': sandbox.sandboxId });

    const now = Date.now();
    const wrapper = new SandboxWrapper(
      sandbox,
      logger,
      context,
      SANDBOX_DRIVE_MOUNT_POINT,
      now,
      now,
    );

    logger.info(
      { sandboxId: wrapper.sandboxId, canvasId: context.canvasId },
      'Sandbox created successfully (mount required)',
    );

    return wrapper;
  }

  @Trace('sandbox.reconnect', { 'operation.type': 'reconnect' })
  static async reconnect(
    logger: PinoLogger,
    context: ExecutionContext,
    metadata: SandboxMetadata,
  ): Promise<SandboxWrapper> {
    logger.info({ sandboxId: metadata.sandboxId }, 'Reconnecting to sandbox');

    const sandbox = await guard(() =>
      Sandbox.connect(metadata.sandboxId, { apiKey: context.apiKey }),
    ).orThrow((error) => {
      logger.error({ sandboxId: metadata.sandboxId, error }, 'Failed to reconnect to sandbox');
      return new SandboxConnectionException(error);
    });

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

    logger.info({ metadata }, 'Reconnected to sandbox successfully');

    return wrapper;
  }

  @Trace('sandbox.mount')
  async mountDrive(
    s3DrivePath: string,
    s3Config: S3Config,
    options?: { allowNonEmpty?: boolean },
  ): Promise<void> {
    const canvasId = this.context.canvasId;
    const mountPoint = SANDBOX_DRIVE_MOUNT_POINT;

    setSpanAttributes({
      'mount.point': mountPoint,
      'mount.path': s3DrivePath,
      'mount.canvasId': canvasId,
      'mount.allowNonEmpty': options?.allowNonEmpty ?? false,
    });

    this.logger.info({ canvasId, mountPoint, s3DrivePath }, 'Mounting drive storage');

    await this.runCommand(`mkdir -p ${mountPoint}`);

    const mountCmd = COMMAND_BUILDER.mountS3(s3Config, s3DrivePath, mountPoint, options);

    await this.runCommand(mountCmd);

    this.logger.info({ canvasId, mountPoint }, 'Drive storage mounted successfully');
  }

  @Trace('sandbox.unmount')
  async unmountDrive(): Promise<void> {
    const canvasId = this.context.canvasId;
    const mountPoint = SANDBOX_DRIVE_MOUNT_POINT;

    setSpanAttributes({
      'unmount.point': mountPoint,
      'sandbox.canvasId': canvasId,
    });

    this.logger.info({ sandboxId: this.sandboxId, mountPoint }, 'Unmounting drive storage');

    // Use fusermount with lazy unmount (-z) for FUSE filesystems
    // -u: unmount, -z: lazy unmount (detach even if busy)
    // Lazy unmount is asynchronous, completes in background
    await this.runCommand(`fusermount -uz ${mountPoint}`);

    this.logger.info(
      { sandboxId: this.sandboxId, mountPoint },
      'Drive storage unmount initiated (lazy)',
    );
  }

  @Trace('sandbox.command')
  private async runCommand(command: string) {
    setSpanAttributes({ 'command.text': command });

    const result = await guard(() => this.sandbox.commands.run(command)).orThrow(
      (error) => new SandboxExecutionFailedException(error),
    );

    if (result.exitCode !== 0) {
      throw new SandboxExecutionFailedException(result.stderr, result.exitCode);
    }

    return result;
  }

  @Trace('sandbox.executeCode', { 'operation.type': 'code_execution' })
  async executeCode(
    params: SandboxExecuteParams,
    logger: PinoLogger,
    timeoutMs: number,
  ): Promise<ExecutionResult> {
    logger.info(
      {
        sandboxId: this.sandboxId,
        canvasId: this.context.canvasId,
        language: params.language,
        timeoutMs,
      },
      'Executing code in sandbox',
    );

    const result = await this.runCode(params, timeoutMs);

    guard
      .ensure(result.exitCode === 0)
      .orThrow(() => new SandboxExecutionBadResultException(result));

    return result;
  }

  @Trace('code.execution')
  private async runCode(params: SandboxExecuteParams, timeoutMs: number): Promise<ExecutionResult> {
    return this.sandbox.runCode(params.code, {
      language: params.language,
      cwd: this.cwd,
      timeout: timeoutMs,
    });
  }

  @Trace('sandbox.listFiles')
  async listCwdFiles(): Promise<string[]> {
    const files = await guard(() =>
      this.sandbox.files.list(this.cwd).then((files) => files.map((file) => file.name)),
    ).orThrow((error) => new SandboxFileListException(error));

    setSpanAttributes({ 'files.count': files.length });

    return files;
  }

  async kill(): Promise<void> {
    await this.sandbox.kill();
  }
}
