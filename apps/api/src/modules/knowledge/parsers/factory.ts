import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnsupportedFileTypeError } from '@refly/errors';
import { BaseParser, ParserOptions } from './base';
import { PandocParser } from './pandoc.parser';
import { MarkerParser } from './marker.parser';
import { JinaParser } from './jina.parser';
import { PlainTextParser } from '../parsers/plain-text.parser';
import { PdfjsParser } from '../parsers/pdfjs.parser';
import { User } from '@refly/openapi-schema';
import { CheerioParser } from '../parsers/cheerio.parser';
import { ProviderService } from '../../provider/provider.service';

@Injectable()
export class ParserFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Create a web parser
   * @param user - The user to create the parser for
   * @param options - The options to create the parser with
   * @returns A promise that resolves to the created parser
   */
  async createWebParser(user: User, options?: ParserOptions): Promise<BaseParser> {
    const provider = await this.providerService.findProviderByCategory(user, 'urlParsing');
    const mockMode = this.config.get('env') === 'test';
    switch (provider?.providerKey) {
      case 'jina':
        return new JinaParser({ mockMode, apiKey: provider.apiKey, ...options });
      default:
        // Fallback to builtin cheerio parser
        return new CheerioParser({ mockMode, ...options });
    }
  }

  /**
   * Create a document parser
   * @param user - The user to create the parser for
   * @param contentType - The content type of the document
   * @param options - The options to create the parser with
   * @returns A promise that resolves to the created parser
   */
  async createDocumentParser(
    user: User,
    contentType: string,
    options?: ParserOptions,
  ): Promise<BaseParser> {
    // You can refer to common MIME types here:
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/MIME_types/Common_types
    switch (contentType) {
      case 'text/plain':
      case 'text/markdown':
        return new PlainTextParser(options);
      case 'text/html':
        return new PandocParser({ format: 'html', ...options });
      case 'application/pdf': {
        const provider = await this.providerService.findProviderByCategory(user, 'pdfParsing');
        if (provider?.providerKey === 'marker') {
          return new MarkerParser({
            ...options,
            apiKey: provider.apiKey,
          });
        }
        return new PdfjsParser(options);
      }
      case 'application/epub+zip':
        return new PandocParser({ format: 'epub', ...options });
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return new PandocParser({ format: 'docx', ...options });
      default:
        throw new UnsupportedFileTypeError(`Unsupported contentType: ${contentType}`);
    }
  }
}
