import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseParser, ParserOptions, ParseResult } from './base';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';

interface BilibiliOptions extends ParserOptions {
  apiKey?: string;
  cookie?: string;
}

interface BilibiliApiResponse {
  code: number;
  message: string;
  data?: {
    subtitle?: {
      list: Array<{
        lan: string;
        subtitle_url: string;
      }>;
    };
    title?: string;
    desc?: string;
    owner?: {
      name: string;
    };
  };
}

@Injectable()
export class BilibiliParser extends BaseParser {
  private readonly apiKey: string;
  private readonly cookie: string;
  private readonly logger: Logger = new Logger(BilibiliParser.name);

  constructor(
    private readonly config: ConfigService,
    readonly options: BilibiliOptions = {},
  ) {
    super(options);
    this.apiKey = options.apiKey ?? this.config.getOrThrow('credentials.bilibili');
    this.cookie = options.cookie ?? this.config.get('credentials.bilibiliCookie') ?? '';
  }

  private extractBvid(url: string): string {
    const bvidMatch = url.match(/BV[a-zA-Z0-9]+/);
    if (!bvidMatch) {
      throw new Error('Invalid Bilibili URL');
    }
    return bvidMatch[0];
  }

  private async fetchVideoInfo(bvid: string): Promise<BilibiliApiResponse> {
    const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const response = await fetch(apiUrl, {
      headers: {
        Cookie: this.cookie,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Bilibili API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchSubtitle(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch subtitle');
    }
    const data = await response.json();
    return data.body?.map((item: { content: string }) => item.content).join(' ') ?? '';
  }

  async parse(input: string): Promise<ParseResult> {
    if (this.options.mockMode) {
      return {
        content: 'Mocked Bilibili content',
        metadata: { source: 'bilibili' },
      };
    }

    try {
      // Validate input is a URL
      const url = new URL(input);
      const bvid = this.extractBvid(url.toString());

      // Fetch video information
      const videoInfo = await this.fetchVideoInfo(bvid);

      if (videoInfo.code !== 0) {
        throw new Error(`Bilibili API error: ${videoInfo.message}`);
      }

      // Initialize Cheerio loader for the webpage
      const loader = new CheerioWebBaseLoader(url.toString(), {
        selector: '.video-description',
      });

      // Load the page content
      const docs = await loader.load();

      // Fetch subtitles if available
      let subtitleContent = '';
      if (videoInfo.data?.subtitle?.list?.length > 0) {
        const subtitleUrl = videoInfo.data.subtitle.list[0].subtitle_url;
        try {
          subtitleContent = await this.fetchSubtitle(subtitleUrl);
        } catch (error) {
          this.logger.warn('Failed to fetch subtitle', error);
        }
      }

      // Combine all content
      const pageContent = docs.map((doc) => doc.pageContent).join('\n\n');

      return {
        content: [videoInfo.data?.title, videoInfo.data?.desc, pageContent, subtitleContent]
          .filter(Boolean)
          .join('\n\n'),
        metadata: {
          source: 'bilibili',
          bvid,
          url: url.toString(),
          title: videoInfo.data?.title,
          author: videoInfo.data?.owner?.name,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
