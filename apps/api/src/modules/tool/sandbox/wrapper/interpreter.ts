import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteParams } from '@refly/openapi-schema';

import { guard } from '../../../../utils/guard';
import { Trace } from '../scalebox.tracer';
import { SandboxExecutionFailedException, SandboxMountException } from '../scalebox.exception';
import { SANDBOX_DRIVE_MOUNT_POINT, SCALEBOX_DEFAULTS } from '../scalebox.constants';
import {
  ExecutionContext,
  ExecuteCodeContext,
  ExecutorOutput,
  OnLifecycleFailed,
  S3Config,
} from '../scalebox.dto';
import {
  BaseSandboxWrapper,
  SandboxMetadata,
  SandboxWrapperParams,
  createSandbox,
  connectSandbox,
  ensureHealthy,
  restorePauseState,
  withLifecycleRetry,
} from './base';

const MOUNT_WAIT_MS = 2000;
const S3FS_PASSWD_FILE = '/tmp/s3fs_passwd';

function buildS3MountCommand(s3Config: S3Config, path: string, mountPoint: string): string {
  const passwdContent = `${s3Config.accessKey}:${s3Config.secretKey}`;
  const s3EndpointUrl = `https://${s3Config.endPoint}`;

  const s3fsCmd = [
    `s3fs ${s3Config.bucket}:/${path} ${mountPoint}`,
    `-o url=${s3EndpointUrl}`,
    `-o endpoint=${s3Config.region}`,
    `-o passwd_file=${S3FS_PASSWD_FILE}`,
    '-o use_path_request_style',
    '-o nonempty',
    '-o compat_dir', // Allow mounting paths not explicitly created as directory objects
  ].join(' ');

  // s3fs runs as daemon by default, returns 0 immediately
  // Use mountpoint to verify mount succeeded after daemon initialization
  return `(mkdir -p ${mountPoint} && echo "${passwdContent}" > ${S3FS_PASSWD_FILE} && chmod 600 ${S3FS_PASSWD_FILE} && ${s3fsCmd}; s3fs_ret=$?; rm -f ${S3FS_PASSWD_FILE}; if [ $s3fs_ret -ne 0 ]; then exit $s3fs_ret; fi; sleep 2 && mountpoint -q ${mountPoint})`;
}

function buildS3UmountCommand(mountPoint: string): string {
  return `fusermount -u -z ${mountPoint}`;
}

/**
 * InterpreterWrapper - Implementation using code-interpreter official template
 *
 * Features:
 * - Uses sandbox.runCode() SDK API for code execution
 * - Server-side S3 mount via s3fs command
 * - Manual file diff tracking (listCwdFiles before/after)
 * - No resource limits support
 */
export class InterpreterWrapper extends BaseSandboxWrapper {
  private constructor(...args: SandboxWrapperParams) {
    super(...args);
    this.logger.setContext(InterpreterWrapper.name);
  }

  // ==================== Static Factory Methods ====================

  @Trace('sandbox.create', { 'operation.type': 'cold_start' })
  static async create(
    logger: PinoLogger,
    context: ExecutionContext,
    templateName: string,
    timeoutMs: number,
    onFailed?: OnLifecycleFailed,
  ): Promise<InterpreterWrapper> {
    return withLifecycleRetry(
      'create',
      logger,
      async () => {
        logger.info({ canvasId: context.canvasId, templateName }, 'Creating sandbox (interpreter)');

        const sandbox = await createSandbox(templateName, context.apiKey, timeoutMs);
        const now = Date.now();
        const wrapper = new InterpreterWrapper(
          sandbox,
          logger,
          context,
          SANDBOX_DRIVE_MOUNT_POINT,
          now,
          now,
        );

        await ensureHealthy(wrapper, 'create');
        logger.info(
          { sandboxId: wrapper.sandboxId, canvasId: context.canvasId },
          'Sandbox created (interpreter)',
        );

        return wrapper;
      },
      onFailed,
    );
  }

  @Trace('sandbox.reconnect', { 'operation.type': 'reconnect' })
  static async reconnect(
    logger: PinoLogger,
    context: ExecutionContext,
    metadata: SandboxMetadata,
    onFailed?: OnLifecycleFailed,
  ): Promise<InterpreterWrapper> {
    return withLifecycleRetry(
      'reconnect',
      logger,
      async () => {
        logger.info({ sandboxId: metadata.sandboxId }, 'Reconnecting to sandbox (interpreter)');

        const sandbox = await connectSandbox(metadata.sandboxId, context.apiKey);
        const wrapper = new InterpreterWrapper(
          sandbox,
          logger,
          context,
          metadata.cwd,
          metadata.createdAt,
          metadata.idleSince,
        );

        restorePauseState(wrapper, metadata);
        await ensureHealthy(wrapper, 'reconnect');
        logger.info({ sandboxId: metadata.sandboxId }, 'Reconnected to sandbox (interpreter)');

        return wrapper;
      },
      onFailed,
    );
  }

  // ==================== Code Execution ====================

  @Trace('sandbox.executeCode', { 'operation.type': 'code_execution' })
  async executeCode(
    params: SandboxExecuteParams,
    ctx: ExecuteCodeContext,
  ): Promise<ExecutorOutput> {
    const { logger, s3Config, s3DrivePath } = ctx;
    const sid = this.sandboxId;

    logger.info({ sid, language: params.language }, '[exec:start]');

    // Shared state for file diff (populated by cleanup)
    let addedFiles: string[] = [];

    // Outer defer: mount/umount S3 drive
    const result = await guard.defer(
      () => this.acquireDriveMount(logger, s3Config, s3DrivePath),
      // Inner defer: file diff tracking (before/after)
      () =>
        guard.defer(
          async () => {
            logger.info({ sid }, '[exec:list-before]');
            const prevFiles = new Set(await this.listCwdFiles());
            logger.info({ sid, prevFiles: Array.from(prevFiles) }, '[exec:list-before:done]');

            // Cleanup: compute file diff
            return [
              prevFiles,
              async () => {
                logger.info({ sid }, '[exec:list-after]');
                const currFiles = await this.listCwdFiles();
                logger.info({ sid, currFiles }, '[exec:list-after:done]');
                addedFiles = currFiles.filter((f) => !prevFiles.has(f));
                logger.info(
                  { sid, addedFiles, addedFilesCount: addedFiles.length },
                  '[exec:diff:done]',
                );
              },
            ] as const;
          },
          async () => {
            // Execute code via SDK runCode API
            logger.info({ sid }, '[exec:run]');
            return guard(() =>
              this.sandbox.runCode(params.code, {
                language: params.language as 'python' | 'javascript',
                cwd: this.cwd,
              }),
            ).orThrow((error) => {
              logger.warn({ sid, error }, '[exec:run:failed]');
              return new SandboxExecutionFailedException(error);
            });
          },
          (error) => logger.warn({ sid, error }, '[exec:diff:failed]'),
        ),
      (error) => logger.warn({ sid, error }, '[exec:umount:failed]'),
    );

    logger.info(
      { sid, exitCode: result.exitCode, addedFilesCount: addedFiles.length },
      '[exec:done]',
    );

    return {
      exitCode: result.exitCode,
      stdout: result.text || result.stdout,
      stderr: result.stderr,
      diff: { added: addedFiles },
    };
  }

  // ==================== Health Check ====================

  /**
   * Check if sandbox is healthy using SDK methods
   */
  async healthCheck(): Promise<boolean> {
    const { HEALTH_CHECK_MAX_ATTEMPTS, HEALTH_CHECK_INTERVAL_MS } = SCALEBOX_DEFAULTS;

    return guard
      .retry(
        async () => {
          if (!(await this.sandbox.isRunning())) {
            return false;
          }
          const info = await this.sandbox.getInfo();
          return info.status === 'running' || info.status === 'paused';
        },
        {
          maxAttempts: HEALTH_CHECK_MAX_ATTEMPTS,
          initialDelay: HEALTH_CHECK_INTERVAL_MS,
          maxDelay: HEALTH_CHECK_INTERVAL_MS,
          backoffFactor: 1,
        },
      )
      .orElse(async () => false);
  }

  // ==================== Private Helpers ====================

  private async runCommand(logger: PinoLogger, cmd: string, label: string): Promise<void> {
    const sid = this.sandboxId;
    logger.info({ sid, cmd: cmd.replace(/echo "[^"]*"/, 'echo "***"') }, `[${label}:cmd]`);

    const result = await this.sandbox.commands.run(cmd);
    logger.info(
      { sid, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr },
      `[${label}:result]`,
    );

    if (result.exitCode !== 0) {
      throw new SandboxMountException(result.stderr, sid);
    }
  }

  private async acquireDriveMount(
    logger: PinoLogger,
    s3Config: S3Config,
    s3DrivePath: string,
  ): Promise<readonly [undefined, () => Promise<void>]> {
    const mountPoint = this.cwd;
    const sid = this.sandboxId;

    const mountCmd = buildS3MountCommand(s3Config, s3DrivePath, mountPoint);
    logger.info(
      { sid, s3DrivePath, mountCmd: mountCmd.replace(/echo "[^"]*"/, 'echo "***"') },
      '[mount:s3fs]',
    );
    await this.runCommand(logger, mountCmd, 'mount');

    await new Promise((resolve) => setTimeout(resolve, MOUNT_WAIT_MS));
    logger.info({ sid }, '[mount:done]');

    const umountCmd = buildS3UmountCommand(mountPoint);
    return [
      undefined,
      async () => {
        logger.info({ sid }, '[umount:start]');
        await this.runCommand(logger, umountCmd, 'umount');
        logger.info({ sid }, '[umount:done]');
      },
    ] as const;
  }

  private async listCwdFiles(): Promise<string[]> {
    const files = await this.sandbox.files.list(this.cwd);
    return files.map((file) => file.name);
  }
}
