import { Injectable } from '@nestjs/common';

export interface ParserOptions {
  format?: string;
  mockMode?: boolean;
  timeout?: number;
  extractMedia?: boolean;
  resourceId?: string;
}

export interface ParseResult {
  content: string;
  title?: string;
  images?: Record<string, Buffer>; // pathname to image buffer
  metadata?: Record<string, any>;
  error?: string;
}

@Injectable()
export abstract class BaseParser {
  protected constructor(protected readonly options: ParserOptions = {}) {}

  abstract name: string;

  abstract parse(input: string | Buffer): Promise<ParseResult>;

  protected handleError(error: Error): ParseResult {
    return {
      content: '',
      error: error.message,
    };
  }
}
