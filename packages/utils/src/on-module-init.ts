const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const MIN_TIMEOUT_MS = 1000;

export interface ModuleInitLogger {
  log?: (message: string) => void;
  warn?: (message: string, ...optionalParams: unknown[]) => void;
  error?: (message: string, ...optionalParams: unknown[]) => void;
}

export interface ModuleInitOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  label?: string;
  logger?: ModuleInitLogger;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const timeoutPromise = <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });

export async function runModuleInitWithTimeoutAndRetry(
  callback: () => void | Promise<void>,
  options?: ModuleInitOptions,
): Promise<void> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    label,
    logger,
  } = options ?? {};

  const safeTimeout = Math.max(MIN_TIMEOUT_MS, timeoutMs);
  const attempts = Math.max(1, maxAttempts);
  const actionLabel = label ?? 'onModuleInit';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await timeoutPromise(Promise.resolve().then(callback), safeTimeout, actionLabel);
      if (attempt > 1) {
        logger?.log?.(`${actionLabel} succeeded on attempt ${attempt}`);
      }
      return;
    } catch (error) {
      const isLastAttempt = attempt >= attempts;
      if (isLastAttempt) {
        logger?.error?.(`${actionLabel} failed after ${attempt} attempts`, error);
        throw error;
      }
      const delayMs = retryDelayMs * attempt;
      logger?.warn?.(`${actionLabel} attempt ${attempt} failed, retrying in ${delayMs}ms`, error);
      await sleep(delayMs);
    }
  }
}
