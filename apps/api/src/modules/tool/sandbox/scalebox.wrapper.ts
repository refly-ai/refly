import { Sandbox, type Language, type ExecutionResult } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { guard } from '../../../utils/guard';
import {
  SandboxCreationException,
  SandboxMountException,
  CodeExecutionException,
  SandboxFileListException,
} from './scalebox.exception';
import {
  SANDBOX_DRIVE_MOUNT_POINT,
  SANDBOX_WORKFLOW_MOUNT_POINT,
  SANDBOX_MOUNT_WAIT_MS,
  SANDBOX_MOUNT_MAX_RETRIES,
  SANDBOX_MOUNT_RETRY_DELAY_MS,
  SANDBOX_UNMOUNT_POLL_MAX_ATTEMPTS,
  SANDBOX_UNMOUNT_POLL_INTERVAL_MS,
  SANDBOX_UNMOUNT_STABILIZE_DELAY_MS,
} from './scalebox.constants';
import { sleep, poll } from './scalebox.utils';

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
  s3DrivePath: string; // S3 path for drive files (user uploaded files): drive/{uid}/{canvasId}/
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
  private currentWorkflowPath?: string; // Cache current output S3 path
  private s3Config: S3Config; // S3 configuration for remounting
  private s3DrivePath: string; // S3 drive path (user uploaded files)

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
      SANDBOX_WORKFLOW_MOUNT_POINT,
      Date.now(),
      info.timeoutAt.getTime(),
    );

    // Store S3 config and paths for logging and remounting
    wrapper.s3Config = context.s3Config;
    wrapper.s3DrivePath = context.s3DrivePath;

    // Mount drive (read-only, user uploaded files)
    await wrapper.mountDrive(context);

    // Create workflow directory (empty, will be mounted during executeCode)
    await wrapper.createWorkflowDirectory(context.logger);

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

    // Store S3 config and paths for logging and remounting
    wrapper.s3Config = context.s3Config;
    wrapper.s3DrivePath = context.s3DrivePath;

    if (!(await wrapper.isHealthy())) {
      context.logger.warn({ sandboxId: metadata.sandboxId }, 'Sandbox is not healthy');
      return null;
    }

    context.logger.info({ sandboxId: metadata.sandboxId }, 'Reconnected to sandbox');

    return wrapper;
  }

  /**
   * Mount drive storage (read-only)
   * Contains user uploaded files from drive
   */
  private async mountDrive(context: SandboxContext): Promise<void> {
    const { logger, s3Config, s3DrivePath } = context;

    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const mountPoint = SANDBOX_DRIVE_MOUNT_POINT;

    logger.info(
      { canvasId: this.canvasId, mountPoint, path: s3DrivePath },
      'Mounting drive storage',
    );

    const mkdirResult = await guard(() => sandbox.commands.run(`mkdir -p ${mountPoint}`)).orThrow(
      (e) => new SandboxMountException(e, this.canvasId),
    );

    if (mkdirResult.exitCode !== 0)
      throw new SandboxMountException(mkdirResult.stderr, this.canvasId);

    const mountCmd = buildS3MountCommand(s3Config, s3DrivePath, mountPoint, { readOnly: true });

    const mountResult = await guard
      .retry(() => sandbox.commands.run(mountCmd), {
        maxAttempts: SANDBOX_MOUNT_MAX_RETRIES,
        delayMs: SANDBOX_MOUNT_RETRY_DELAY_MS,
      })
      .orThrow((e) => new SandboxMountException(e, this.canvasId));

    if (mountResult.exitCode !== 0)
      throw new SandboxMountException(mountResult.stderr, this.canvasId);

    await sleep(SANDBOX_MOUNT_WAIT_MS);

    logger.info({ canvasId: this.canvasId, mountPoint }, 'Drive storage mounted successfully');
  }

  /**
   * Create workflow directory (empty, will be mounted during executeCode)
   */
  private async createWorkflowDirectory(logger: PinoLogger): Promise<void> {
    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const mountPoint = SANDBOX_WORKFLOW_MOUNT_POINT;

    logger.info({ canvasId: this.canvasId, mountPoint }, 'Creating workflow directory');

    const mkdirResult = await guard(() => sandbox.commands.run(`mkdir -p ${mountPoint}`)).orThrow(
      (e) => new SandboxMountException(e, this.canvasId),
    );

    if (mkdirResult.exitCode !== 0)
      throw new SandboxMountException(mkdirResult.stderr, this.canvasId);

    logger.info({ canvasId: this.canvasId, mountPoint }, 'Workflow directory created');
  }

  private async unmountWorkflow(logger: PinoLogger): Promise<void> {
    if (!this.currentWorkflowPath) {
      return;
    }

    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const mountPoint = SANDBOX_WORKFLOW_MOUNT_POINT;

    logger.info(
      { mountPoint, previousPath: this.currentWorkflowPath },
      'Unmounting previous workflow',
    );

    const mountCheckResult = await sandbox.commands.run(`mountpoint -q ${mountPoint}`);
    const isMounted = mountCheckResult.exitCode === 0;

    if (!isMounted) {
      logger.info({ mountPoint }, 'Mount point is not mounted, skipping unmount');
      return;
    }

    const unmountResult = await sandbox.commands.run(`fusermount -uz ${mountPoint}`);

    if (unmountResult.exitCode !== 0) {
      throw new SandboxMountException(
        `Failed to unmount ${mountPoint}: ${unmountResult.stderr}`,
        this.canvasId,
      );
    }

    logger.info({ mountPoint }, 'Unmount command executed, waiting for cleanup');

    await poll(
      async () => {
        const checkResult = await sandbox.commands.run(`mountpoint -q ${mountPoint}`);
        return checkResult.exitCode === 0 ? null : true;
      },
      async () => {
        throw new SandboxMountException(
          `Unmount verification timed out after ${SANDBOX_UNMOUNT_POLL_MAX_ATTEMPTS * SANDBOX_UNMOUNT_POLL_INTERVAL_MS}ms`,
          this.canvasId,
        );
      },
      {
        timeout: SANDBOX_UNMOUNT_POLL_MAX_ATTEMPTS * SANDBOX_UNMOUNT_POLL_INTERVAL_MS,
        initialDelay: SANDBOX_UNMOUNT_POLL_INTERVAL_MS,
        maxDelay: SANDBOX_UNMOUNT_POLL_INTERVAL_MS,
        backoffFactor: 1,
      },
    );

    logger.info({ mountPoint }, 'Unmount verified, waiting for kernel cleanup');

    // Additional stabilization delay to allow kernel FUSE cleanup
    await sleep(SANDBOX_UNMOUNT_STABILIZE_DELAY_MS);

    logger.info({ mountPoint }, 'Unmount completed');
  }

  private async mountWorkflow(s3OutputPath: string, logger: PinoLogger): Promise<void> {
    const sandbox = guard
      .notEmpty(this.sandbox)
      .orThrow(() => new Error('Sandbox not initialized'));

    const mountPoint = SANDBOX_WORKFLOW_MOUNT_POINT;

    logger.info(
      { canvasId: this.canvasId, mountPoint, path: s3OutputPath },
      'Mounting workflow storage',
    );

    // Ensure mount point directory exists (do not remove it to avoid "device busy" error)
    const mkdirResult = await guard(() => sandbox.commands.run(`mkdir -p ${mountPoint}`)).orThrow(
      (e) => new SandboxMountException(e, this.canvasId),
    );

    if (mkdirResult.exitCode !== 0) {
      throw new SandboxMountException(mkdirResult.stderr, this.canvasId);
    }

    // Use nonempty option to allow mounting over existing directory
    // This avoids race conditions with FUSE lazy unmount cleanup
    const mountCmd = buildS3MountCommand(this.s3Config, s3OutputPath, mountPoint, {
      allowNonEmpty: true,
    });

    const mountResult = await guard
      .retry(() => sandbox.commands.run(mountCmd), {
        maxAttempts: SANDBOX_MOUNT_MAX_RETRIES,
        delayMs: SANDBOX_MOUNT_RETRY_DELAY_MS,
      })
      .orThrow((e) => new SandboxMountException(e, this.canvasId));

    if (mountResult.exitCode !== 0) {
      throw new SandboxMountException(mountResult.stderr, this.canvasId);
    }

    await sleep(SANDBOX_MOUNT_WAIT_MS);

    logger.info({ canvasId: this.canvasId, mountPoint }, 'Workflow storage mounted successfully');
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
    workflowPath: string,
    logger: PinoLogger,
  ): Promise<ExecutionResult> {
    // Ensure output path is provided
    guard
      .notEmpty(workflowPath)
      .orThrow(() => new Error('Output path is required for code execution'));

    const needsRemount = this.currentWorkflowPath !== workflowPath;

    logger.info(
      {
        sandboxId: this.sandboxId,
        canvasId: this.canvasId,
        language,
        s3DrivePath: this.s3DrivePath,
        s3WorkflowPath: workflowPath,
        currentWorkflowPath: this.currentWorkflowPath,
        needsRemount,
      },
      'Executing code in sandbox',
    );

    if (needsRemount) {
      logger.info({ canvasId: this.canvasId, path: workflowPath }, 'Remounting workflow storage');
      await this.unmountWorkflow(logger);
      await this.mountWorkflow(workflowPath, logger);
      this.currentWorkflowPath = workflowPath;
    }

    return guard(() =>
      this.sandbox.runCode(code, {
        language,
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
      uid: this.uid,
      sandboxId: this.sandboxId,
      canvasId: this.canvasId,
      cwd: this.cwd,
      createdAt: this.createdAt,
      timeoutAt: this.timeoutAt,
    };
  }
}
