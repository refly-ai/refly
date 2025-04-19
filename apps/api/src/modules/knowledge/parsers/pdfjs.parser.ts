import { Injectable } from '@nestjs/common';
import { BaseParser, ParserOptions, ParseResult } from './base';
import pdf from 'pdf-parse';

@Injectable()
export class PdfjsParser extends BaseParser {
  name = 'pdfjs';

  constructor(options: ParserOptions = {}) {
    super(options);
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (typeof input === 'string') {
      return { content: input };
    }

    const result = await pdf(input);
    return { content: result.text };
  }
}
