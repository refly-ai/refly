import { PinoLogger } from 'nestjs-pino';
import {
  SandboxExecuteParams,
  SandboxExecuteContext,
  SandboxExecuteResponse,
  type DriveFile,
} from '@refly/openapi-schema';

import { SandboxException } from './scalebox.exception';
import { ExecutorLanguage, ExecutorLimits, LANGUAGE_MAP } from './scalebox.constants';
import { extractWarnings } from './scalebox.utils';

// S3 configuration interface (shared between dto and wrapper)
export interface S3Config {
  endPoint: string; // MinIO SDK uses 'endPoint' with capital P
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

/**
 * Scalebox internal type definitions
 * These types are only used within the scalebox module
 */

/**
 * Re-export SandboxExecuteParams from OpenAPI schema for internal use
 */
export { SandboxExecuteParams };

// ==================== Executor Types ====================

/**
 * Executor input format (stdin JSON)
 * Used to communicate with refly-executor-slim binary
 */
export interface ExecutorInput {
  /** Base64 encoded code (inline mode) */
  code?: string;
  /** Path to code file (path mode for large code) */
  path?: string;
  /** Programming language */
  language: ExecutorLanguage;
  /** Execution timeout in seconds */
  timeout: number;
  /** Working directory (also S3 mount point) */
  cwd: string;
  /** Delete code file after execution (path mode only) */
  delete?: boolean;
  /** S3 mount configuration */
  s3?: {
    endpoint: string;
    passwdFile: string;
    bucket: string;
    region: string;
    prefix: string;
  };
  /** Resource limits */
  limits?: Partial<ExecutorLimits>;
}

/**
 * Executor output format (stdout JSON)
 * Returned by refly-executor-slim binary
 */
export interface ExecutorOutput {
  /** Process exit code */
  exitCode?: number;
  /** Standard output */
  stdout?: string;
  /** Standard error */
  stderr?: string;
  /** Executor internal log */
  log?: string;
  /** System-level error message (not code error) */
  error?: string;
  /** File changes */
  diff?: {
    /** Files created during execution */
    added: string[];
  };
}

/**
 * Map language from OpenAPI schema to executor supported language
 * @returns mapped language or null if not supported
 */
export function mapLanguage(language: string): ExecutorLanguage | null {
  return LANGUAGE_MAP[language] ?? null;
}

// ==================== Execution Context ====================

/**
 * Execution context information
 * Extends SandboxExecuteContext with internal required fields
 */
export interface ExecutionContext extends Partial<SandboxExecuteContext> {
  // Internal required fields
  uid: string;
  apiKey: string;
  canvasId: string; // Override as required
  s3DrivePath: string; // S3 storage path for this execution
  version?: number;

  // Mutable internal fields (set during execution)
  registeredFiles?: DriveFile[];

  // Inherited optional fields from SandboxExecuteContext:
  // parentResultId?, targetId?, targetType?, model?, providerItemId?
}

/**
 * Context passed to wrapper.executeCode()
 */
export interface ExecuteCodeContext {
  logger: PinoLogger;
  timeoutMs: number;
  s3Config: S3Config;
  s3DrivePath: string;
  limits: ExecutorLimits;
  codeSizeThreshold: number;
}

// ==================== Job Data Types ====================

/**
 * BullMQ job data for sandbox execution
 * Contains all parameters needed for executeCode
 */
export interface SandboxExecuteJobData {
  params: SandboxExecuteParams;
  context: ExecutionContext;
}

/**
 * BullMQ job data for sandbox pause (auto-pause feature)
 */
export interface SandboxPauseJobData {
  sandboxId: string;
}

/**
 * BullMQ job data for sandbox kill (async cleanup)
 */
export interface SandboxKillJobData {
  sandboxId: string;
  label: string; // Log identifier, e.g., 'create:attempt1'
}

/**
 * Callback for sandbox lifecycle failure (create/reconnect)
 * Called when an attempt fails, allowing caller to handle async cleanup
 */
export type OnLifecycleFailed = (sandboxId: string, error: Error) => void;

/**
 * Union type for all sandbox job types
 */
export type SandboxJobData = SandboxExecuteJobData | SandboxPauseJobData;

// ==================== Execution Result ====================

/**
 * Scalebox execution result (internal use)
 * Contains the executor output and registered files
 */
export interface ScaleboxExecutionResult {
  /** Raw executor output */
  executorOutput: ExecutorOutput;
  /** Extracted error message (from stderr or error field) */
  error: string;
  /** Process exit code */
  exitCode: number;
  /** Files registered to drive after execution */
  files: DriveFile[];
}

// ==================== Response Factory ====================

/**
 * Factory for building sandbox execution responses
 *
 * Response status mapping:
 * - status='success' + exitCode=0: Code executed successfully
 * - status='success' + exitCode!=0: Code error (syntax error, runtime exception, etc.)
 * - status='failed': System error (sandbox creation failed, lock timeout, etc.)
 */
export const ScaleboxResponseFactory = {
  /**
   * Build success response (covers both successful execution and code errors)
   * Code errors are indicated by non-zero exitCode
   */
  success(result: ScaleboxExecutionResult, executionTime: number): SandboxExecuteResponse {
    const { executorOutput, error, exitCode, files } = result;
    const warnings = extractWarnings(executorOutput.log);

    return {
      status: 'success',
      data: {
        output: executorOutput.stdout || '',
        error: error || '',
        exitCode: exitCode ?? 0,
        executionTime,
        files,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  },

  /**
   * Build error response for system errors
   * Used when execution cannot complete due to infrastructure issues
   */
  error(error: unknown, _executionTime: number): SandboxExecuteResponse {
    return {
      status: 'failed',
      data: null,
      errors: [formatSandboxError(error)],
    };
  },
};

/** Format error into structured code and message for response */
function formatSandboxError(error: unknown): { code: string; message: string } {
  if (error instanceof SandboxException) {
    return { code: error.code, message: error.getFormattedMessage() };
  }
  if (error instanceof Error) {
    return { code: 'SANDBOX_EXECUTION_FAILED', message: error.message };
  }
  return { code: 'SANDBOX_EXECUTION_FAILED', message: String(error) };
}
