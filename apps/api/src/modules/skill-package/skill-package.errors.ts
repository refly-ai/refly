/**
 * CLI Error Codes and Helpers for Skill Package API
 */

import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Standard CLI error codes for skill package operations
 */
export const SKILL_CLI_ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_SPEC: 'INVALID_SPEC',
  DESCRIPTION_REQUIRED: 'DESCRIPTION_REQUIRED',

  // Resource errors
  SKILL_NOT_FOUND: 'SKILL_NOT_FOUND',
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  ACCESS_DENIED: 'ACCESS_DENIED',

  // Execution errors
  WORKFLOW_GENERATION_FAILED: 'WORKFLOW_GENERATION_FAILED',
  SKILL_CREATION_FAILED: 'SKILL_CREATION_FAILED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',

  // Conflict errors
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  ALREADY_INSTALLED: 'ALREADY_INSTALLED',

  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * CLI Error Response interface
 */
interface CliErrorResponse {
  ok: false;
  type: 'error';
  version: string;
  error: {
    code: string;
    message: string;
    hint?: string;
    recoverable?: boolean;
    details?: Record<string, unknown>;
    suggestedFix?: {
      field?: string;
      format?: string;
      example?: string;
    };
  };
}

/**
 * Build a CLI-style error response
 */
function buildCliErrorResponse(
  code: string,
  message: string,
  hint?: string,
  details?: Record<string, unknown>,
  suggestedFix?: {
    field?: string;
    format?: string;
    example?: string;
  },
  recoverable?: boolean,
): CliErrorResponse {
  return {
    ok: false,
    type: 'error',
    version: '1.0',
    error: {
      code,
      message,
      hint,
      ...(recoverable !== undefined && { recoverable }),
      details,
      ...(suggestedFix && { suggestedFix }),
    },
  };
}

/**
 * Throw a CLI-style HTTP exception
 */
export function throwCliError(
  code: string,
  message: string,
  hint?: string,
  status: HttpStatus = HttpStatus.BAD_REQUEST,
  details?: Record<string, unknown>,
  suggestedFix?: {
    field?: string;
    format?: string;
    example?: string;
  },
  recoverable?: boolean,
): never {
  throw new HttpException(
    buildCliErrorResponse(code, message, hint, details, suggestedFix, recoverable),
    status,
  );
}

/**
 * Map common errors to CLI error codes
 */
export function mapErrorToCliCode(error: Error): {
  code: string;
  status: HttpStatus;
  hint?: string;
} {
  const message = error.message.toLowerCase();

  if (message.includes('not found')) {
    if (message.includes('workflow') || message.includes('canvas')) {
      return {
        code: SKILL_CLI_ERROR_CODES.WORKFLOW_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        hint: 'Check the workflow ID and try again',
      };
    }
    if (message.includes('skill')) {
      return {
        code: SKILL_CLI_ERROR_CODES.SKILL_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        hint: 'Check the skill ID and try again',
      };
    }
  }

  if (message.includes('access denied') || message.includes('permission')) {
    return {
      code: SKILL_CLI_ERROR_CODES.ACCESS_DENIED,
      status: HttpStatus.FORBIDDEN,
      hint: 'You do not have permission to access this resource',
    };
  }

  if (message.includes('already installed')) {
    return {
      code: SKILL_CLI_ERROR_CODES.ALREADY_INSTALLED,
      status: HttpStatus.CONFLICT,
      hint: 'Use --force to reinstall',
    };
  }

  if (message.includes('duplicate') || message.includes('already exists')) {
    return {
      code: SKILL_CLI_ERROR_CODES.DUPLICATE_NAME,
      status: HttpStatus.CONFLICT,
      hint: 'Use a different name',
    };
  }

  if (message.includes('generate') || message.includes('copilot')) {
    return {
      code: SKILL_CLI_ERROR_CODES.WORKFLOW_GENERATION_FAILED,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      hint: 'Try using --workflow-query with a more specific description',
    };
  }

  if (message.includes('invalid') || message.includes('validation')) {
    return {
      code: SKILL_CLI_ERROR_CODES.VALIDATION_ERROR,
      status: HttpStatus.BAD_REQUEST,
      hint: 'Check the input format and try again',
    };
  }

  return {
    code: SKILL_CLI_ERROR_CODES.INTERNAL_ERROR,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    hint: 'An unexpected error occurred. Please try again later',
  };
}
