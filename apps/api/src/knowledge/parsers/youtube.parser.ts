import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseParser, ParserOptions, ParseResult } from './base';
import { YoutubeLoader } from '@langchain/community/document_loaders/web/youtube';
import { Innertube } from 'youtubei.js';

interface YoutubeOptions extends ParserOptions {
  language?: string;
}

@Injectable()
export class YoutubeParser extends BaseParser {
  private readonly logger: Logger = new Logger(YoutubeParser.name);
  private youtube: Innertube;

  constructor(
    private readonly config: ConfigService,
    readonly options: YoutubeOptions = {},
  ) {
    super(options);
  }

  private async initYoutube() {
    if (!this.youtube) {
      this.youtube = await Innertube.create();
    }
    return this.youtube;
  }

  private extractVideoId(url: string): string {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match?.[2]?.length === 11) {
      return match[2];
    }

    throw new Error('Invalid YouTube URL');
  }

  async parse(input: string): Promise<ParseResult> {
    if (this.options.mockMode) {
      return {
        content: 'Mocked YouTube content',
        metadata: { source: 'youtube' },
      };
    }

    try {
      // Validate input is a URL
      const url = new URL(input);
      const videoId = this.extractVideoId(url.toString());

      // Initialize YouTube loader with the video URL
      const loader = YoutubeLoader.createFromUrl(url.toString(), {
        language: this.options.language ?? 'en',
        addVideoInfo: true,
      });

      // Load the transcript and metadata using langchain
      const docs = await loader.load();

      // Get additional video info using youtubei.js
      const youtube = await this.initYoutube();
      const videoInfo = await youtube.getBasicInfo(videoId);

      // Combine all content
      const content = [docs.map((doc) => doc.pageContent).join('\n\n')]
        .filter(Boolean)
        .join('\n\n');

      return {
        content: content,
        metadata: {
          ...docs[0]?.metadata,
          source: 'youtube',
          videoId,
          url: url.toString(),
          title: videoInfo.basic_info.title,
          author: videoInfo.basic_info.author,
          description: videoInfo.basic_info.short_description,
          duration: videoInfo.basic_info.duration,
          views: videoInfo.basic_info.view_count,
          uploadDate: videoInfo.basic_info.start_timestamp,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
