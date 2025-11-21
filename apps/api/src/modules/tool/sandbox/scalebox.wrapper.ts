import { Sandbox, type ExecutionResult } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteParams } from '@refly/openapi-schema';

import { guard } from '../../../utils/guard';
import { Trace, setSpanAttributes } from './scalebox.tracer';

import {
  SandboxCreationException,
  SandboxCommandException,
  CodeExecutionException,
  SandboxFileListException,
  SandboxConnectionException,
} from './scalebox.exception';
import {
  SANDBOX_DRIVE_MOUNT_POINT,
  SANDBOX_MOUNT_VERIFICATION_TIMEOUT_MS,
  SANDBOX_MOUNT_VERIFICATION_MAX_DELAY_MS,
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
  private constructor(
    private readonly sandbox: Sandbox,
    public readonly context: SandboxContext,
    public readonly cwd: string,
    public readonly createdAt: number,
    private timeoutAt: number,
  ) {}

  get sandboxId(): string {
    return this.sandbox.sandboxId;
  }

  get canvasId(): string {
    return this.context.canvasId;
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

  get remainingTime(): number {
    return this.timeoutAt - Date.now();
  }

  toMetadata(): SandboxMetadata {
    return {
      sandboxId: this.sandboxId,
      cwd: this.cwd,
      createdAt: this.createdAt,
      timeoutAt: this.timeoutAt,
    };
  }

  @Trace('sandbox.create', { 'operation.type': 'cold_start' })
  static async create(context: SandboxContext, timeoutMs: number): Promise<SandboxWrapper> {
    setSpanAttributes({
      'sandbox.canvasId': context.canvasId,
      'sandbox.uid': context.uid,
      'sandbox.timeoutMs': timeoutMs,
    });

    context.logger.info({ canvasId: context.canvasId }, 'Creating sandbox');

    const sandbox = await guard(() =>
      Sandbox.create('code-interpreter', {
        apiKey: context.apiKey,
        timeoutMs,
      }),
    ).orThrow((e) => new SandboxCreationException(e));

    setSpanAttributes({ 'sandbox.id': sandbox.sandboxId });

    const wrapper = new SandboxWrapper(
      sandbox,
      context,
      SANDBOX_DRIVE_MOUNT_POINT,
      Date.now(),
      Date.now() + timeoutMs,
    );

    context.logger.info(
      { sandboxId: wrapper.sandboxId, canvasId: context.canvasId },
      'Sandbox created successfully (mount required)',
    );

    return wrapper;
  }

  @Trace('sandbox.reconnect', { 'operation.type': 'reconnect' })
  static async reconnect(
    context: SandboxContext,
    metadata: SandboxMetadata,
  ): Promise<SandboxWrapper> {
    context.logger.info({ sandboxId: metadata.sandboxId }, 'Reconnecting to sandbox');

    const sandbox = await guard(() =>
      Sandbox.connect(metadata.sandboxId, { apiKey: context.apiKey }),
    ).orThrow((error) => new SandboxConnectionException(error));

    const wrapper = new SandboxWrapper(
      sandbox,
      context,
      metadata.cwd,
      metadata.createdAt,
      metadata.timeoutAt,
    );

    const isHealthy = await wrapper.isHealthy();
    guard.ensure(isHealthy).orThrow(() => new SandboxConnectionException('Sandbox is not healthy'));

    context.logger.info({ sandboxId: metadata.sandboxId }, 'Reconnected to sandbox successfully');

    return wrapper;
  }

  @Trace('sandbox.mount')
  async mountDrive(s3DrivePath: string, options?: { allowNonEmpty?: boolean }): Promise<void> {
    const { logger, s3Config, canvasId } = this.context;
    const mountPoint = SANDBOX_DRIVE_MOUNT_POINT;

    setSpanAttributes({
      'mount.point': mountPoint,
      'mount.path': s3DrivePath,
      'mount.canvasId': canvasId,
      'mount.allowNonEmpty': options?.allowNonEmpty ?? false,
    });

    logger.info({ canvasId, mountPoint, path: s3DrivePath }, 'Mounting drive storage');

    await this.runCommand(`mkdir -p ${mountPoint}`);

    const mountCmd = COMMAND_BUILDER.mountS3(s3Config, s3DrivePath, mountPoint, options);

    await this.runCommand(mountCmd);

    await guard
      .retry(() => this.runCommand(`test -d ${mountPoint}`), {
        timeout: SANDBOX_MOUNT_VERIFICATION_TIMEOUT_MS,
        maxDelay: SANDBOX_MOUNT_VERIFICATION_MAX_DELAY_MS,
      })
      .orThrow();

    logger.info({ canvasId, mountPoint }, 'Drive storage mounted successfully');
  }

  @Trace('sandbox.unmount')
  async unmountDrive(): Promise<void> {
    const { logger, canvasId } = this.context;
    const mountPoint = SANDBOX_DRIVE_MOUNT_POINT;

    setSpanAttributes({
      'unmount.point': mountPoint,
      'sandbox.canvasId': canvasId,
    });

    logger.info({ sandboxId: this.sandboxId, mountPoint }, 'Unmounting drive storage');

    // Use fusermount with lazy unmount (-z) for FUSE filesystems
    // -u: unmount, -z: lazy unmount (detach even if busy)
    await this.runCommand(`fusermount -uz ${mountPoint}`);

    // Verify unmount: mountpoint returns 0 if mounted, 1 if not mounted
    // Use ! to invert exit code - expect not mounted (1 -> 0 success)
    await this.runCommand(`! mountpoint ${mountPoint} &>/dev/null`);

    logger.info({ sandboxId: this.sandboxId, mountPoint }, 'Drive storage unmounted successfully');
  }

  @Trace('sandbox.command')
  private async runCommand(command: string) {
    setSpanAttributes({ 'command.text': command });

    const result = await guard(() => this.sandbox.commands.run(command)).orThrow(
      (error) => new SandboxCommandException(error),
    );

    if (result.exitCode !== 0) {
      throw new SandboxCommandException(result.stderr, result.exitCode);
    }

    return result;
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
    const files = await guard(() =>
      this.sandbox.files.list(this.cwd).then((files) => files.map((file) => file.name)),
    ).orThrow((error) => new SandboxFileListException(error));

    setSpanAttributes({ 'files.count': files.length });

    return files;
  }

  @Trace('sandbox.extendTimeout')
  async extendTimeout(ms: number): Promise<void> {
    await this.sandbox.setTimeout(ms);
    const info = await this.sandbox.getInfo();
    this.timeoutAt = info.timeoutAt.getTime();
  }
}
