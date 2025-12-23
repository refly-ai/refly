import { Sandbox } from '@scalebox/sdk';
import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteParams } from '@refly/openapi-schema';

import { guard } from '../../../../utils/guard';
import { Trace } from '@refly/observability';
import {
  SandboxLifecycleException,
  LifecycleOperation,
  SandboxCreationException,
  SandboxConnectionException,
} from '../scalebox.exception';
import {
  ExecutionContext,
  ExecuteCodeContext,
  ExecutorOutput,
  OnLifecycleFailed,
} from '../scalebox.dto';
import { SCALEBOX_DEFAULTS } from '../scalebox.constants';

/**
 * Constructor parameters for BaseSandboxWrapper
 */
export type SandboxWrapperParams = [
  sandbox: Sandbox,
  logger: PinoLogger,
  context: ExecutionContext,
  cwd: string,
  createdAt: number,
  idleSince: number,
];

/**
 * Sandbox metadata for persistence and reconnection
 */
export interface SandboxMetadata {
  sandboxId: string;
  cwd: string;
  createdAt: number;
  idleSince: number;
  isPaused?: boolean;
  lastPausedAt?: number;
}

/**
 * Abstract interface for sandbox wrapper implementations
 * Supports both refly-executor-slim and code-interpreter templates
 */
export interface ISandboxWrapper {
  // ==================== Properties ====================
  readonly sandboxId: string;
  readonly canvasId: string;
  readonly cwd: string;
  readonly createdAt: number;
  readonly idleSince: number;
  readonly context: ExecutionContext;

  // ==================== Execution ====================
  /**
   * Execute code in sandbox
   * @returns ExecutorOutput - unified output format for both implementations
   */
  executeCode(params: SandboxExecuteParams, ctx: ExecuteCodeContext): Promise<ExecutorOutput>;

  // ==================== Lifecycle ====================
  getInfo(): Promise<unknown>;
  healthCheck(): Promise<boolean>;
  betaPause(): Promise<void>;
  kill(): Promise<void>;

  // ==================== State Management ====================
  toMetadata(): SandboxMetadata;
  markAsRunning(): void;
  markAsIdle(): void;
  markAsPaused(): void;
}

// ==================== Lifecycle Utilities ====================

/**
 * Create a new sandbox instance
 */
export async function createSandbox(
  templateName: string,
  apiKey: string,
  timeoutMs: number,
): Promise<Sandbox> {
  return guard(() => Sandbox.create(templateName, { apiKey, timeoutMs })).orThrow(
    (err) => new SandboxLifecycleException('create', err),
  );
}

/**
 * Connect to an existing sandbox instance
 */
export async function connectSandbox(sandboxId: string, apiKey: string): Promise<Sandbox> {
  return guard(() => Sandbox.connect(sandboxId, { apiKey })).orThrow(
    (err) => new SandboxLifecycleException('reconnect', err, sandboxId),
  );
}

/**
 * Verify sandbox is healthy after create/reconnect
 */
export async function ensureHealthy(
  wrapper: ISandboxWrapper,
  operation: LifecycleOperation,
): Promise<void> {
  const isReady = await guard(() => wrapper.healthCheck()).orThrow(
    (err) => new SandboxLifecycleException(operation, err, wrapper.sandboxId),
  );

  guard
    .ensure(isReady)
    .orThrow(
      () =>
        new SandboxLifecycleException(
          operation,
          `Sandbox ${wrapper.sandboxId} failed health check after ${operation}`,
          wrapper.sandboxId,
        ),
    );
}

/**
 * Restore pause state from metadata
 */
export function restorePauseState(wrapper: BaseSandboxWrapper, metadata: SandboxMetadata): void {
  if (metadata.isPaused) {
    wrapper.setPauseState(true, metadata.lastPausedAt);
  }
}

/**
 * Wrap lifecycle operation with retry logic
 */
export async function withLifecycleRetry<T extends ISandboxWrapper>(
  operation: 'create' | 'reconnect',
  logger: PinoLogger,
  innerFn: () => Promise<T>,
  onFailed?: OnLifecycleFailed,
): Promise<T> {
  const { LIFECYCLE_RETRY_MAX_ATTEMPTS, LIFECYCLE_RETRY_DELAY_MS } = SCALEBOX_DEFAULTS;
  const errors: string[] = [];

  return guard
    .retry(innerFn, {
      maxAttempts: LIFECYCLE_RETRY_MAX_ATTEMPTS,
      initialDelay: LIFECYCLE_RETRY_DELAY_MS,
      maxDelay: LIFECYCLE_RETRY_DELAY_MS,
      backoffFactor: 1,
      onRetry: (err) => {
        const error = err as SandboxLifecycleException;
        errors.push(error.message);
        logger.warn({ error: error.message }, `Sandbox ${operation} attempt failed`);
        if (error.sandboxId) {
          onFailed?.(error.sandboxId, error);
        }
      },
    })
    .orThrow(() => {
      const Exception =
        operation === 'create' ? SandboxCreationException : SandboxConnectionException;
      return new Exception(
        `${operation} failed after ${LIFECYCLE_RETRY_MAX_ATTEMPTS} attempts: ${errors.join('; ')}`,
      );
    });
}

// ==================== Abstract Base Class ====================

/**
 * Base class for sandbox wrapper implementations
 * Provides shared state management and lifecycle methods
 */
export abstract class BaseSandboxWrapper implements ISandboxWrapper {
  protected isPaused = false;
  protected lastPausedAt?: number;
  protected _idleSince: number;

  protected constructor(
    protected readonly sandbox: Sandbox,
    protected readonly logger: PinoLogger,
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

  /**
   * Internal method to restore pause state from metadata
   */
  setPauseState(isPaused: boolean, lastPausedAt?: number): void {
    this.isPaused = isPaused;
    this.lastPausedAt = lastPausedAt;
  }

  async getInfo() {
    return this.sandbox.getInfo();
  }

  @Trace('sandbox.pause')
  async betaPause(): Promise<void> {
    const { PAUSE_RETRY_MAX_ATTEMPTS, PAUSE_RETRY_DELAY_MS } = SCALEBOX_DEFAULTS;

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
              maxAttempts: PAUSE_RETRY_MAX_ATTEMPTS,
              initialDelay: PAUSE_RETRY_DELAY_MS,
              maxDelay: PAUSE_RETRY_DELAY_MS,
              backoffFactor: 1,
            },
          )
          .orThrow(),
      (error) => this.logger.error({ sandboxId: this.sandboxId, error }, 'Failed to pause sandbox'),
    );
  }

  async kill(): Promise<void> {
    await this.sandbox.kill();
  }

  // ==================== Abstract Methods ====================

  abstract executeCode(
    params: SandboxExecuteParams,
    ctx: ExecuteCodeContext,
  ): Promise<ExecutorOutput>;

  abstract healthCheck(): Promise<boolean>;
}
