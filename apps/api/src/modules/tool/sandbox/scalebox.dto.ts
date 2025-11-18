import type { ExecutionResult, Language } from '@scalebox/sdk';

/**
 * Scalebox internal type definitions
 * These types are only used within the scalebox module
 */

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
}

/**
 * Scalebox execution result (internal use)
 */
export interface ScaleboxExecutionResult {
  originResult?: ExecutionResult;
  error: string;
  exitCode: number;
  executionTime: number;
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
