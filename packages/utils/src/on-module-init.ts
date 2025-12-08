const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 3;

export interface ModuleInitLogger {
  log?: (message: string) => void;
  warn?: (message: string, ...optionalParams: unknown[]) => void;
  error?: (message: string, ...optionalParams: unknown[]) => void;
}

export interface ModuleInitOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  label?: string;
  logger?: ModuleInitLogger;
}

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
    label,
    logger,
  } = options ?? {};

  const safeTimeout = Math.max(0, timeoutMs);
  const attempts = Math.max(1, maxAttempts);
  const actionLabel = label ?? 'onModuleInit';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await timeoutPromise(Promise.resolve().then(callback), safeTimeout, actionLabel);
      return;
    } catch (error) {
      const isLastAttempt = attempt >= attempts;
      if (isLastAttempt) {
        logger?.error?.(`${actionLabel} failed after ${attempt} attempts`, error);
        throw error;
      }
      logger?.warn?.(`${actionLabel} attempt ${attempt} failed, retrying`, error);
    }
  }
}
