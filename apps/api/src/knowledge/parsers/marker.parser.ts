import { Injectable, Logger } from '@nestjs/common';
import { BaseParser, ParserOptions, ParseResult } from './base';

interface MarkerParseResponse {
  success?: boolean;
  error?: string;
  request_id: string;
  request_check_url: string;
}

interface MarkerCheckResponse {
  output_format: string;
  markdown: string;
  status: string;
  success: boolean;
  images: Record<string, string>;
  metadata: Record<string, any>;
  error: string;
}

interface MarkerOptions extends ParserOptions {
  apiKey?: string;
  apiUrl?: string;
  maxPolls?: number;
  pollInterval?: number;

  forceOcr?: boolean;
  paginate?: boolean;
  outputFormat?: string;
  useLlM?: boolean;
  stripExistingOcr?: boolean;
  disableImageExtraction?: boolean;
}

/**
 * Marker API: https://www.datalab.to/marker
 * You can provide the api key via environment variable: MARKER_API_KEY
 */
@Injectable()
export class MarkerParser extends BaseParser {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly maxPolls: number;
  private readonly pollInterval: number;
  private readonly logger: Logger = new Logger(MarkerParser.name);

  name = 'marker';

  constructor(options: MarkerOptions = {}) {
    super(options);
    this.apiUrl = options.apiUrl ?? 'https://www.datalab.to/api/v1/marker';
    this.apiKey = options.apiKey;
    this.maxPolls = options.maxPolls ?? 30;
    this.pollInterval = options.pollInterval ?? 2000; // 2 seconds

    if (!this.apiKey) {
      throw new Error('Marker API key is not configured');
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async pollResult(checkUrl: string): Promise<MarkerCheckResponse> {
    for (let i = 0; i < this.maxPolls; i++) {
      await this.sleep(this.pollInterval);

      const response = await fetch(checkUrl, {
        headers: { 'X-Api-Key': this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Marker API polling error: ${response.statusText}`);
      }

      const data: MarkerCheckResponse = await response.json();
      this.logger.log(`Marker check response: ${JSON.stringify(data)}`);

      if (data.status === 'complete') {
        return data;
      }
    }

    throw new Error('Marker API polling count exceeded');
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (this.options.mockMode) {
      return {
        content: 'Mocked marker content',
        metadata: { source: 'marker' },
      };
    }

    if (!this.apiKey) {
      throw new Error('Marker API key is not configured');
    }

    try {
      const formData = new FormData();

      // Add the file content
      const fileBuf = Buffer.isBuffer(input) ? input : Buffer.from(input);
      const blob = new Blob([fileBuf], { type: 'application/pdf' });
      formData.append('file', blob, `${this.options.resourceId || 'document'}.pdf`);

      // formData.append('langs', 'English');
      formData.append('force_ocr', 'false');
      formData.append('paginate', 'false');
      formData.append('output_format', 'markdown');
      formData.append('use_llm', 'false');
      formData.append('strip_existing_ocr', 'false');
      formData.append('disable_image_extraction', 'false');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'X-Api-Key': this.apiKey },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Marker API error: ${response.statusText}`);
      }

      const initialData: MarkerParseResponse = await response.json();
      this.logger.log(`Marker parse response: ${JSON.stringify(initialData)}`);

      if (!initialData?.success) {
        throw new Error(`Marker parse not successful, error: ${initialData.error}`);
      }

      // Poll for results
      const result = await this.pollResult(initialData.request_check_url);

      return {
        content: result.markdown ?? '',
        images: Object.fromEntries(
          Object.entries(result.images ?? {}).map(([key, value]) => [
            key,
            Buffer.from(value, 'base64'),
          ]),
        ),
        metadata: { ...result.metadata, source: 'marker' },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
