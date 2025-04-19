import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnsupportedFileTypeError } from '@refly/errors';
import { BaseParser, ParserOptions } from './base';
import { PandocParser } from './pandoc.parser';
import { MarkerParser } from './marker.parser';
import { JinaParser } from './jina.parser';
import { PlainTextParser } from '../../knowledge/parsers/plain-text.parser';
import { PdfjsParser } from '../../knowledge/parsers/pdfjs.parser';

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
        return new PandocParser({ mockMode, ...options });
      case 'marker':
        return new MarkerParser({ mockMode, ...options });
      case 'jina':
        return new JinaParser({
          mockMode,
          ...options,
          apiKey: this.config.get('credentials.jina'),
        });
      case 'plain-text':
        return new PlainTextParser({ mockMode, ...options });
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
        return new PlainTextParser(options);
      case 'text/html':
        return new PandocParser({ format: 'html', ...options });
      case 'application/pdf':
        if (this.config.get('parser.pdf') === 'marker') {
          return new MarkerParser({
            ...options,
            apiKey: this.config.get('credentials.marker'),
          });
        }
        return new PdfjsParser(options);
      case 'application/epub+zip':
        return new PandocParser({ format: 'epub', ...options });
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return new PandocParser({ format: 'docx', ...options });
      default:
        throw new UnsupportedFileTypeError(`Unsupported contentType: ${contentType}`);
    }
  }
}
