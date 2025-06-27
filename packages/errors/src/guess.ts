import {
  ModelProviderError,
  ModelProviderRateLimitExceeded,
  ModelProviderTimeout,
  ActionAborted,
} from './errors';

export const guessModelProviderError = (error: string | Error) => {
  const e = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Check for abort-related errors first
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
  return new ModelProviderError();
};
