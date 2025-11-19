/**
 * Guard operations, values, and conditions from errors
 * Provides a fluent API for error handling with custom exceptions
 */

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
}

interface GuardWrapper<T> {
  orThrow(errorFactory?: (error: unknown) => Error): T extends Promise<infer U> ? Promise<U> : T;
  orElse(fallback: (error: unknown) => T): T extends Promise<infer U> ? Promise<U> : T;
}

interface NotEmptyWrapper<T> {
  orThrow(errorFactory: (value: T | null | undefined) => Error): NonNullable<T>;
}

interface EnsureWrapper {
  orThrow(errorFactory: () => Error): void;
}

/**
 * Sleep for the specified number of milliseconds
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function guard<T>(fn: () => T): GuardWrapper<T> {
  return {
    orThrow(errorFactory?: (error: unknown) => Error) {
      try {
        const result = fn();

        if (result instanceof Promise) {
          return result.catch((error) => {
            throw errorFactory ? errorFactory(error) : error;
          }) as any;
        }

        return result as any;
      } catch (error) {
        throw errorFactory ? errorFactory(error) : error;
      }
    },
    orElse(fallback: (error: unknown) => T) {
      try {
        const result = fn();

        if (result instanceof Promise) {
          return result.catch((error) => fallback(error)) as any;
        }

        return result as any;
      } catch (error) {
        return fallback(error) as any;
      }
    },
  };
}

guard.notEmpty = <T>(value: T): NotEmptyWrapper<T> => {
  return {
    orThrow(errorFactory: (value: T | null | undefined) => Error): NonNullable<T> {
      if (value === null || value === undefined || value === '') {
        throw errorFactory(value);
      }
      return value as NonNullable<T>;
    },
  };
};

guard.ensure = (condition: boolean): EnsureWrapper => {
  return {
    orThrow(errorFactory: () => Error): void {
      if (!condition) {
        throw errorFactory();
      }
    },
  };
};

/**
 * Execute function as "best effort" - failures handled by optional callback
 * Used when failure should not affect main flow
 */
guard.bestEffort = async (
  fn: () => void | Promise<void>,
  onError?: (error: unknown) => void | Promise<void>,
): Promise<void> => {
  try {
    await fn();
  } catch (error) {
    if (onError) {
      await onError(error);
    }
  }
};

/**
 * Execute function with guaranteed cleanup (like Go's defer or try-finally)
 * Cleanup always executes regardless of success or failure
 */
guard.defer = async <T>(
  fn: () => T | Promise<T>,
  cleanup: () => void | Promise<void>,
): Promise<T> => {
  try {
    return await fn();
  } finally {
    await cleanup();
  }
};

/**
 * Execute function with retry logic
 * Returns a GuardWrapper that can be chained with orThrow/orElse
 */
guard.retry = <T>(fn: () => T | Promise<T>, config: RetryConfig): GuardWrapper<Promise<T>> => {
  return guard(async () => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't sleep after the last attempt
        if (attempt < config.maxAttempts) {
          await sleep(config.delayMs);
        }
      }
    }

    throw lastError;
  });
};
