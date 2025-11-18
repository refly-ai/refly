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

export class ServiceConfigurationException extends SandboxException {
  constructor(messageOrError: unknown, missingConfig?: string) {
    super(messageOrError, 'SERVICE_CONFIGURATION_ERROR', { missingConfig });
  }
}

export class MissingApiKeyException extends SandboxException {
  constructor() {
    super('Scalebox API key is not configured. Please contact administrator.', 'MISSING_API_KEY', {
      missingConfig: 'apiKey',
    });
  }
}

export class MissingCanvasIdException extends SandboxException {
  constructor() {
    super('Canvas ID is required for sandbox execution.', 'MISSING_CANVAS_ID', {
      missingParam: 'canvasId',
    });
  }
}

export class QueueUnavailableException extends SandboxException {
  constructor(messageOrError: unknown = 'Sandbox execution queue is not available') {
    super(messageOrError, 'QUEUE_UNAVAILABLE');
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

export class CodeExecutionException extends SandboxException {
  constructor(
    messageOrError: unknown,
    public readonly exitCode?: number,
  ) {
    super(messageOrError, 'CODE_EXECUTION_FAILED', { exitCode });
  }
}

export class SandboxCreationException extends SandboxException {
  constructor(messageOrError: unknown) {
    super(messageOrError, 'SANDBOX_CREATION_FAILED');
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

export class SandboxReadyTimeoutException extends SandboxException {
  constructor(sandboxId: string, retries: number) {
    super(
      `Sandbox ${sandboxId} failed to become ready after ${retries} retries`,
      'SANDBOX_READY_TIMEOUT',
      { sandboxId, retries },
    );
  }
}

export class SandboxMountException extends SandboxException {
  constructor(messageOrError: unknown, canvasId: string) {
    super(messageOrError, 'SANDBOX_MOUNT_FAILED', { canvasId });
  }
}
