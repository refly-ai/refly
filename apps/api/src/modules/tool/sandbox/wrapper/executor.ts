import { Sandbox } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteParams } from '@refly/openapi-schema';

import { guard } from '../../../../utils/guard';
import { Trace } from '../scalebox.tracer';

import {
  SandboxCreationException,
  SandboxExecutionFailedException,
  SandboxConnectionException,
  SandboxAcquireException,
  SandboxLanguageNotSupportedException,
} from '../scalebox.exception';
import {
  SANDBOX_DRIVE_MOUNT_POINT,
  SCALEBOX_DEFAULTS,
  EXECUTOR_CREDENTIALS_PATH,
} from '../scalebox.constants';
import {
  ExecutionContext,
  ExecuteCodeContext,
  ExecutorInput,
  ExecutorOutput,
  OnLifecycleFailed,
  S3Config,
  mapLanguage,
} from '../scalebox.dto';
import { ISandboxWrapper, SandboxMetadata } from './base';

/**
 * ExecutorWrapper - Implementation using refly-executor-slim custom template
 *
 * Features:
 * - Uses refly-executor-slim binary for code execution
 * - Built-in S3 FUSE mount (no server-side s3fs)
 * - Automatic file diff tracking via executor
 * - Resource limits support
 */
export class ExecutorWrapper implements ISandboxWrapper {
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
    this.logger.setContext(ExecutorWrapper.name);
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
    templateName: string,
    timeoutMs: number,
  ): Promise<ExecutorWrapper> {
    logger.info({ canvasId: context.canvasId, templateName }, 'Creating sandbox');

    const sandbox = await guard(() =>
      Sandbox.create(templateName, {
        apiKey: context.apiKey,
        timeoutMs,
      }),
    ).orThrow((err) => new SandboxAcquireException(err));

    const now = Date.now();
    const wrapper = new ExecutorWrapper(
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
  ): Promise<ExecutorWrapper> {
    logger.info({ sandboxId: metadata.sandboxId }, 'Reconnecting to sandbox');

    const sandbox = await guard(() =>
      Sandbox.connect(metadata.sandboxId, { apiKey: context.apiKey }),
    ).orThrow((err) => new SandboxAcquireException(err, metadata.sandboxId));

    const wrapper = new ExecutorWrapper(
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
    templateName: string,
    timeoutMs: number,
    onFailed?: OnLifecycleFailed,
  ): Promise<ExecutorWrapper> {
    const { LIFECYCLE_RETRY_MAX_ATTEMPTS, LIFECYCLE_RETRY_DELAY_MS } = SCALEBOX_DEFAULTS;
    const errors: string[] = [];

    return guard
      .retry(() => ExecutorWrapper.createInner(logger, context, templateName, timeoutMs), {
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
  ): Promise<ExecutorWrapper> {
    const { LIFECYCLE_RETRY_MAX_ATTEMPTS, LIFECYCLE_RETRY_DELAY_MS } = SCALEBOX_DEFAULTS;
    const errors: string[] = [];

    return guard
      .retry(() => ExecutorWrapper.reconnectInner(logger, context, metadata), {
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

  @Trace('sandbox.executeCode', { 'operation.type': 'code_execution' })
  async executeCode(
    params: SandboxExecuteParams,
    ctx: ExecuteCodeContext,
  ): Promise<ExecutorOutput> {
    const { logger, timeoutMs, s3Config, s3DrivePath, limits, codeSizeThreshold } = ctx;
    const sid = this.sandboxId;

    logger.info({ sid, language: params.language }, '[exec:start]');

    // 1. Map language
    const language = mapLanguage(params.language);
    if (!language) {
      throw new SandboxLanguageNotSupportedException(params.language);
    }

    // 2. Write S3 credentials file
    logger.debug({ sid }, '[exec:cred]');
    await this.writeCredentials(s3Config);

    // 3. Prepare code (inline vs path mode)
    const codeBytes = Buffer.byteLength(params.code, 'utf8');
    const usePathMode = codeBytes > codeSizeThreshold;

    let input: ExecutorInput;

    if (usePathMode) {
      // Large code: write to file first, then use path mode
      const codePath = '/tmp/code_script';
      logger.debug({ sid, codeBytes }, '[exec:write-file]');
      await this.sandbox.files.write(codePath, params.code);
      input = {
        path: codePath,
        language,
        timeout: Math.floor(timeoutMs / 1000),
        cwd: this.cwd,
        delete: true, // Delete code file after execution
        s3: this.buildS3Input(s3Config, s3DrivePath),
        limits,
      };
    } else {
      // Small code: inline mode
      input = {
        code: Buffer.from(params.code).toString('base64'),
        language,
        timeout: Math.floor(timeoutMs / 1000),
        cwd: this.cwd,
        s3: this.buildS3Input(s3Config, s3DrivePath),
        limits,
      };
    }

    // 4. Execute via executor binary
    logger.debug({ sid }, '[exec:run]');
    const escaped = JSON.stringify(input).replace(/'/g, "'\"'\"'");
    const result = await guard(() =>
      this.sandbox.commands.run(`printf '%s' '${escaped}' | refly-executor-slim`, {
        timeoutMs: timeoutMs + 10000, // Extra buffer for executor overhead
      }),
    ).orThrow((error) => {
      logger.warn({ sid, error }, '[exec:run:failed]');
      return new SandboxExecutionFailedException(error);
    });

    // 5. Parse output
    const output = this.parseExecutorOutput(result.stdout);

    logger.info(
      { sid, exitCode: output.exitCode, files: output.diff?.added?.length ?? 0 },
      '[exec:done]',
    );

    return output;
  }

  /**
   * Write S3 credentials to file in sandbox
   * Executor will read and delete this file automatically
   */
  private async writeCredentials(s3Config: S3Config): Promise<void> {
    const content = `${s3Config.accessKey}:${s3Config.secretKey}`;
    await guard(() =>
      this.sandbox.commands.run(`printf '%s' '${content}' > ${EXECUTOR_CREDENTIALS_PATH}`),
    ).orThrow((error) => {
      this.logger.warn({ sid: this.sandboxId, error }, '[exec:cred:failed]');
      return new SandboxExecutionFailedException(error);
    });
  }

  /**
   * Build S3 input config for executor
   */
  private buildS3Input(s3Config: S3Config, s3DrivePath: string) {
    return {
      endpoint: s3Config.endPoint,
      passwdFile: EXECUTOR_CREDENTIALS_PATH,
      bucket: s3Config.bucket,
      region: s3Config.region,
      prefix: s3DrivePath,
    };
  }

  /**
   * Parse executor JSON output from stdout
   * Handles cases where stdout may contain log lines before the JSON
   */
  private parseExecutorOutput(stdout: string): ExecutorOutput {
    const trimmed = stdout.trim();

    this.logger.debug(
      {
        sandboxId: this.sandboxId,
        stdoutLength: stdout?.length,
        trimmedLength: trimmed?.length,
        stdoutPreview: trimmed?.slice(0, 500),
      },
      '[parseExecutorOutput] Parsing stdout',
    );

    if (!trimmed) {
      throw new SandboxExecutionFailedException('No output from executor');
    }

    // Find last JSON line (executor outputs JSON as last line)
    const lines = trimmed.split('\n');
    this.logger.debug(
      { sandboxId: this.sandboxId, lineCount: lines.length },
      '[parseExecutorOutput] Split into lines',
    );

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const parsed = JSON.parse(line);
          this.logger.debug(
            {
              sandboxId: this.sandboxId,
              lineIndex: i,
              parsedKeys: Object.keys(parsed),
              hasDiff: !!parsed.diff,
              diffKeys: parsed.diff ? Object.keys(parsed.diff) : null,
            },
            '[parseExecutorOutput] Successfully parsed JSON',
          );
          return parsed;
        } catch (e) {
          this.logger.warn(
            { sandboxId: this.sandboxId, lineIndex: i, error: e.message },
            '[parseExecutorOutput] JSON parse failed, trying previous line',
          );
        }
      }
    }

    throw new SandboxExecutionFailedException(`Invalid executor output: ${trimmed.slice(0, 200)}`);
  }

  async kill(): Promise<void> {
    await this.sandbox.kill();
  }

  /**
   * Check if sandbox and executor are ready
   * Verifies executor binary is available and working
   */
  async healthCheck(): Promise<boolean> {
    const { HEALTH_CHECK_MAX_ATTEMPTS, HEALTH_CHECK_INTERVAL_MS } = SCALEBOX_DEFAULTS;

    return guard
      .retry(
        () =>
          this.sandbox.commands.run('refly-executor-slim --version').then((r) => r.exitCode === 0),
        {
          maxAttempts: HEALTH_CHECK_MAX_ATTEMPTS,
          initialDelay: HEALTH_CHECK_INTERVAL_MS,
          maxDelay: HEALTH_CHECK_INTERVAL_MS,
          backoffFactor: 1,
        },
      )
      .orElse(async () => false);
  }
}
