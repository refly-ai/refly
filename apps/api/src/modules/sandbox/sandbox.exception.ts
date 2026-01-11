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

/**
 * Sandbox Exception - Response Parse Error
 * Thrown when worker response cannot be parsed
 */
export class SandboxResponseParseError extends BaseError {
  code = 'SANDBOX_RESPONSE_PARSE_ERROR';
  messageDict = {
    en: 'Failed to parse sandbox worker response',
    'zh-CN': '解析沙箱工作节点响应失败',
  };

  constructor(
    public readonly requestId: string,
    public readonly originalError: Error,
  ) {
    super(`Failed to parse worker response (requestId: ${requestId}): ${originalError.message}`);
  }

  static create(requestId: string, error: unknown): SandboxResponseParseError {
    return new SandboxResponseParseError(requestId, error as Error);
  }
}
