import { z } from 'zod';
import { ToolParams } from '@langchain/core/tools';
import { FirecrawlClient } from './client';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor } from '../base';
import { InferInteropZodOutput } from '@langchain/core/dist/utils/types';

interface FirecrawlToolParams extends ToolParams {
  apiKey: string;
  baseUrl?: string;
}

export class FirecrawlScrape extends AgentBaseTool<FirecrawlToolParams> {
  toolsetKey = 'firecrawl';
  name = 'firecrawl_scrape';

  schema = z.object({
    url: z.string().describe('The URL to scrape'),
  });

  description = 'A web scraper. Useful for when you need to scrape a website.';

  protected client: FirecrawlClient;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.client = new FirecrawlClient({
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
    });
  }

  async _call(
    input: InferInteropZodOutput<typeof FirecrawlScrape.prototype.schema>,
  ): Promise<string> {
    const data = await this.client.scrape({
      url: input.url,
      formats: ['markdown'],
    });
    return data.data?.markdown ?? '';
  }
}

export class FirecrawlSearch extends AgentBaseTool<FirecrawlToolParams> {
  toolsetKey = 'firecrawl';
  name = 'firecrawl_search';

  schema = z.object({
    query: z.string().describe('The search query to execute'),
    limit: z.number().describe('The number of results to return').default(5),
  });

  description =
    'A search engine. Useful for when you need to answer questions about current events.';

  protected client: FirecrawlClient;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.client = new FirecrawlClient({
      apiKey: params.apiKey,
    });
  }

  async _call(
    input: InferInteropZodOutput<typeof FirecrawlSearch.prototype.schema>,
  ): Promise<string> {
    const data = await this.client.search({
      query: input.query,
      limit: input.limit,
    });
    return JSON.stringify(data);
  }
}

export class FirecrawlToolset extends AgentBaseToolset<FirecrawlToolParams> {
  toolsetKey = 'firecrawl';
  labelDict = {
    en: 'Firecrawl',
  };
  descriptionDict = {
    en: 'Firecrawl is a toolset for scraping and searching the web.',
  };
  tools = [
    FirecrawlScrape,
    FirecrawlSearch,
  ] satisfies readonly AgentToolConstructor<FirecrawlToolParams>[];
}
