import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import axios from 'axios';

/**
 * File class to handle file operations
 */
export class File {
  constructor(
    public name: string,
    public content: Buffer,
  ) {}

  /**
   * Create a File instance from a file path
   */
  static fromPath(path: string): File {
    const normalizedPath = path.startsWith('/') ? path : `./${path}`;
    const content = readFileSync(normalizedPath);
    const filename = path.split('/').pop() || path;
    return new File(filename, content);
  }

  /**
   * Create a File instance from a URL
   */
  static async fromUrl(url: string): Promise<File> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const filename = url.split('/').pop() || 'downloaded-file';
    return new File(filename, Buffer.from(response.data));
  }

  /**
   * Save the file to disk
   */
  save(path: string): void {
    const normalizedPath = path.startsWith('/') ? path : `./${path}`;
    writeFileSync(normalizedPath, this.content);
  }

  /**
   * String representation of the file
   */
  toString(): string {
    return this.name;
  }
}

/**
 * Code input schema
 */
export const CodeInputSchema = z.object({
  code: z.string(),
});

export type CodeInput = z.infer<typeof CodeInputSchema>;

/**
 * File input schema
 */
export const FileInputSchema = z.object({
  filename: z.string(),
});

export type FileInput = z.infer<typeof FileInputSchema>;

/**
 * User request class extending HumanMessage
 */
export class UserRequest {
  content: string;
  files: File[];

  constructor(options: { content: string; files?: File[] }) {
    this.content = options.content;
    this.files = options.files || [];
  }

  toString(): string {
    return this.content;
  }

  toHumanMessage(): HumanMessage {
    return new HumanMessage(this.content);
  }
}

/**
 * Code interpreter response class
 */
export class CodeInterpreterResponse {
  content: string;
  files: File[];
  codeLog: Array<[string, string]>;

  constructor(options: {
    content: string;
    files: File[];
    codeLog: Array<[string, string]>;
  }) {
    this.content = options.content;
    this.files = options.files;
    this.codeLog = options.codeLog;
  }

  /**
   * Display the response
   */
  show(): void {
    console.log('AI:', this.content);
    for (const file of this.files) {
      console.log('File:', file.name);
    }
  }

  toString(): string {
    return this.content;
  }

  toAIMessage(): AIMessage {
    return new AIMessage(this.content);
  }
}

/**
 * Session status class
 */
export class SessionStatus {
  status: string;

  constructor(status: string) {
    this.status = status;
  }

  static fromCodeBoxStatus(codeBoxStatus: any): SessionStatus {
    return new SessionStatus(codeBoxStatus.status || codeBoxStatus);
  }

  toString(): string {
    return `<SessionStatus status=${this.status}>`;
  }
}
