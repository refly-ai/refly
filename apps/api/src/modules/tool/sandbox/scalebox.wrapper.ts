import { Sandbox, type Language, type ExecutionResult } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { guard } from '../../../utils/guard';
import {
  SandboxCreationException,
  SandboxMountException,
  CodeExecutionException,
} from './scalebox.exception';
import {
  SANDBOX_INPUT_MOUNT_POINT,
  SANDBOX_OUTPUT_MOUNT_POINT,
  SANDBOX_MOUNT_WAIT_MS,
} from './scalebox.constants';
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
  s3InputPath: string; // S3 path for input (user resources): drive/{uid}/{canvasId}/
}

/**
 * Build s3fs mount command with AWS credentials via environment variables
 * @param s3Config - S3 configuration
 * @param path - S3 path to mount
 * @param mountPoint - Local mount point path
 * @param options - Mount options (e.g., readOnly)
 */
function buildS3MountCommand(
  s3Config: S3Config,
  path: string,
  mountPoint: string,
  options?: { readOnly?: boolean },
): string {
  const s3EndpointUrl = `https://${s3Config.endpoint}`;
  const readOnlyFlag = options?.readOnly ? '-o ro' : '';
  return `AWSACCESSKEYID=${s3Config.accessKey} \
AWSSECRETACCESSKEY=${s3Config.secretKey} \
s3fs ${s3Config.bucket}:/${path} ${mountPoint} \
-o url=${s3EndpointUrl} \
-o endpoint=${s3Config.region} \
-o use_path_request_style \
-o compat_dir \
${readOnlyFlag}`.trim();
}

/**
 * SandboxWrapper encapsulates Sandbox SDK instance with lifecycle management
 * Handles health checks, timeout management, and state persistence
 */
export class SandboxWrapper {
  private currentOutputPath?: string; // Cache current output S3 path
  private s3Config: S3Config; // S3 configuration for remounting

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
      SANDBOX_OUTPUT_MOUNT_POINT,
      Date.now(),
      info.timeoutAt.getTime(),
    );

    // Store S3 config for future remounting
    wrapper.s3Config = context.s3Config;

    // Mount input (read-only, user resources)
    await wrapper.mountInput(context);

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

    // Store S3 config for future remounting
    wrapper.s3Config = context.s3Config;

    if (!(await wrapper.isHealthy())) {
      context.logger.warn({ sandboxId: metadata.sandboxId }, 'Sandbox is not healthy');
      return null;
    }

    context.logger.info({ sandboxId: metadata.sandboxId }, 'Reconnected to sandbox');

    return wrapper;
  }

  /**
   * Mount input storage (read-only)
   * Contains user uploaded files and previous results
   */
  private async mountInput(context: SandboxContext): Promise<void> {
    const { logger, s3Config, s3InputPath } = context;

    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const mountPoint = SANDBOX_INPUT_MOUNT_POINT;

    logger.info(
      { canvasId: this.canvasId, mountPoint, path: s3InputPath },
      'Mounting input storage',
    );

    const mkdirResult = await guard(() => sandbox.commands.run(`mkdir -p ${mountPoint}`)).orThrow(
      (e) => new SandboxMountException(e, this.canvasId),
    );

    if (mkdirResult.exitCode !== 0)
      throw new SandboxMountException(mkdirResult.stderr, this.canvasId);

    const mountCmd = buildS3MountCommand(s3Config, s3InputPath, mountPoint, { readOnly: true });

    const mountResult = await guard(() => sandbox.commands.run(mountCmd)).orThrow(
      (e) => new SandboxMountException(e, this.canvasId),
    );

    if (mountResult.exitCode !== 0)
      throw new SandboxMountException(mountResult.stderr, this.canvasId);

    await sleep(SANDBOX_MOUNT_WAIT_MS);

    logger.info({ canvasId: this.canvasId, mountPoint }, 'Input storage mounted successfully');
  }

  /**
   * Remount output storage for a new version
   * Unmounts previous output if exists, then mounts new output path
   */
  private async remountOutput(s3OutputPath: string, logger: PinoLogger): Promise<void> {
    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const mountPoint = SANDBOX_OUTPUT_MOUNT_POINT;

    logger.info(
      { canvasId: this.canvasId, mountPoint, path: s3OutputPath },
      'Remounting output storage',
    );

    // Unmount previous output if exists
    if (this.currentOutputPath) {
      await guard.bestEffort(
        async () => {
          await sandbox.commands.run(`umount ${mountPoint}`);
        },
        (error) => logger.warn({ error }, 'Failed to unmount previous output'),
      );
    }

    // Create mount point if not exists
    const mkdirResult = await guard(() => sandbox.commands.run(`mkdir -p ${mountPoint}`)).orThrow(
      (e) => new SandboxMountException(e, this.canvasId),
    );

    if (mkdirResult.exitCode !== 0)
      throw new SandboxMountException(mkdirResult.stderr, this.canvasId);

    // Mount new output path
    const mountCmd = buildS3MountCommand(this.s3Config, s3OutputPath, mountPoint);

    const mountResult = await guard(() => sandbox.commands.run(mountCmd)).orThrow(
      (e) => new SandboxMountException(e, this.canvasId),
    );

    if (mountResult.exitCode !== 0)
      throw new SandboxMountException(mountResult.stderr, this.canvasId);

    await sleep(SANDBOX_MOUNT_WAIT_MS);

    logger.info({ canvasId: this.canvasId, mountPoint }, 'Output storage mounted successfully');
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

  async executeCode(
    code: string,
    language: Language,
    outputPath: string,
    logger: PinoLogger,
  ): Promise<ExecutionResult> {
    // Ensure output path is provided
    guard
      .notEmpty(outputPath)
      .orThrow(() => new Error('Output path is required for code execution'));

    // Remount output if path changed
    if (this.currentOutputPath !== outputPath) {
      await this.remountOutput(outputPath, logger);
      this.currentOutputPath = outputPath;
    }

    // Inject path helper functions for Python
    const finalCode = this.injectPathHelpers(code, language);

    return guard(() =>
      this.sandbox.runCode(finalCode, {
        language,
        cwd: this.cwd,
      }),
    ).orThrow((e) => new CodeExecutionException(e));
  }

  /**
   * Inject path helper functions for supported languages
   */
  private injectPathHelpers(code: string, language: Language): string {
    if (language !== 'python') {
      return code;
    }

    const helpers = `# Path helper functions (auto-injected by Refly)
def input_path(filename: str) -> str:
    """Get full path for reading input files"""
    return f"${SANDBOX_INPUT_MOUNT_POINT}/{filename}"

def output_path(filename: str) -> str:
    """Get full path for writing output files"""
    return f"${SANDBOX_OUTPUT_MOUNT_POINT}/{filename}"

# User code starts here
`;

    return helpers + code;
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
