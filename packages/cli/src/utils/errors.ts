/**
 * Custom error classes for CLI operations
 */

import { ErrorCode, ErrorCodes, type SuggestedFix } from './output.js';

export class CLIError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly hint?: string,
    public readonly suggestedFix?: SuggestedFix,
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class AuthError extends CLIError {
  constructor(message: string, hint?: string) {
    super(ErrorCodes.AUTH_REQUIRED, message, undefined, hint ?? 'refly login');
  }
}

export class ValidationError extends CLIError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCodes.VALIDATION_ERROR, message, details, 'Fix validation errors and retry');
  }
}

export class NetworkError extends CLIError {
  constructor(message: string) {
    super(ErrorCodes.NETWORK_ERROR, message, undefined, 'Check your internet connection');
  }
}

export class NotFoundError extends CLIError {
  constructor(resource: string, id: string) {
    super(
      ErrorCodes.NOT_FOUND,
      `${resource} not found: ${id}`,
      { resource, id },
      `Verify the ${resource.toLowerCase()} ID`,
    );
  }
}
