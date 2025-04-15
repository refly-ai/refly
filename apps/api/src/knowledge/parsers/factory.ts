import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseParser, ParserOptions } from './base';
import { PandocParser } from './pandoc.parser';
import { MarkerParser } from './marker.parser';
import { JinaParser } from './jina.parser';
import { TrafilaturaParser } from './trafilatura.parser';
import { PlainTextParser } from '@/knowledge/parsers/plain-text.parser';
import { UnsupportedFileTypeError } from '@refly-packages/errors';
import { PdfjsParser } from '@/knowledge/parsers/pdfjs.parser';
import { MinerUParser } from './mineru.parser'; // 导入 MinerUParser
import { MarkerLocalParser } from './marker-local.parser'; // 导入 MarkerLocalParser
import { getParserDefaultProvider, getParserProviderConfig } from '@/config/yaml-config.loader';
import { getPdfParserConfig } from '@/config/yaml-config.loader';

@Injectable()
export class ParserFactory {
  private readonly logger = new Logger(ParserFactory.name);
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
    this.logger.log(`[Debug Log] createParserByContentType called with contentType: '${contentType}'`);
    switch (contentType) {
      case 'text/plain':
      case 'text/markdown':
        return new PlainTextParser(options);
      case 'text/html': {
        const defaultProviderFromYaml = getParserDefaultProvider();
        const defaultProvider = defaultProviderFromYaml || 'jina';
        this.logger.log(`[Debug Log] For contentType 'text/html', read defaultProvider as: '${defaultProvider}'`);

        switch (defaultProvider) {
          case 'jina': {
            const apiKey = this.config.get<string>('JINA_API_KEY');
            if (!apiKey) {
              this.logger.error(
                'JINA_API_KEY is not configured in environment variables. JinaParser cannot be created.',
              );
            }
            this.logger.log('Creating JinaParser instance for HTML content.');
            return new JinaParser({
              apiKey,
              ...options,
            });
          }
          case 'trafilatura': {
            const trafilaturaConfig = getParserProviderConfig('trafilatura') || {};
            this.logger.log(
              'Creating TrafilaturaParser instance for HTML content.',
            );
            return new TrafilaturaParser({
              ...options,
              ...trafilaturaConfig,
            });
          }
          default: {
            this.logger.warn(
              `Unknown default parser provider configured: '${defaultProvider}'. Defaulting to 'jina'.`,
            );
            const apiKey = this.config.get<string>('JINA_API_KEY');
            if (!apiKey) {
              this.logger.error(
                'JINA_API_KEY is not configured in environment variables. JinaParser cannot be created (default fallback).',
              );
            }
            return new JinaParser({
              apiKey,
              ...options,
            });
          }
        }
      }
      case 'application/pdf': {
        const pdfParserConfig = getPdfParserConfig(); // 获取 PDF 解析器配置
        if (!pdfParserConfig) {
          this.logger.error('PDF parser configuration not found in YAML config.');
          // Fallback to a default or throw error
          this.logger.warn("Falling back to PdfjsParser due to missing PDF config.");
          return new PdfjsParser(options); // Fallback to basic parser
          // Or: throw new Error('PDF parser configuration is missing.');
        }

        switch (pdfParserConfig.provider) {
          case 'mineru': {
            // ... existing mineru case ...
            const mineruConfig = pdfParserConfig.mineru;
            if (!mineruConfig || !mineruConfig.api_key) { // Check for api_key as well
              this.logger.error('MinerU configuration or API key not found in PDF parser config.');
              throw new Error('MinerU configuration is missing or incomplete.');
            }
            this.logger.log('Creating MinerUParser instance for PDF content.');
            // Combine specific config and general options into a single object
             try {
                // Constructor expects a single options object: new MinerUParser(options)
                return new MinerUParser({ ...mineruConfig, ...options });
             } catch (e) {
                 this.logger.error(`Error instantiating MinerUParser: ${e.message}`, e.stack);
                 throw e; // Rethrow after logging
             }
          }
          case 'marker': {
            // ... existing marker case ...
            const apiKey = this.config.get<string>('MARKER_API_KEY');
            if (!apiKey) {
              this.logger.error(
                'MARKER_API_KEY is not configured in environment variables. MarkerParser cannot be created.',
              );
               throw new Error('MARKER_API_KEY is missing for Marker PDF parser.');
            }
            this.logger.log('Creating MarkerParser instance for PDF content (using .env config).');
            // Assuming MarkerParser constructor takes (options) where options includes apiKey
            return new MarkerParser({
              ...options,
              apiKey: apiKey,
              // apiUrl: this.config.get<string>('MARKER_API_URL'),
            });
          }
          // --- NEW CASE for marker_local ---
          case 'marker_local': {
            const markerLocalConfig = pdfParserConfig.marker_local;
            if (!markerLocalConfig || !markerLocalConfig.output_format) {
                 this.logger.error('Marker Local CLI configuration (marker_local) or output_format not found in PDF parser config.');
                 throw new Error('Marker Local CLI configuration is missing or incomplete.');
            }
             this.logger.log('Creating MarkerLocalParser instance for PDF content (using YAML config).');
             // Pass the specific marker_local config and the general options
             // Assuming MarkerLocalParser constructor takes (config, options)
             try {
                return new MarkerLocalParser(markerLocalConfig, options);
             } catch (e) {
                 this.logger.error(`Error instantiating MarkerLocalParser: ${e.message}`, e.stack);
                 throw e; // Rethrow after logging
             }
          }
          // --- END NEW CASE ---
          default: {
             // Check if provider was explicitly set to something unknown vs just missing
             const providerValue = pdfParserConfig.provider;
             if (providerValue && providerValue !== 'mineru' && providerValue !== 'marker' && providerValue !== 'marker_local') {
                this.logger.warn(
                  `Unknown or unsupported PDF parser provider configured: '${providerValue}'. Defaulting to 'pdfjs'.`, // More specific warning
                );
             } else {
                 // Provider might be missing entirely if config structure is wrong, or typo in provider name
                 this.logger.warn(`PDF parser provider is missing or invalid in config. Defaulting to 'pdfjs'.`);
             }
            return new PdfjsParser(options);
          }
        }
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
