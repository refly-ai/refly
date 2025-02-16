import { Injectable } from '@nestjs/common';
import { BaseParser, ParserOptions, ParseResult } from './base';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PlainTextParser extends BaseParser {
  constructor(
    private readonly config: ConfigService,
    options: ParserOptions = {},
  ) {
    super(options);
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (typeof input === 'string') {
      return { content: input };
    }
    return { content: input.toString('utf-8') };
  }
}
