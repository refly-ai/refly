/**
 * Unified output helpers for CLI commands.
 * Supports multiple output formats: json, pretty, compact, plain.
 * All CLI output MUST go through these functions.
 */

import {
  OutputFormatter,
  OutputFormat,
  resolveFormat,
  initFormatter,
  getFormatter,
  type FormatterOptions,
  type SuccessPayload,
  type SuggestedFix,
} from './formatter.js';

export type { OutputFormat, FormatterOptions, SuccessPayload, SuggestedFix };
export { OutputFormatter, resolveFormat, initFormatter, getFormatter };

export interface SuccessResponse<T = unknown> {
  ok: true;
  type: string;
  version: string;
  payload: T;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  hint?: string;
  suggestedFix?: SuggestedFix;
  /**
   * Indicates if the error can be fixed by adjusting parameters.
   * - true: Fix the parameters (see suggestedFix) and retry the SAME command
   * - false: The approach may not work, consider alternatives
   */
  recoverable?: boolean;
}

export interface ErrorResponse {
  ok: false;
  type: 'error';
  version: string;
  error: ErrorDetail;
}

export type CLIResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

const VERSION = '1.0';

/**
 * Global output configuration
 */
let outputConfig: {
  format: OutputFormat;
  noColor: boolean;
  verbose: boolean;
} = {
  format: 'pretty', // Default to pretty for better human readability
  noColor: false,
  verbose: false,
};

/**
 * Configure global output settings.
 * Call this early in CLI initialization.
 */
export function configureOutput(options: {
  format?: OutputFormat;
  noColor?: boolean;
  verbose?: boolean;
  autoDetect?: boolean;
}): void {
  outputConfig = {
    format: options.format || resolveFormat(undefined, options.autoDetect ?? true),
    noColor: options.noColor ?? false,
    verbose: options.verbose ?? false,
  };

  // Initialize the global formatter
  initFormatter(outputConfig);
}

/**
 * Get current output format
 */
export function getOutputFormat(): OutputFormat {
  return outputConfig.format;
}

/**
 * Check if using pretty output (non-JSON)
 */
export function isPrettyOutput(): boolean {
  return outputConfig.format !== 'json';
}

/**
 * Output a success response and exit with code 0
 */
export function ok<T>(type: string, payload: T): never {
  const formatter = getFormatter();
  formatter.success(type, payload as unknown as SuccessPayload);
  process.exit(0);
}

/**
 * Output a success response without exiting (for streaming/multiple outputs)
 */
export function print<T>(type: string, payload: T): void {
  const formatter = getFormatter();
  formatter.success(type, payload as unknown as SuccessPayload);
}

/**
 * Determine if an error is recoverable (can be fixed by adjusting parameters)
 */
function isRecoverableError(code: string, hasSuggestedFix: boolean): boolean {
  // Errors that are recoverable (fix parameters and retry)
  const recoverableCodes = [
    'INVALID_INPUT',
    'VALIDATION_ERROR',
    'INVALID_NODE_INPUT',
    'TIMEOUT', // Can retry
    'RATE_LIMIT', // Can retry after waiting
  ];

  // If there's a suggestedFix, it's likely recoverable
  if (hasSuggestedFix) return true;

  return recoverableCodes.includes(code);
}

/**
 * Output an error response and exit with appropriate code
 */
export function fail(
  code: string,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    hint?: string;
    exitCode?: number;
    suggestedFix?: SuggestedFix;
    recoverable?: boolean;
  },
): never {
  const formatter = getFormatter();
  const recoverable = options?.recoverable ?? isRecoverableError(code, !!options?.suggestedFix);

  formatter.error({
    code,
    message,
    details: options?.details,
    hint: options?.hint,
    suggestedFix: options?.suggestedFix,
    recoverable,
  });
  process.exit(options?.exitCode ?? getExitCode(code));
}

/**
 * Output an error without exiting
 */
export function printError(
  code: string,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    hint?: string;
    suggestedFix?: SuggestedFix;
  },
): void {
  const formatter = getFormatter();
  formatter.error({
    code,
    message,
    details: options?.details,
    hint: options?.hint,
    suggestedFix: options?.suggestedFix,
  });
}

/**
 * Legacy JSON output (for backward compatibility in scripts)
 */
export function okJson<T>(type: string, payload: T): never {
  const response: SuccessResponse<T> = {
    ok: true,
    type,
    version: VERSION,
    payload,
  };
  console.log(JSON.stringify(response, null, 2));
  process.exit(0);
}

/**
 * Legacy JSON error output (for backward compatibility in scripts)
 */
export function failJson(
  code: string,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    hint?: string;
    exitCode?: number;
    suggestedFix?: SuggestedFix;
  },
): never {
  const response: ErrorResponse = {
    ok: false,
    type: 'error',
    version: VERSION,
    error: {
      code,
      message,
      ...(options?.details && { details: options.details }),
      ...(options?.hint && { hint: options.hint }),
      ...(options?.suggestedFix && { suggestedFix: options.suggestedFix }),
    },
  };
  console.log(JSON.stringify(response, null, 2));
  process.exit(options?.exitCode ?? getExitCode(code));
}

/**
 * Map error codes to exit codes
 */
function getExitCode(code: string): number {
  if (code.startsWith('AUTH_')) return 2;
  if (code.startsWith('VALIDATION_') || code === 'INVALID_INPUT') return 3;
  if (code.startsWith('NETWORK_') || code === 'TIMEOUT') return 4;
  if (code.endsWith('_NOT_FOUND') || code === 'NOT_FOUND') return 5;
  return 1;
}

/**
 * Error codes used throughout the CLI
 */
export const ErrorCodes = {
  // Authentication
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',

  // CLI
  CLI_NOT_FOUND: 'CLI_NOT_FOUND',
  CONFIG_ERROR: 'CONFIG_ERROR',

  // Builder
  BUILDER_NOT_STARTED: 'BUILDER_NOT_STARTED',
  BUILDER_ALREADY_STARTED: 'BUILDER_ALREADY_STARTED',
  VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_NODE_ID: 'DUPLICATE_NODE_ID',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  CYCLE_DETECTED: 'CYCLE_DETECTED',
  INVALID_STATE: 'INVALID_STATE',

  // Workflow
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  WORKFLOW_EXISTS: 'WORKFLOW_EXISTS',
  RUN_NOT_FOUND: 'RUN_NOT_FOUND',

  // Node
  INVALID_NODE_TYPE: 'INVALID_NODE_TYPE',
  INVALID_NODE_INPUT: 'INVALID_NODE_INPUT',
  EXECUTION_FAILED: 'EXECUTION_FAILED',

  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  API_ERROR: 'API_ERROR',

  // General
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_INPUT: 'INVALID_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Variables
  MISSING_VARIABLES: 'MISSING_VARIABLES',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
