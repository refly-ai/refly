import { Injectable } from '@nestjs/common';
import { BaseParser, ParserOptions, ParseResult } from './base';

@Injectable()
export class PlainTextParser extends BaseParser {
  name = 'plain-text';

  constructor(options: ParserOptions = {}) {
    super(options);
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (typeof input === 'string') {
      return { content: input };
    }
    return { content: input.toString('utf-8') };
  }
}
