import type { ExecutionResult } from '@scalebox/sdk';

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
  language?: string;
  timeout?: number;
  canvasId?: string;
  apiKey: string; // API key passed from config
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
