import { BaseError } from '@refly/errors';

/**
 * Sandbox Exception - Canvas ID Required
 * Thrown when canvasId is missing from the execution request
 */
export class SandboxCanvasIdRequiredError extends BaseError {
  code = 'SANDBOX_CANVAS_ID_REQUIRED';
  messageDict = {
    en: 'Canvas ID is required for sandbox execution',
    'zh-CN': '沙箱执行需要提供 Canvas ID',
  };

  static create(): SandboxCanvasIdRequiredError {
    return new SandboxCanvasIdRequiredError();
  }
}

/**
 * Sandbox Exception - Execution Timeout
 * Thrown when sandbox execution exceeds the timeout limit
 */
export class SandboxExecutionTimeoutError extends BaseError {
  code = 'SANDBOX_EXECUTION_TIMEOUT';
  messageDict = {
    en: 'Sandbox execution timeout',
    'zh-CN': '沙箱执行超时',
  };

  constructor(
    public readonly requestId: string,
    public readonly timeoutMs: number,
  ) {
    super(`Sandbox execution timeout after ${timeoutMs}ms (requestId: ${requestId})`);
  }

  static create(requestId: string, timeoutMs: number): SandboxExecutionTimeoutError {
    return new SandboxExecutionTimeoutError(requestId, timeoutMs);
  }
}
