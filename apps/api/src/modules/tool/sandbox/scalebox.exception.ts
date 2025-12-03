import type { ExecutionResult } from '@scalebox/sdk';

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

export type LifecycleOperation = 'create' | 'reconnect' | 'pause';

export class SandboxLifecycleException extends SandboxException {
  constructor(
    public readonly operation: LifecycleOperation,
    messageOrError: unknown,
    public readonly sandboxId?: string,
  ) {
    super(messageOrError, `SANDBOX_${operation.toUpperCase()}_FAILED`, { operation, sandboxId });
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
    // User-friendly message for model consumption; internal details in context for logging
    super('Sandbox is busy, please retry', 'SANDBOX_LOCK_TIMEOUT', {
      lockKey,
      timeoutMs,
    });
  }
}

export class SandboxExecutionBadResultException extends SandboxException {
  constructor(public readonly result: ExecutionResult) {
    super(
      result.error?.message || result.stderr || 'Execution returned non-zero exit code',
      'SANDBOX_EXECUTION_BAD_RESULT',
      { result },
    );
  }
}

export class SandboxRunCodeException extends SandboxException {
  constructor(messageOrError: unknown) {
    super(messageOrError, 'SANDBOX_RUN_CODE_FAILED');
  }
}

export class SandboxAcquireException extends SandboxException {
  constructor(
    messageOrError: unknown,
    public readonly sandboxId?: string,
  ) {
    super(messageOrError, 'SANDBOX_ACQUIRE_FAILED', { sandboxId });
  }
}

export class SandboxLanguageNotSupportedException extends SandboxException {
  constructor(language: string) {
    super(
      `Language '${language}' is not supported. Supported: python, javascript, bash, shell`,
      'SANDBOX_LANGUAGE_NOT_SUPPORTED',
      { language },
    );
  }
}

export class SandboxMountException extends SandboxException {
  constructor(
    messageOrError: unknown,
    public readonly sandboxId?: string,
  ) {
    super(messageOrError, 'SANDBOX_MOUNT_FAILED', { sandboxId });
  }
}
