import {
  ModelProviderRateLimitExceeded,
  ModelProviderTimeout,
  ActionAborted,
  ModelUsageQuotaExceeded,
  UnknownError,
} from './errors';

export const guessModelProviderError = (error: string | Error) => {
  const e = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Check for credit/quota related errors first
  // These patterns match the error messages thrown by the backend when credits are insufficient
  if (
    e.includes('credit not available') ||
    e.includes('insufficient credits') ||
    e.includes('model usage quota exceeded') ||
    // Match backend error message format: "Available: X, Required minimum: Y"
    (e.includes('available:') && e.includes('required minimum:'))
  ) {
    return new ModelUsageQuotaExceeded();
  }

  // Check for abort-related errors
  if (
    e.includes('abort') ||
    e.includes('cancelled') ||
    e.includes('canceled') ||
    e.includes('stopped')
  ) {
    return new ActionAborted();
  }

  if (e.includes('limit exceed')) {
    return new ModelProviderRateLimitExceeded();
  }
  if (e.includes('timeout')) {
    return new ModelProviderTimeout();
  }
  return new UnknownError();
};
