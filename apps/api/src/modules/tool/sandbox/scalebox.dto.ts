import type { ExecutionResult, Language } from '@scalebox/sdk';
import { SandboxExecuteParams, SandboxExecuteContext } from '@refly/openapi-schema';

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
  version?: number;

  // Inherited optional fields from SandboxExecuteContext:
  // parentResultId?, targetId?, targetType?, model?, providerItemId?
}

/**
 * Scalebox execution job data (internal use)
 */
export interface ScaleboxExecutionJobData {
  uid: string;
  code: string;
  language: Language;
  timeout?: number;
  canvasId: string;
  apiKey: string;
  version?: number;
}

/**
 * Scalebox execution result (internal use)
 */
export interface ScaleboxExecutionResult {
  originResult?: ExecutionResult;
  error: string;
  exitCode: number;
  executionTime: number;
  files?: string[];
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
