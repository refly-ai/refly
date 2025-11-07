import { Sandbox } from '@scalebox/sdk';
import { ExecutionResult } from './types';

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
 * CodeBox - Simplified adapter for Scalebox SDK
 *
 * This adapter provides a clean interface compatible with the codeboxapi
 * while using Scalebox SDK under the hood.
 */
export class CodeBox {
  private sandbox?: Sandbox;
  private _sessionId?: string;
  private requirements: string[];
  private options: CodeBoxOptions;

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
   * Create a CodeBox from an existing session ID
   */
  static async fromId(sessionId: string, options: CodeBoxOptions = {}): Promise<CodeBox> {
    const codebox = new CodeBox(options);
    codebox._sessionId = sessionId;

    // Connect to existing sandbox
    codebox.sandbox = await Sandbox.connect(sessionId, {
      apiKey: options.apiKey || process.env.SCALEBOX_API_KEY || '',
    });

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
   * Execute code in the sandbox
   */
  async run(code: string): Promise<CodeBoxOutput> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized. Call start() first.');
    }

    try {
      const result: ExecutionResult = await this.sandbox.runCode(code, {
        language: 'python',
      });

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
   */
  async upload(filename: string, content: Buffer | string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized. Call start() first.');
    }

    try {
      // Convert Buffer to string or use string directly
      const fileContent = Buffer.isBuffer(content) ? content.toString('utf-8') : content;

      await this.sandbox.files.write(`/workspace/${filename}`, fileContent);
    } catch (error) {
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Download a file from the sandbox
   */
  async download(filename: string): Promise<{ content: string | null }> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized. Call start() first.');
    }

    try {
      const content = await this.sandbox.files.read(`/workspace/${filename}`);
      return { content: content as string };
    } catch (error) {
      console.error(`Failed to download file ${filename}:`, error);
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
