import { ModelProviderError, ModelProviderRateLimitExceeded, ModelProviderTimeout } from './errors';

export const guessModelProviderError = (error: string | Error) => {
  const e = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (e.includes('limit exceed')) {
    return new ModelProviderRateLimitExceeded();
  }
  if (e.includes('timeout')) {
    return new ModelProviderTimeout();
  }
  return new ModelProviderError();
};
