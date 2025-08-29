import { Logger } from '@nestjs/common';
import { ERROR_MESSAGES } from './constants';

/**
 * Error information interface
 */
export interface ErrorInfo {
  type:
    | 'VALIDATION'
    | 'LLM_SERVICE'
    | 'DATABASE'
    | 'CANVAS_SERVICE'
    | 'PROVIDER_SERVICE'
    | 'NETWORK'
    | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  originalError?: Error;
  context?: Record<string, unknown>;
  canRetry: boolean;
  canFallback: boolean;
}

/**
 * Error type enumeration
 */
export const ErrorType = {
  VALIDATION: 'VALIDATION',
  LLM_SERVICE: 'LLM_SERVICE',
  DATABASE: 'DATABASE',
  CANVAS_SERVICE: 'CANVAS_SERVICE',
  PROVIDER_SERVICE: 'PROVIDER_SERVICE',
  NETWORK: 'NETWORK',
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * Error severity enumeration
 */
export const ErrorSeverity = {
  LOW: 'LOW', // Can be handled with fallback
  MEDIUM: 'MEDIUM', // Needs retry
  HIGH: 'HIGH', // Needs immediate handling
  CRITICAL: 'CRITICAL', // Service unavailable
} as const;

const logger = new Logger('VariableExtractionErrorHandler');

/**
 * Analyze error and return error information
 */
export function analyzeError(error: Error, context?: Record<string, unknown>): ErrorInfo {
  const errorMessage = error.message.toLowerCase();

  // Analyze error type and severity
  if (errorMessage.includes('llm') || errorMessage.includes('provider')) {
    return {
      type: 'LLM_SERVICE',
      severity: 'MEDIUM',
      message: error.message,
      originalError: error,
      context,
      canRetry: true,
      canFallback: true,
    };
  }

  if (errorMessage.includes('database') || errorMessage.includes('prisma')) {
    return {
      type: 'DATABASE',
      severity: 'HIGH',
      message: error.message,
      originalError: error,
      context,
      canRetry: true,
      canFallback: false,
    };
  }

  if (errorMessage.includes('canvas') || errorMessage.includes('workflow')) {
    return {
      type: 'CANVAS_SERVICE',
      severity: 'MEDIUM',
      message: error.message,
      originalError: error,
      context,
      canRetry: true,
      canFallback: true,
    };
  }

  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return {
      type: 'NETWORK',
      severity: 'MEDIUM',
      message: error.message,
      originalError: error,
      context,
      canRetry: true,
      canFallback: true,
    };
  }

  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return {
      type: 'VALIDATION',
      severity: 'LOW',
      message: error.message,
      originalError: error,
      context,
      canRetry: false,
      canFallback: true,
    };
  }

  // Default unknown error
  return {
    type: 'UNKNOWN',
    severity: 'HIGH',
    message: error.message,
    originalError: error,
    context,
    canRetry: false,
    canFallback: false,
  };
}

/**
 * Handle error and decide whether to throw
 */
export function handleError(
  error: Error,
  context: Record<string, unknown>,
  shouldThrow = false,
): void {
  const errorInfo = analyzeError(error, context);

  // Log error
  logError(errorInfo);

  // Decide whether to throw error based on configuration
  if (shouldThrow || errorInfo.severity === 'CRITICAL') {
    throw error;
  }
}

/**
 * Log error
 */
function logError(errorInfo: ErrorInfo): void {
  const { type, severity, message, context } = errorInfo;

  const logMessage = `[${type}] [${severity}] ${message}`;
  const logContext = context ? ` Context: ${JSON.stringify(context)}` : '';

  switch (severity) {
    case 'CRITICAL':
      logger.error(logMessage + logContext);
      break;
    case 'HIGH':
      logger.error(logMessage + logContext);
      break;
    case 'MEDIUM':
      logger.warn(logMessage + logContext);
      break;
    case 'LOW':
      logger.log(logMessage + logContext);
      break;
  }
}

/**
 * Create standardized error message
 */
export function createErrorMessage(
  errorType: keyof typeof ERROR_MESSAGES,
  context?: Record<string, unknown>,
): string {
  const baseMessage = ERROR_MESSAGES[errorType];

  if (context) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    return `${baseMessage} (${contextStr})`;
  }

  return baseMessage;
}

/**
 * Determine if error can be retried
 */
export function canRetry(error: Error): boolean {
  const errorInfo = analyzeError(error);
  return errorInfo.canRetry;
}

/**
 * Determine if error can be handled with fallback
 */
export function canFallback(error: Error): boolean {
  const errorInfo = analyzeError(error);
  return errorInfo.canFallback;
}
