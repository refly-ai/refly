import stripAnsi from 'strip-ansi';

import { ERROR_MESSAGE_MAX_LENGTH } from './scalebox.constants';
import { SandboxException } from './scalebox.exception';
import { ExecutorOutput } from './scalebox.dto';

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
  const code = error instanceof SandboxException ? error.code : 'SANDBOX_EXECUTION_FAILED';
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
 * Extract error message from executor output
 *
 * Priority:
 * 1. executor.error (system-level error from executor)
 * 2. executor.stderr (code execution stderr)
 * 3. Empty string (no error)
 */
export function extractErrorMessage(output: ExecutorOutput): string {
  // System-level error from executor
  if (output.error) {
    return truncateErrorMessage(output.error);
  }

  // Code execution stderr
  if (output.stderr) {
    return truncateErrorMessage(output.stderr);
  }

  return '';
}

/**
 * Extract warnings from executor log
 *
 * Executor log format:
 * - [INFO] Inline code: 45 bytes
 * - [WARN] ⚠️ File 'x' exists, saved as 'revN--x'. Please save to a different filename.
 *
 * @param log - Executor log string with [WARN], [INFO] prefixes
 * @returns Array of warning messages (without [WARN] prefix)
 */
export function extractWarnings(log: string | undefined): string[] {
  if (!log) return [];

  return log
    .split('\n')
    .filter((line) => line.startsWith('[WARN]'))
    .map((line) => line.replace(/^\[WARN\]\s*/, '').trim())
    .filter(Boolean);
}
