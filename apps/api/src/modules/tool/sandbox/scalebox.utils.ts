import { DriveFile, SandboxExecuteResponse } from '@refly/openapi-schema';
import type { ExecutionResult } from '@scalebox/sdk';
import stripAnsi from 'strip-ansi';

import { buildResponse } from '../../../utils';
import { SandboxException } from './scalebox.exception';
import { ScaleboxExecutionResult } from './scalebox.dto';
import { ERROR_MESSAGE_MAX_LENGTH } from './scalebox.constants';

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
  executionTime: number,
): SandboxExecuteResponse {
  return buildResponse<SandboxExecuteResponse>(true, {
    data: {
      output,
      error: result.error || '',
      exitCode: result.exitCode || 0,
      executionTime,
      files: processedFiles,
    },
  });
}

/**
 * Truncate error message to avoid excessive log size
 * Strips ANSI escape codes for better readability in JSON responses
 */
export function truncateErrorMessage(message: string): string {
  // Strip ANSI escape codes for better readability in JSON responses
  const cleanMessage = stripAnsi(message);

  if (cleanMessage.length <= ERROR_MESSAGE_MAX_LENGTH) {
    return cleanMessage;
  }
  return `${cleanMessage.slice(0, ERROR_MESSAGE_MAX_LENGTH)}[... more info]`;
}

/**
 * Extract error message from execution result
 * Tries multiple sources in priority order: traceback > error message > stderr > stdout
 */
export function extractErrorMessage(result: ExecutionResult): string {
  if (result.error?.traceback) return truncateErrorMessage(result.error.traceback);
  if (result.error?.message) return truncateErrorMessage(result.error.message);
  if (result.stderr) return truncateErrorMessage(result.stderr);
  if (result.exitCode !== 0 && result.stdout) return truncateErrorMessage(result.stdout);
  return '';
}

/**
 * Check if execution result indicates a critical sandbox failure
 * Critical failures require killing the sandbox instance
 */
export function isCriticalSandboxError(result: ExecutionResult): boolean {
  const stderr = result.stderr || '';
  return (
    stderr.includes('connection refused') ||
    stderr.includes('dial tcp') ||
    stderr.includes('failed to create context kernel')
  );
}

/**
 * Result of critical error check
 */
export interface CriticalErrorCheckResult {
  isCritical: boolean;
  stderr?: string;
}

/**
 * Check if error is a critical sandbox error that requires killing the sandbox
 * @param error - The error to check
 * @returns Check result with isCritical flag and stderr if applicable
 */
export function checkCriticalError(error: unknown): CriticalErrorCheckResult {
  const result = (error as any)?.context?.result as ExecutionResult | undefined;
  if (result && isCriticalSandboxError(result)) {
    return {
      isCritical: true,
      stderr: result.stderr,
    };
  }
  return { isCritical: false };
}
