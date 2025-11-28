import type { ExecutionResult } from '@scalebox/sdk';
import stripAnsi from 'strip-ansi';

import { ERROR_MESSAGE_MAX_LENGTH } from './scalebox.constants';
import { SandboxException } from './scalebox.exception';

/**
 * Sleep helper function
 * @param ms - Milliseconds to sleep
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format error into structured code and message for response
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
 * Uses a robust approach that doesn't rely on specific traceback formats:
 * 1. Headline: "ErrorType: error value/message" (always available)
 * 2. Cleaned traceback as context (truncated, ANSI stripped)
 *
 * This approach is format-agnostic and lets the model parse details from traceback.
 */
export function extractErrorMessage(result: ExecutionResult): string {
  const error = result.error;

  // No structured error, fallback to raw output
  if (!error) {
    if (result.stderr) return truncateErrorMessage(result.stderr);
    if (result.exitCode !== 0 && result.stdout) return truncateErrorMessage(result.stdout);
    return '';
  }

  // Build headline: "ErrorType: error value"
  const errorType = error.name || 'Error';
  const errorValue = error.value || error.message || '';
  const headline = `${errorType}: ${errorValue}`;

  // Append cleaned traceback as context (model can parse details)
  if (error.traceback) {
    const cleanTraceback = truncateErrorMessage(error.traceback);
    return `${headline}\n\n${cleanTraceback}`;
  }

  return headline;
}

/**
 * Check if ExecutionResult contains a system-level transient error
 * These errors indicate infrastructure issues, not user code problems
 * @param result - The execution result to check
 * @returns true if the result contains a transient system error
 */
export function isGrpcTransientError(result: ExecutionResult): boolean {
  const errorName = result.error?.name?.toLowerCase() ?? '';
  const errorText = [result.error?.message, result.error?.traceback, result.stderr]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Timeout errors (gRPC code 1 = CANCELLED, often due to timeout)
  if (errorName.includes('timeout') || errorText.includes('timed out')) {
    return true;
  }

  // gRPC UNAVAILABLE (code 14) - service temporarily unavailable
  if (
    errorText.includes('unavailable') ||
    /code[:\s=]\s*14\b/.test(errorText) ||
    errorText.includes('502') ||
    errorText.includes('503')
  ) {
    return true;
  }

  // gRPC CANCELLED (code 1) - operation aborted
  if (/code[:\s=]\s*1\b/.test(errorText) && errorText.includes('aborted')) {
    return true;
  }

  return false;
}
