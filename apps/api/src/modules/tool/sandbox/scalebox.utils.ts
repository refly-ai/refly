import { DriveFile, SandboxExecuteResponse } from '@refly/openapi-schema';

import { buildResponse } from '../../../utils';
import { SandboxException } from './scalebox.exception';
import { ScaleboxExecutionResult } from './scalebox.dto';

export interface PerformanceResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  executionTime: number;
}

/**
 * Measure execution time of an async task
 * Returns success/failure with execution time
 *
 * @param task - Async task to execute
 * @returns Result with data or error, and execution time
 *
 * @example
 * const result = await performance(() => doWork());
 * if (!result.success) {
 *   console.error(`Task failed in ${result.executionTime}ms:`, result.error);
 *   return;
 * }
 * console.log(`Task succeeded in ${result.executionTime}ms:`, result.data);
 */
export async function performance<T>(task: () => Promise<T>): Promise<PerformanceResult<T>> {
  const startTime = Date.now();

  try {
    const data = await task();
    return {
      success: true,
      data,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error,
      executionTime: Date.now() - startTime,
    };
  }
}

// TODO: use a singleton function with drive service to build the s3 path
export function buildS3Path(prefix: string, uid: string, canvasId: string, name = ''): string {
  return [prefix, uid, canvasId, name].filter(Boolean).join('/');
}

/**
 * Sleep helper function
 * @param ms - Milliseconds to sleep
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format error into structured code and message
 */
export function formatError(error: unknown): { code: string; message: string } {
  const message =
    error instanceof SandboxException
      ? error.getFormattedMessage()
      : error instanceof Error
        ? `[Unknown error]: ${error.message}`
        : `[Unknown error]: ${String(error)}`;
  const code = error instanceof SandboxException ? error.code : 'QUEUE_EXECUTION_FAILED';
  return { code, message };
}

/**
 * Build successful sandbox execution response
 */
export function buildSuccessResponse(
  output: string,
  processedFiles: DriveFile[],
  result: ScaleboxExecutionResult,
): SandboxExecuteResponse {
  return buildResponse<SandboxExecuteResponse>(true, {
    data: {
      output,
      error: result.error || '',
      exitCode: result.exitCode || 0,
      executionTime: result.executionTime || 0,
      files: processedFiles,
    },
  });
}

/**
 * Poll until task returns a non-null result or timeout
 *
 * @param task - Task to execute, returns result or null to continue polling
 * @param onTimeout - Async function that throws exception when timeout is reached
 * @param options - Polling options with defaults
 * @returns The result when task succeeds
 *
 * @example
 * const result = await poll(
 *   async () => {
 *     const item = await tryGetItem();
 *     if (item) return item;
 *     return null; // Continue polling
 *   },
 *   async () => {
 *     throw new TimeoutException('Item not available');
 *   },
 *   { timeout: 30000 }
 * );
 */
export async function poll<T>(
  task: () => Promise<T | null>,
  onTimeout: () => Promise<never>,
  options: {
    timeout?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {},
): Promise<T> {
  const { timeout = 30000, initialDelay = 100, maxDelay = 1000, backoffFactor = 1.5 } = options;

  const startTime = Date.now();
  let delay = initialDelay;

  while (Date.now() - startTime < timeout) {
    const result = await task();
    if (result !== null) return result;

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * backoffFactor, maxDelay);
  }

  await onTimeout();
}
