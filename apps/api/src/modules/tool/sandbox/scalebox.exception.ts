export class SandboxException extends Error {
  constructor(
    messageOrError: unknown,
    public readonly code: string,
    public readonly context?: Record<string, any>,
  ) {
    const message =
      messageOrError instanceof Error
        ? messageOrError.message
        : typeof messageOrError === 'string'
          ? messageOrError
          : String(messageOrError);

    super(message);
    this.name = this.constructor.name;

    if (messageOrError instanceof Error && messageOrError.stack) {
      this.stack = messageOrError.stack;
    } else {
      Error.captureStackTrace?.(this, this.constructor);
    }
  }

  getCategory(): string {
    return this.name
      .replace(/Exception$/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }

  getFormattedMessage(): string {
    return `[${this.getCategory()}]: ${this.message}`;
  }

  static from(error: unknown): SandboxException {
    return error instanceof SandboxException ? error : new SandboxException(error, 'UNKNOWN_ERROR');
  }
}

export class SandboxRequestParamsException extends SandboxException {
  constructor(operation: string, messageOrError: unknown) {
    super(messageOrError, 'SANDBOX_REQUEST_PARAMS_ERROR', { operation });
  }
}

export class QueueOverloadedException extends SandboxException {
  constructor(
    public readonly currentSize: number,
    public readonly maxSize: number,
  ) {
    super(`System is busy (${currentSize} tasks in queue, max: ${maxSize})`, 'QUEUE_OVERLOADED', {
      currentSize,
      maxSize,
    });
  }
}

export class SandboxCreationException extends SandboxException {
  constructor(messageOrError: unknown) {
    super(messageOrError, 'SANDBOX_CREATION_FAILED');
  }
}

export class SandboxConnectionException extends SandboxException {
  constructor(messageOrError: unknown) {
    super(messageOrError, 'SANDBOX_CONNECTION_FAILED');
  }
}

export class SandboxExecutionFailedException extends SandboxException {
  constructor(
    message: unknown,
    public readonly exitCode?: number,
  ) {
    super(message, 'SANDBOX_EXECUTION_FAILED', { exitCode });
  }
}

export class SandboxFileListException extends SandboxException {
  constructor(messageOrError: unknown) {
    super(messageOrError, 'SANDBOX_FILE_LIST_FAILED');
  }
}

export class SandboxLockTimeoutException extends SandboxException {
  constructor(
    public readonly lockKey: string,
    public readonly timeoutMs: number,
  ) {
    super(`Failed to acquire lock for ${lockKey} after ${timeoutMs}ms`, 'SANDBOX_LOCK_TIMEOUT', {
      lockKey,
      timeoutMs,
    });
  }
}

export class SandboxLifetimeExceededException extends SandboxException {
  constructor(
    public readonly sandboxId: string,
    public readonly lifetimeMs: number,
    public readonly maxLifetimeMs: number,
  ) {
    const lifetimeHours = (lifetimeMs / (60 * 60 * 1000)).toFixed(2);
    const maxLifetimeHours = (maxLifetimeMs / (60 * 60 * 1000)).toFixed(2);
    super(
      `Sandbox ${sandboxId} exceeded max lifetime (${lifetimeHours}h / ${maxLifetimeHours}h)`,
      'SANDBOX_LIFETIME_EXCEEDED',
      { sandboxId, lifetimeMs, maxLifetimeMs, lifetimeHours, maxLifetimeHours },
    );
  }
}
