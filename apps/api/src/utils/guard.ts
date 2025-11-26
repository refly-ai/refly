/**
 * Guard operations, values, and conditions from errors
 * Provides a fluent API for error handling with custom exceptions
 */

export interface RetryConfig {
  maxAttempts?: number;
  timeout?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryIf?: (error: unknown) => boolean; // Only retry if returns true; retries all errors if not provided
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
 * Safely invoke error handler, suppressing any errors from the handler itself
 */
async function safeInvoke(
  handler: ((error: unknown) => void | Promise<void>) | undefined,
  error: unknown,
): Promise<void> {
  if (!handler) return;
  try {
    await handler(error);
  } catch {
    // Suppress handler errors
  }
}

/**
 * Execute function with resource acquisition and guaranteed cleanup (RAII pattern)
 * Resource and cleanup function are returned together from the acquirer
 * Cleanup always executes regardless of success or failure
 *
 * @param acquirer - Function that returns [resource, cleanup]
 * @param task - Task to execute with the resource
 * @param onCleanupError - Optional error handler for cleanup failures (handler errors are also suppressed)
 *
 * @example
 * await guard.defer(
 *   async () => {
 *     const lock = await acquireLock();
 *     return [lock, () => lock.release()] as const;
 *   },
 *   (lock) => doWork(lock),
 *   (error) => logger.warn(error, 'Cleanup failed')
 * );
 */
guard.defer = async <R, T>(
  acquirer: () =>
    | readonly [R, () => void | Promise<void>]
    | Promise<readonly [R, () => void | Promise<void>]>,
  task: (resource: R) => T | Promise<T>,
  onCleanupError?: (error: unknown) => void | Promise<void>,
): Promise<T> => {
  const [resource, cleanup] = await acquirer();
  try {
    return await task(resource);
  } finally {
    try {
      await cleanup();
    } catch (error) {
      await safeInvoke(onCleanupError, error);
    }
  }
};

/**
 * Resource management with bracket pattern (acquire -> use -> release)
 * Multiple resources are acquired in order and released in reverse order (LIFO)
 * Each release is guaranteed to execute even if previous releases fail
 *
 * @param resources - Array of resource configurations
 * @param use - Function to use all acquired resources
 *
 * Example:
 * await guard.bracket(
 *   [
 *     { acquire: () => acquireWrapper(), release: (w) => w.release() },
 *     { acquire: (w) => w.mount(), release: (w) => w.unmount() }
 *   ],
 *   async ([wrapper]) => executeCode(wrapper)
 * );
 */
guard.bracket = async <R extends any[], T>(
  resources: Array<{
    acquire: (...prev: any[]) => any | Promise<any>;
    release: (resource: any) => void | Promise<void>;
    onReleaseError?: (error: unknown) => void | Promise<void>;
  }>,
  use: (acquired: R) => T | Promise<T>,
): Promise<T> => {
  const acquired: any[] = [];
  const releaseStack: Array<() => Promise<void>> = [];

  try {
    // Acquire resources in order
    for (const { acquire, release, onReleaseError } of resources) {
      const resource = await acquire(...acquired);
      acquired.push(resource);

      // Push release to stack (will be called in reverse order)
      releaseStack.push(async () => {
        try {
          await release(resource);
        } catch (error) {
          await safeInvoke(onReleaseError, error);
        }
      });
    }

    // Use resources
    return await use(acquired as R);
  } finally {
    // Release in reverse order (LIFO)
    while (releaseStack.length > 0) {
      const releaseFunc = releaseStack.pop()!;
      await releaseFunc();
    }
  }
};

/**
 * Execute function with retry logic
 * Supports both attempt-based and timeout-based retry strategies with exponential backoff
 * Returns a GuardWrapper that can be chained with orThrow/orElse
 */
guard.retry = <T>(fn: () => T | Promise<T>, config: RetryConfig): GuardWrapper<Promise<T>> => {
  return guard(async () => {
    const {
      maxAttempts,
      timeout,
      initialDelay = 0,
      maxDelay = 1000,
      backoffFactor = 1,
      retryIf,
    } = config;

    let lastError: unknown;
    const startTime = Date.now();
    let delay = initialDelay;
    let attempt = 0;

    while (true) {
      attempt++;

      try {
        return await fn();
      } catch (error) {
        lastError = error;

        const shouldRetry = retryIf ? retryIf(error) : true;
        const hasMoreAttempts = maxAttempts ? attempt < maxAttempts : true;
        const hasMoreTime = timeout ? Date.now() - startTime < timeout : true;

        if (!shouldRetry || !hasMoreAttempts || !hasMoreTime) {
          throw lastError;
        }

        await sleep(delay);
        delay = Math.min(delay * backoffFactor, maxDelay);
      }
    }
  });
};
