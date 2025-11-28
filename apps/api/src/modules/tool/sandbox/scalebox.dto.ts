import type { ExecutionResult, Language } from '@scalebox/sdk';
import {
  SandboxExecuteParams,
  SandboxExecuteContext,
  SandboxExecuteResponse,
  type DriveFile,
} from '@refly/openapi-schema';

import { SandboxException, SandboxExecutionBadResultException } from './scalebox.exception';
import { extractErrorMessage, isGrpcTransientError } from './scalebox.utils';

/**
 * Scalebox internal type definitions
 * These types are only used within the scalebox module
 */

/**
 * Re-export SandboxExecuteParams from OpenAPI schema for internal use
 */
export { SandboxExecuteParams };

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

  // Mutable internal fields
  registeredFiles?: DriveFile[];

  // Inherited optional fields from SandboxExecuteContext:
  // parentResultId?, targetId?, targetType?, model?, providerItemId?
}

/**
 * Scalebox execution job data (internal use)
 * @deprecated Use SandboxExecuteJobData instead
 */
export interface ScaleboxExecutionJobData {
  uid: string;
  code: string;
  language: Language;
  timeout?: number;
  canvasId: string;
  apiKey: string;
  s3DrivePath: string;
  version?: number;
}

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

/**
 * Scalebox execution result (internal use)
 */
export interface ScaleboxExecutionResult {
  originResult?: ExecutionResult;
  error: string;
  exitCode: number;
  files: DriveFile[];
}

/**
 * Simplified sandbox result for LLM consumption
 * Provides a flat, easy-to-parse structure
 */
export interface SimplifiedSandboxResult {
  /** Whether the execution succeeded */
  success: boolean;

  /** Content output based on execution result */
  content: {
    /** Type of content returned */
    type: 'text' | 'image' | 'error';
    /** Text output (for type: 'text') */
    text?: string;
    /** Image URL (for type: 'image') */
    imageUrl?: string;
    /** Formatted error message (for type: 'error') */
    error?: string;
  };

  /** Execution metadata */
  meta: {
    /** Exit code from sandbox execution */
    exitCode: number;
    /** Execution time in milliseconds */
    executionTimeMs: number;
    /** Machine-readable error code (if error occurred) */
    errorCode?: string;
  };
}

/**
 * Type guard for SandboxExecutionBadResultException
 * Handles both native instances AND serialized objects from BullMQ
 *
 * BullMQ serializes exceptions to JSON, losing prototype chain.
 * After deserialization, instanceof checks fail, but properties are preserved:
 * { type, name, code, result, message, stack, context }
 */
function isBadResultException(
  error: unknown,
): error is { result: ExecutionResult; code: string; message: string } {
  if (error instanceof SandboxExecutionBadResultException) {
    return true;
  }
  // Check for serialized exception from BullMQ
  const e = error as Record<string, unknown>;
  return (
    e?.code === 'SANDBOX_EXECUTION_BAD_RESULT' &&
    typeof e?.result === 'object' &&
    e?.result !== null &&
    'exitCode' in (e.result as object)
  );
}

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
  success(
    output: string,
    files: DriveFile[],
    result: ScaleboxExecutionResult,
    executionTime: number,
  ): SandboxExecuteResponse {
    return {
      status: 'success',
      data: {
        output,
        error: result.error || '',
        exitCode: result.exitCode ?? 0,
        executionTime,
        files,
      },
    };
  },

  /**
   * Build error response - automatically classifies as code error or system error
   *
   * Classification logic:
   * 1. SandboxExecutionBadResultException with gRPC transient error → system_error (retry suggested)
   * 2. SandboxExecutionBadResultException without gRPC error → code_error (model can fix)
   * 3. Other exceptions → system_error (infrastructure failure)
   *
   * Note: Uses property-based check instead of instanceof to handle
   * BullMQ serialized exceptions that lose their prototype chain.
   */
  error(error: unknown, executionTime: number): SandboxExecuteResponse {
    // Check for code execution error (handles both native and BullMQ-serialized exceptions)
    if (isBadResultException(error)) {
      const result = error.result;

      // Check if it's a gRPC transient error (502/503 UNAVAILABLE)
      // These are system errors, not code errors - retry may help
      if (isGrpcTransientError(result)) {
        return {
          status: 'failed',
          data: null,
          errors: [
            {
              code: 'SANDBOX_TRANSIENT_ERROR',
              message:
                'Sandbox service temporarily unavailable. This is a transient error, please retry the request.',
            },
          ],
        };
      }

      // Code error: non-zero exitCode from user's code
      // Return success with exitCode != 0 so model can fix the code
      return {
        status: 'success',
        data: {
          output: result.text || '',
          error: extractErrorMessage(result),
          exitCode: result.exitCode,
          executionTime,
          files: [],
        },
      };
    }

    // System error: infrastructure failure (sandbox creation, lock timeout, etc.)
    // Return failed status - model cannot fix this by changing code
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
  // Return raw message without prefix - agent-tools will add appropriate prefix
  if (error instanceof Error) {
    return { code: 'QUEUE_EXECUTION_FAILED', message: error.message };
  }
  return { code: 'QUEUE_EXECUTION_FAILED', message: String(error) };
}
