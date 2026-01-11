/**
 * Unified JSON output helpers for CLI commands.
 * All CLI output MUST go through these functions.
 */

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
 * Output a success response and exit with code 0
 */
export function ok<T>(type: string, payload: T): never {
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
 * Output an error response and exit with appropriate code
 */
export function fail(
  code: string,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    hint?: string;
    exitCode?: number;
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
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
