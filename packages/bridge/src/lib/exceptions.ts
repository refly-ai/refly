export class BridgeError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'BRIDGE_ERROR',
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class KubectlProxyError extends BridgeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'KUBECTL_PROXY_ERROR', context);
  }
}

export class RemoteMethodError extends BridgeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'REMOTE_METHOD_ERROR', context);
  }
}
