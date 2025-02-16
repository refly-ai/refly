import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseParser, ParserOptions } from './base';
import { PandocParser } from './pandoc.parser';
import { MarkerParser } from './marker.parser';
import { JinaParser } from './jina.parser';
import { PlainTextParser } from '@/knowledge/parsers/plain-text.parser';
import { UnsupportedFileTypeError } from '@refly-packages/errors';

@Injectable()
export class ParserFactory {
  constructor(private readonly config: ConfigService) {}

  createParser(
    type: 'pandoc' | 'marker' | 'jina' | 'plain-text',
    options?: ParserOptions,
  ): BaseParser {
    const mockMode = this.config.get('env') === 'test';

    switch (type) {
      case 'pandoc':
        return new PandocParser(this.config, { mockMode, ...options });
      case 'marker':
        return new MarkerParser(this.config, { mockMode, ...options });
      case 'jina':
        return new JinaParser(this.config, { mockMode, ...options });
      case 'plain-text':
        return new PlainTextParser(this.config, { mockMode, ...options });
      default:
        throw new Error(`Unknown parser type: ${type}`);
    }
  }

  createParserByContentType(contentType: string, options?: ParserOptions): BaseParser {
    // You can refer to common MIME types here:
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/MIME_types/Common_types
    switch (contentType) {
      case 'text/plain':
      case 'text/markdown':
        return new PlainTextParser(this.config, { ...options });
      case 'text/html':
        return new PandocParser(this.config, { format: 'html', ...options });
      case 'application/pdf':
        return new MarkerParser(this.config, { ...options });
      case 'application/epub+zip':
        return new PandocParser(this.config, { format: 'epub', ...options });
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return new PandocParser(this.config, { format: 'docx', ...options });
      default:
        throw new UnsupportedFileTypeError(`Unsupported contentType: ${contentType}`);
    }
  }
}
