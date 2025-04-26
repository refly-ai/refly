import {
  auth,
  AuthResult,
  OAuthClientProvider,
  UnauthorizedError,
} from '@modelcontextprotocol/sdk/client/auth.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage, JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * StreamableHTTP错误
 */
export class StreamableHTTPError extends Error {
  /**
   * 创建StreamableHTTP错误
   * @param code 错误代码
   * @param message 错误消息
   * @param event 错误事件
   */
  constructor(
    public readonly code: number | undefined,
    message: string | undefined,
    public readonly event: ErrorEvent,
  ) {
    super(`Streamable HTTP error: ${message}`);
  }
}

/**
 * StreamableHTTP客户端传输选项
 */
export type StreamableHTTPClientTransportOptions = {
  /**
   * OAuth客户端提供者，用于认证
   */
  authProvider?: OAuthClientProvider;

  /**
   * 自定义HTTP请求初始化
   */
  requestInit?: RequestInit;
};

/**
 * StreamableHTTP客户端传输
 * 实现MCP Streamable HTTP传输规范
 */
export class StreamableHTTPClientTransport implements Transport {
  private _activeStreams: Map<string, ReadableStreamDefaultReader<Uint8Array>> = new Map();
  private _abortController?: AbortController;
  private _url: URL;
  private _requestInit?: RequestInit;
  private _authProvider?: OAuthClientProvider;
  private _sessionId?: string;
  private _lastEventId?: string;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  /**
   * 创建StreamableHTTP客户端传输
   * @param url 服务器URL
   * @param opts 选项
   */
  constructor(url: URL, opts?: StreamableHTTPClientTransportOptions) {
    this._url = url;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
  }

  /**
   * 尝试认证后启动
   */
  private async _authThenStart(): Promise<void> {
    if (!this._authProvider) {
      throw new UnauthorizedError('No auth provider');
    }

    let result: AuthResult;
    try {
      result = await auth(this._authProvider, { serverUrl: this._url });
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }

    if (result !== 'AUTHORIZED') {
      throw new UnauthorizedError();
    }

    return await this._startOrAuth();
  }

  /**
   * 获取通用头信息
   */
  private async _commonHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {};
    if (this._authProvider) {
      const tokens = await this._authProvider.tokens();
      if (tokens) {
        headers['Authorization'] = `Bearer ${tokens.access_token}`;
      }
    }

    if (this._sessionId) {
      headers['mcp-session-id'] = this._sessionId;
    }

    return headers;
  }

  /**
   * 启动或认证
   */
  private async _startOrAuth(): Promise<void> {
    try {
      // 尝试打开初始SSE流用于监听服务器消息
      const commonHeaders = await this._commonHeaders();
      const headers = new Headers(commonHeaders);
      headers.set('Accept', 'text/event-stream');

      // 包含Last-Event-ID头用于可恢复流
      if (this._lastEventId) {
        headers.set('last-event-id', this._lastEventId);
      }

      const response = await fetch(this._url, {
        method: 'GET',
        headers,
        signal: this._abortController?.signal,
      });

      if (response.status === 405) {
        // 服务器不支持GET用于SSE，这是规范允许的
        // 我们将依靠POST请求的SSE响应进行通信
        return;
      }

      if (!response.ok) {
        if (response.status === 401 && this._authProvider) {
          // 需要认证
          return await this._authThenStart();
        }

        const error = new Error(
          `Failed to open SSE stream: ${response.status} ${response.statusText}`,
        );
        this.onerror?.(error);
        throw error;
      }

      // 成功连接，将SSE流处理为独立监听器
      const streamId = `initial-${Date.now()}`;
      this._handleSseStream(response.body, streamId);
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }
  }

  /**
   * 启动传输
   */
  async start() {
    if (this._activeStreams.size > 0) {
      throw new Error(
        'StreamableHTTPClientTransport already started! If using Client class, note that connect() calls start() automatically.',
      );
    }

    this._abortController = new AbortController();
    return await this._startOrAuth();
  }

  /**
   * 完成认证
   * @param authorizationCode 授权码
   */
  async finishAuth(authorizationCode: string): Promise<void> {
    if (!this._authProvider) {
      throw new UnauthorizedError('No auth provider');
    }

    const result = await auth(this._authProvider, { serverUrl: this._url, authorizationCode });
    if (result !== 'AUTHORIZED') {
      throw new UnauthorizedError('Failed to authorize');
    }
  }

  /**
   * 关闭传输
   */
  async close(): Promise<void> {
    // 关闭所有活跃流
    for (const reader of this._activeStreams.values()) {
      try {
        reader.cancel();
      } catch (error) {
        this.onerror?.(error as Error);
      }
    }
    this._activeStreams.clear();

    // 中止任何挂起的请求
    this._abortController?.abort();

    // 如果有会话ID，发送DELETE请求显式终止会话
    if (this._sessionId) {
      try {
        const commonHeaders = await this._commonHeaders();
        const response = await fetch(this._url, {
          method: 'DELETE',
          headers: commonHeaders,
          signal: this._abortController?.signal,
        });

        if (!response.ok && response.status !== 405) {
          // 服务器可能响应405表示不支持显式会话终止
          const text = await response.text().catch(() => null);
          throw new Error(`Error terminating session (HTTP ${response.status}): ${text}`);
        }
      } catch (error) {
        this.onerror?.(error as Error);
      }
    }

    this.onclose?.();
  }

  /**
   * 发送消息
   * @param message JSON-RPC消息
   */
  async send(message: JSONRPCMessage | JSONRPCMessage[]): Promise<void> {
    if (!this._abortController) {
      throw new Error('Transport not started');
    }

    try {
      const commonHeaders = await this._commonHeaders();
      const headers = new Headers(commonHeaders);
      headers.set('Content-Type', 'application/json');

      // 请求选项
      const requestInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(Array.isArray(message) ? message : [message]),
        signal: this._abortController.signal,
        ...this._requestInit,
      };

      // 发送请求
      const response = await fetch(this._url, requestInit);

      // 处理会话ID
      const sessionId = response.headers.get('mcp-session-id');
      if (sessionId) {
        this._sessionId = sessionId;
      }

      // 处理响应
      if (!response.ok) {
        if (response.status === 401 && this._authProvider) {
          throw new UnauthorizedError();
        }

        const text = await response.text().catch(() => null);
        throw new Error(`HTTP error (${response.status}): ${text}`);
      }

      // 检查内容类型
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        // 这是一个SSE响应，处理流
        const streamId = `response-${Date.now()}`;
        this._handleSseStream(response.body, streamId);
      } else if (contentType?.includes('application/json')) {
        // 这是一个JSON响应，解析并分发消息
        const json = await response.json();
        if (Array.isArray(json)) {
          for (const item of json) {
            try {
              const parsedMessage = JSONRPCMessageSchema.parse(item);
              this.onmessage?.(parsedMessage);
            } catch (error) {
              this.onerror?.(error as Error);
            }
          }
        } else {
          try {
            const parsedMessage = JSONRPCMessageSchema.parse(json);
            this.onmessage?.(parsedMessage);
          } catch (error) {
            this.onerror?.(error as Error);
          }
        }
      }
    } catch (error) {
      if (error instanceof UnauthorizedError && this._authProvider) {
        try {
          await this._authThenStart();
          // 认证后重试
          return await this.send(message);
        } catch (authError) {
          this.onerror?.(authError as Error);
          throw authError;
        }
      }

      this.onerror?.(error as Error);
      throw error;
    }
  }

  /**
   * 处理SSE流
   */
  private _handleSseStream(stream: ReadableStream<Uint8Array> | null, streamId: string): void {
    if (!stream) {
      this.onerror?.(new Error('Stream is null'));
      return;
    }

    const reader = stream.getReader();
    this._activeStreams.set(streamId, reader);

    const processStream = async () => {
      try {
        let buffer = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // 处理缓冲区中的所有完整事件
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
            const eventText = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 2);

            // 解析事件
            const event = this._parseEvent(eventText);
            if (event) {
              if (event.id) {
                this._lastEventId = event.id;
              }

              if (event.event === 'message' && event.data) {
                try {
                  const data = JSON.parse(event.data);
                  if (Array.isArray(data)) {
                    for (const item of data) {
                      const parsedMessage = JSONRPCMessageSchema.parse(item);
                      this.onmessage?.(parsedMessage);
                    }
                  } else {
                    const parsedMessage = JSONRPCMessageSchema.parse(data);
                    this.onmessage?.(parsedMessage);
                  }
                } catch (error) {
                  this.onerror?.(error as Error);
                }
              }
            }
          }
        }

        // 处理最后的缓冲区内容
        if (buffer.trim()) {
          const event = this._parseEvent(buffer);
          if (event && event.event === 'message' && event.data) {
            try {
              const data = JSON.parse(event.data);
              if (Array.isArray(data)) {
                for (const item of data) {
                  const parsedMessage = JSONRPCMessageSchema.parse(item);
                  this.onmessage?.(parsedMessage);
                }
              } else {
                const parsedMessage = JSONRPCMessageSchema.parse(data);
                this.onmessage?.(parsedMessage);
              }
            } catch (error) {
              this.onerror?.(error as Error);
            }
          }
        }

        // 流完成
        this._activeStreams.delete(streamId);
      } catch (error) {
        this.onerror?.(error as Error);
        this._activeStreams.delete(streamId);
      }
    };

    // 启动流处理
    processStream();
  }

  /**
   * 解析SSE事件
   */
  private _parseEvent(eventText: string): { event?: string; data?: string; id?: string } | null {
    if (!eventText.trim()) {
      return null;
    }

    const result: { event?: string; data?: string; id?: string } = {};
    const lines = eventText.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const field = line.substring(0, colonIndex).trim();
      // 跳过注释
      if (field === '') continue;

      let value = line.substring(colonIndex + 1).trim();
      // 如果冒号后有空格，则去除开头的空格
      if (line.charAt(colonIndex + 1) === ' ') {
        value = line.substring(colonIndex + 2).trim();
      }

      if (field === 'event') {
        result.event = value;
      } else if (field === 'data') {
        result.data = result.data ? result.data + '\n' + value : value;
      } else if (field === 'id' && !value.includes('\0')) {
        result.id = value;
      }
    }

    return result;
  }
}
