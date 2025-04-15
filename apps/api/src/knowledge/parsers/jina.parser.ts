import { Injectable } from '@nestjs/common';
import { BaseParser, ParserOptions, ParseResult } from './base';

interface JinaOptions extends ParserOptions {
  apiKey?: string;
  apiUrl?: string;
}

@Injectable()
export class JinaParser extends BaseParser {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  name = 'jina';

  constructor(options: JinaOptions = {}) {
    super(options);
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl ?? 'https://r.jina.ai/';
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (this.options.mockMode) {
      return {
        content: 'Mocked jina content',
        metadata: { source: 'jina' },
      };
    }

    const url = input.toString();

    try {
      const response = await fetch(this.apiUrl + url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Jina API error: ${response.statusText}`);
      }

      const { data } = await response.json();
      return {
        title: data?.title,
        content: data?.content,
        metadata: { source: 'jina' },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
