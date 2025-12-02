import { SandboxExecuteParams } from '@refly/openapi-schema';

import { ExecutionContext, ExecuteCodeContext, ExecutorOutput } from '../scalebox.dto';

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
