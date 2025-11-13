import { Sandbox, type WriteInfo, CodeInterpreter } from '@scalebox/sdk';
import { ExecutionResult, CodeContext } from './types';

/**
 * CodeBox output types
 */
export type CodeBoxOutputType = 'text' | 'image/png' | 'error';

/**
 * CodeBox output interface
 */
export interface CodeBoxOutput {
  type: CodeBoxOutputType;
  content: string;
}

/**
 * CodeBox status type
 */
export type CodeBoxStatus = 'running' | 'stopped' | 'paused' | 'error';

/**
 * CodeBox configuration options
 */
export interface CodeBoxOptions {
  /**
   * Python packages to install on startup
   */
  requirements?: string[];

  /**
   * Sandbox timeout in milliseconds
   * @default 1800000 (30 minutes)
   */
  timeoutMs?: number;

  /**
   * Environment variables
   */
  envs?: Record<string, string>;

  /**
   * Metadata
   */
  metadata?: Record<string, string>;

  /**
   * API key for Scalebox
   */
  apiKey?: string;
}

/**
 * CodeBox - Simplified adapter for Scalebox SDK with context persistence
 *
 * This adapter provides a clean interface compatible with the codeboxapi
 * while using Scalebox SDK under the hood. It supports code execution context
 * management for maintaining state across multiple executions.
 */
export class CodeBox {
  private sandbox?: Sandbox;
  private codeInterpreter?: CodeInterpreter;
  private _sessionId?: string;
  private requirements: string[];
  private options: CodeBoxOptions;
  private _defaultContext?: CodeContext;

  constructor(options: CodeBoxOptions = {}) {
    this.requirements = options.requirements || [];
    this.options = options;
  }

  /**
   * Get the session ID
   */
  get sessionId(): string | undefined {
    return this._sessionId;
  }

  /**
   * Get the default context
   */
  get defaultContext(): CodeContext | undefined {
    return this._defaultContext;
  }

  /**
   * Create a CodeBox from an existing session ID
   */
  static async fromId(sessionId: string, options: CodeBoxOptions = {}): Promise<CodeBox> {
    const codebox = new CodeBox(options);
    codebox._sessionId = sessionId;

    // Connect to existing sandbox
    codebox.sandbox = await Sandbox.connect(sessionId, {
      apiKey: options.apiKey || process.env.SCALEBOX_API_KEY || '',
    });

    // Create CodeInterpreter using the same Sandbox instance
    try {
      const sandboxInternal = codebox.sandbox as any;
      const connectionConfig = sandboxInternal.connectionConfig;
      const api = sandboxInternal.api;

      if (connectionConfig && api) {
        codebox.codeInterpreter = new CodeInterpreter(codebox.sandbox, connectionConfig, api);
        console.log('[CodeBox] CodeInterpreter created for existing session');
      }
    } catch (error) {
      console.warn('[CodeBox] Failed to create CodeInterpreter for existing session:', error);
    }

    return codebox;
  }

  /**
   * Start the sandbox
   */
  async start(): Promise<CodeBoxStatus> {
    try {
      // Create new sandbox
      this.sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: this.options.timeoutMs || 1800000,
        metadata: this.options.metadata || {},
        apiKey: this.options.apiKey || process.env.SCALEBOX_API_KEY || '',
      });

      const info = await this.sandbox.getInfo();
      this._sessionId = info.sandboxId;

      // Create CodeInterpreter using the SAME Sandbox instance
      // This ensures files uploaded via sandbox.files.write() are accessible during code execution
      try {
        // Access Sandbox's internal connectionConfig and api to create CodeInterpreter
        const sandboxInternal = this.sandbox as any;
        const connectionConfig = sandboxInternal.connectionConfig;
        const api = sandboxInternal.api;

        if (connectionConfig && api) {
          // Create CodeInterpreter with the same Sandbox instance
          this.codeInterpreter = new CodeInterpreter(this.sandbox, connectionConfig, api);
          console.log('[CodeBox] CodeInterpreter created with shared Sandbox instance');

          // Create default context for state persistence
          this._defaultContext = await this.codeInterpreter.createCodeContext({
            language: 'python',
            cwd: '/workspace',
          });
          console.log('[CodeBox] Default context created:', this._defaultContext.id);
        } else {
          console.warn(
            '[CodeBox] Could not access Sandbox internals, using session-level persistence',
          );
        }
      } catch (error) {
        console.warn('[CodeBox] Failed to create CodeInterpreter:', error);
        console.log('[CodeBox] Falling back to Sandbox session-level persistence');
      }

      // Install requirements if any
      if (this.requirements.length > 0) {
        await this.run(`!pip install -q ${this.requirements.join(' ')}`);
      }

      return 'running';
    } catch (error) {
      console.error('Failed to start sandbox:', error);
      return 'error';
    }
  }

  /**
   * Get sandbox status
   */
  async status(): Promise<CodeBoxStatus> {
    if (!this.sandbox) {
      return 'stopped';
    }

    try {
      const isRunning = await this.sandbox.isRunning();
      return isRunning ? 'running' : 'stopped';
    } catch (error) {
      console.error('Failed to get sandbox status:', error);
      return 'error';
    }
  }

  /**
   * Create a code execution context
   * @param options - Context creation options
   * @returns Created context or null if CodeInterpreter is not available
   */
  async createCodeContext(options?: {
    language?: string;
    cwd?: string;
    envVars?: Record<string, string>;
  }): Promise<CodeContext | null> {
    if (!this.codeInterpreter) {
      console.warn('[CodeBox] CodeInterpreter not available, cannot create context');
      return null;
    }

    try {
      const context = await this.codeInterpreter.createCodeContext({
        language: (options?.language || 'python') as any,
        cwd: options?.cwd || '/workspace',
      });
      console.log(`[CodeBox] Context created: ${context.id}`);
      return context;
    } catch (error) {
      console.warn(
        `[CodeBox] Failed to create code context: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Destroy a code execution context
   * @param context - Context to destroy (can be CodeContext object or context ID string)
   */
  async destroyContext(context: CodeContext | string): Promise<void> {
    if (!this.codeInterpreter) {
      console.warn('[CodeBox] CodeInterpreter not available, cannot destroy context');
      return;
    }

    try {
      await this.codeInterpreter.destroyContext(context);
      const contextId = typeof context === 'string' ? context : context.id;
      console.log(`[CodeBox] Context destroyed: ${contextId}`);
    } catch (error) {
      const contextId = typeof context === 'string' ? context : context.id;
      console.warn(
        `[CodeBox] Failed to destroy context ${contextId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Execute code in the sandbox
   * @param code - Python code to execute
   * @param context - Optional context to maintain state across executions
   */
  async run(code: string, context?: CodeContext): Promise<CodeBoxOutput> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized. Call start() first.');
    }

    try {
      // Use provided context, or default context if available
      const executionContext = context || this._defaultContext;

      let result: ExecutionResult;

      // If we have CodeInterpreter and a context, use it for execution
      if (this.codeInterpreter && executionContext) {
        try {
          result = await this.codeInterpreter.execute({
            language: 'python',
            code,
            contextId: executionContext.id,
          });
          console.log(`[CodeBox] Code executed in context: ${executionContext.id}`);
        } catch (error) {
          console.warn('[CodeBox] Failed to execute with context, falling back to sandbox:', error);
          // Fallback to sandbox.runCode if context execution fails
          result = await this.sandbox.runCode(code, {
            language: 'python',
          });
        }
      } else {
        // Fallback to sandbox.runCode without context
        result = await this.sandbox.runCode(code, {
          language: 'python',
        });
      }

      // Check for errors
      if (result.error) {
        return {
          type: 'error',
          content: result.error.traceback || result.error.message || result.stderr,
        };
      }

      // Check for PNG output
      if (result.png) {
        return {
          type: 'image/png',
          content: result.png, // Base64 encoded
        };
      }

      // Check for multiple results with PNG
      if (result.results && result.results.length > 0) {
        const pngResult = result.results.find((r) => r.png);
        if (pngResult?.png) {
          return {
            type: 'image/png',
            content: pngResult.png,
          };
        }
      }

      // Default to text output
      return {
        type: 'text',
        content: result.stdout || result.text || '',
      };
    } catch (error) {
      return {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error during code execution',
      };
    }
  }

  /**
   * Upload a file to the sandbox
   * @returns The full path of the uploaded file in the sandbox
   */
  async upload(filename: string, content: Buffer | string): Promise<string> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized. Call start() first.');
    }

    try {
      // Use /workspace as the working directory
      const filePath = `/workspace/${filename}`;
      let writeInfo: WriteInfo | undefined;

      // For binary files (Buffer), convert to ArrayBuffer
      // For text files (string), use directly
      if (Buffer.isBuffer(content)) {
        // Convert Buffer to ArrayBuffer for binary files (like images)
        // Create a new ArrayBuffer to ensure it's not a SharedArrayBuffer
        const arrayBuffer = new ArrayBuffer(content.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < content.length; i++) {
          view[i] = content[i];
        }
        writeInfo = await this.sandbox.files.write(`/workspace/${filename}`, arrayBuffer);
      } else {
        // String content for text files
        writeInfo = await this.sandbox.files.write(`/workspace/${filename}`, content);
      }

      console.log(`[CodeBox] File uploaded: ${writeInfo.path} (name: ${writeInfo.name})`);

      return filePath;
    } catch (error) {
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Download a file from the sandbox
   *
   * @param filename - Name of the file to download
   * @param options - Download options
   * @param options.format - Format of the file content: 'text' (default), 'bytes', 'blob', or 'stream'
   * @returns Object containing the file content or null if download fails
   */
  async download(
    filename: string,
    options?: { format?: 'text' | 'bytes' | 'blob' | 'stream' },
  ): Promise<{ content: string | null }> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized. Call start() first.');
    }

    try {
      // Normalize the path - if it doesn't start with /, assume it's in /workspace
      const filePath = filename.startsWith('/') ? filename : `/workspace/${filename}`;

      const format = options?.format || 'text';
      const content = await this.sandbox.files.read(`/workspace/${filename}`, { format });
      console.log(`[CodeBox] File downloaded: ${filePath}`);
      return { content: content as string };
    } catch (error) {
      console.error(`[CodeBox] Failed to download file ${filename}:`, error);
      return { content: null };
    }
  }

  /**
   * Install a Python package
   */
  async install(packageName: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized. Call start() first.');
    }

    try {
      await this.run(`!pip install -q ${packageName}`);
    } catch (error) {
      throw new Error(
        `Failed to install package ${packageName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Stop the sandbox
   */
  async stop(): Promise<CodeBoxStatus> {
    if (!this.sandbox) {
      return 'stopped';
    }

    try {
      // Clean up default context if exists
      if (this._defaultContext) {
        await this.destroyContext(this._defaultContext);
        this._defaultContext = undefined;
      }

      // Close CodeInterpreter if it exists
      if (this.codeInterpreter) {
        try {
          await (this.codeInterpreter as any).close?.();
          console.log('[CodeBox] CodeInterpreter closed');
        } catch (error) {
          console.warn('[CodeBox] Failed to close CodeInterpreter:', error);
        }
        this.codeInterpreter = undefined;
      }

      await this.sandbox.kill();
      return 'stopped';
    } catch (error) {
      console.error('Failed to stop sandbox:', error);
      return 'error';
    }
  }

  /**
   * Check if sandbox is running
   */
  async isRunning(): Promise<boolean> {
    const status = await this.status();
    return status === 'running';
  }
}

export type { CodeBoxOptions as CodeBoxConfig };
