import { z } from 'zod';
import { ToolParams } from '@langchain/core/tools';
import { FirecrawlClient } from './client';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { encode, decode } from 'gpt-tokenizer';

// Fallback summarizer trims text to budget using token-based middle-out truncation
export const fallbackSummarize = async (
  _query: string,
  content: string,
  budget: number,
): Promise<string> => {
  // Keep short content unchanged
  const tokens = encode(content ?? '');
  if (tokens.length <= budget) return content ?? '';

  // Allocate 45/10/45 head/summary/tail by tokens
  const summaryBudget = Math.max(48, Math.min(128, Math.floor(budget * 0.2)));
  const headBudget = Math.max(1, Math.floor((budget - summaryBudget) / 2));
  const tailBudget = Math.max(1, budget - summaryBudget - headBudget);

  const headTokens = tokens.slice(0, headBudget);
  const tailTokens = tokens.slice(tokens.length - tailBudget);

  const head = decode(headTokens);
  const tail = decode(tailTokens);

  // Use a simple placeholder for the middle in fallback mode
  const middleNote = `\n\n...[${tokens.length - headTokens.length - tailTokens.length} tokens compressed]...\n\n`;

  return `${head}${middleNote}${tail}`;
};

export const FirecrawlToolsetDefinition: ToolsetDefinition = {
  key: 'firecrawl',
  domain: 'https://firecrawl.dev',
  labelDict: {
    en: 'Firecrawl',
    'zh-CN': 'Firecrawl',
  },
  descriptionDict: {
    en: 'Firecrawl is a powerful API service that takes URLs, crawls them, and converts them into clean markdown or structured data. Features advanced scraping, crawling, and AI-powered data extraction capabilities.',
    'zh-CN':
      'Firecrawl 是一个强大的 API 服务，可以抓取 URL，爬取内容，并将其转换为干净的 markdown 或结构化数据。具有高级抓取、爬取和 AI 驱动的数据提取功能。',
  },
  tools: [
    {
      name: 'scrape',
      descriptionDict: {
        en: 'Scrapes a single URL and returns content in LLM-ready formats (markdown, HTML, structured data, screenshots). Supports dynamic content, PDFs, and custom actions like clicking and scrolling.',
        'zh-CN':
          '抓取单个 URL 并以 LLM 就绪的格式返回内容（markdown、HTML、结构化数据、截图）。支持动态内容、PDF 和自定义操作，如点击和滚动。',
      },
    },
    {
      name: 'search',
      descriptionDict: {
        en: 'Searches the web and returns full content from results. Useful for answering questions about current events and getting comprehensive information from multiple sources.',
        'zh-CN':
          '搜索网络并从结果中返回完整内容。适用于回答有关当前事件的问题和从多个来源获取全面信息。',
      },
    },
    {
      name: 'crawl',
      descriptionDict: {
        en: 'Crawls a URL and all accessible subpages, returning content in LLM-ready format. Supports custom depth limits, path filtering, and batch processing for comprehensive website analysis.',
        'zh-CN':
          '爬取 URL 和所有可访问的子页面，以 LLM 就绪的格式返回内容。支持自定义深度限制、路径过滤和批处理，用于全面的网站分析。',
      },
    },
    {
      name: 'map',
      descriptionDict: {
        en: 'Maps a website to discover all URLs and links. Extremely fast for getting a complete overview of website structure without scraping content.',
        'zh-CN':
          '映射网站以发现所有 URL 和链接。非常快速地获取网站结构的完整概览，而无需抓取内容。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialItems: [
        {
          key: 'apiKey',
          inputMode: 'text',
          inputProps: {
            passwordType: true,
          },
          labelDict: {
            en: 'API Key',
            'zh-CN': 'API 密钥',
          },
          descriptionDict: {
            en: 'The API key for Firecrawl',
            'zh-CN': 'Firecrawl 的 API 密钥',
          },
          required: true,
        },
      ],
    },
  ],
  configItems: [
    {
      key: 'baseUrl',
      inputMode: 'text',
      labelDict: {
        en: 'Base URL',
        'zh-CN': '基础 URL',
      },
      descriptionDict: {
        en: 'The base URL of Firecrawl service',
        'zh-CN': 'Firecrawl 服务的 URL',
      },
      defaultValue: 'https://api.firecrawl.dev/v1',
    },
  ],
};

interface FirecrawlToolParams extends ToolParams {
  apiKey: string;
  baseUrl?: string;
}

export class FirecrawlScrape extends AgentBaseTool<FirecrawlToolParams> {
  name = 'scrape';
  toolsetKey = FirecrawlToolsetDefinition.key;

  schema = z.object({
    url: z.string().describe('The URL to scrape'),
    formats: z
      .array(
        z.enum([
          'markdown',
          'html',
          'rawHtml',
          'links',
          'screenshot',
          'screenshot@fullPage',
          'json',
          'changeTracking',
        ]),
      )
      .describe('Output formats to return')
      .default(['markdown']),
    onlyMainContent: z.boolean().describe('Whether to extract only main content').default(true),
    includeTags: z.array(z.string()).describe('HTML tags to include').optional(),
    excludeTags: z.array(z.string()).describe('HTML tags to exclude').optional(),
    maxAge: z.number().describe('Maximum age of cached content in seconds').optional(),
    waitFor: z.number().describe('Time to wait for dynamic content in milliseconds').optional(),
    mobile: z.boolean().describe('Whether to use mobile user agent').default(false),
    parsePDF: z.boolean().describe('Whether to parse PDF content').default(false),
    maxTokens: z
      .number()
      .describe('Maximum tokens for markdown content truncation')
      .default(10000)
      .optional(),
  });

  description =
    'Scrapes a single URL and returns content in LLM-ready formats (markdown, HTML, structured data, screenshots). Supports dynamic content, PDFs, and custom actions like clicking and scrolling.';

  protected params: FirecrawlToolParams;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new FirecrawlClient({
        apiKey: this.params.apiKey,
        baseUrl: this.params.baseUrl,
      });

      const data = await client.scrape({
        url: input.url,
        formats: input.formats,
        onlyMainContent: input.onlyMainContent,
        includeTags: input.includeTags,
        excludeTags: input.excludeTags,
        maxAge: input.maxAge,
        waitFor: input.waitFor,
        mobile: input.mobile,
        parsePDF: input.parsePDF,
      });

      // Return markdown if available, otherwise return the full response
      if (input.formats.includes('markdown') && data.data?.markdown) {
        let markdownContent = data.data.markdown;

        // Apply truncation if maxTokens is specified and content is too long

        // Ensure maxTokens is within safe limits (considering total context budget)
        // Reserve space for tool input (2k) + output (63k) + buffer (10k) = ~75k
        // Max safe input: 131k - 75k = 56k, but be conservative with 2k
        const safeMaxTokens = Math.min(input.maxTokens ?? 10000, 10000);
        markdownContent = await fallbackSummarize(
          `Scrape content from ${input.url}`,
          markdownContent,
          safeMaxTokens,
        );

        return {
          status: 'success',
          data: { content: markdownContent, fullResponse: data.data },
          summary: `Successfully scraped URL: ${input.url} and extracted markdown content${(input.maxTokens ?? 0) > 0 ? ` (truncated to ${Math.min(input.maxTokens ?? 10000, 10000)} tokens for safety)` : ''}`,
        };
      }

      // Return structured data for other formats
      return {
        status: 'success',
        data: data.data,
        summary: `Successfully scraped URL: ${input.url} in requested formats`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error scraping URL',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while scraping URL',
      };
    }
  }
}

export class FirecrawlSearch extends AgentBaseTool<FirecrawlToolParams> {
  name = 'search';
  toolsetKey = FirecrawlToolsetDefinition.key;

  schema = z.object({
    query: z.string().describe('The search query to execute'),
    limit: z.number().describe('The number of results to return').default(5),
    tbs: z.string().describe('Time-based search filter (e.g., "qdr:d" for last day)').optional(),
    location: z.string().describe('Geographic location for search results').optional(),
    timeout: z.number().describe('Timeout for search operation in seconds').default(30),
    ignoreInvalidURLs: z
      .boolean()
      .describe('Whether to ignore invalid URLs in results')
      .default(false),
  });

  description =
    'Searches the web and returns full content from results. Useful for answering questions about current events and getting comprehensive information from multiple sources.';

  protected params: FirecrawlToolParams;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new FirecrawlClient({
        apiKey: this.params.apiKey,
      });

      const data = await client.search({
        query: input.query,
        limit: input.limit,
        tbs: input.tbs,
        location: input.location,
        timeout: input.timeout,
        ignoreInvalidURLs: input.ignoreInvalidURLs,
      });

      return {
        status: 'success',
        data: data,
        summary: `Successfully performed web search for query: "${input.query}" and found ${data.data?.length ?? 0} results`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error performing web search',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while performing web search',
      };
    }
  }
}

export class FirecrawlCrawl extends AgentBaseTool<FirecrawlToolParams> {
  name = 'crawl';
  toolsetKey = FirecrawlToolsetDefinition.key;

  schema = z.object({
    url: z.string().describe('The starting URL to crawl'),
    maxDepth: z.number().describe('Maximum depth of crawling').default(2),
    maxDiscoveryDepth: z.number().describe('Maximum depth for discovering new URLs').default(3),
    limit: z.number().describe('Maximum number of pages to crawl').default(10),
    excludePaths: z.array(z.string()).describe('Paths to exclude from crawling').optional(),
    includePaths: z.array(z.string()).describe('Paths to include in crawling').optional(),
    delay: z.number().describe('Delay between requests in milliseconds').default(1000),
    ignoreSitemap: z.boolean().describe('Whether to ignore sitemap.xml').default(false),
    ignoreQueryParameters: z
      .boolean()
      .describe('Whether to ignore query parameters in URLs')
      .default(false),
    allowBackwardLinks: z
      .boolean()
      .describe('Whether to allow crawling backward links')
      .default(false),
    allowExternalLinks: z
      .boolean()
      .describe('Whether to allow crawling external links')
      .default(false),
  });

  description =
    'Crawls a URL and all accessible subpages, returning content in LLM-ready format. Supports custom depth limits, path filtering, and batch processing for comprehensive website analysis.';

  protected params: FirecrawlToolParams;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new FirecrawlClient({
        apiKey: this.params.apiKey,
        baseUrl: this.params.baseUrl,
      });

      const crawlResponse = await client.crawl({
        url: input.url,
        maxDepth: input.maxDepth,
        maxDiscoveryDepth: input.maxDiscoveryDepth,
        limit: input.limit,
        excludePaths: input.excludePaths,
        includePaths: input.includePaths,
        delay: input.delay,
        ignoreSitemap: input.ignoreSitemap,
        ignoreQueryParameters: input.ignoreQueryParameters,
        allowBackwardLinks: input.allowBackwardLinks,
        allowExternalLinks: input.allowExternalLinks,
      });

      // Return the crawl ID and instructions for checking status
      return {
        status: 'success',
        data: {
          crawlId: crawlResponse.id,
          message:
            'Crawl started successfully. Use the crawl ID to check status and retrieve results.',
          statusUrl: `https://api.firecrawl.dev/v1/crawl/${crawlResponse.id}`,
        },
        summary: `Successfully started crawling website: ${input.url} with max depth ${input.maxDepth}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error crawling website',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while crawling website',
      };
    }
  }
}

export class FirecrawlMap extends AgentBaseTool<FirecrawlToolParams> {
  name = 'map';
  toolsetKey = FirecrawlToolsetDefinition.key;

  schema = z.object({
    url: z.string().describe('The URL to map'),
    limit: z.number().describe('Maximum number of links to discover').default(100),
    includeSubdomains: z.boolean().describe('Whether to include subdomains').default(false),
    search: z.string().describe('Search term to filter links').optional(),
    ignoreSitemap: z.boolean().describe('Whether to ignore sitemap.xml').default(false),
    sitemapOnly: z.boolean().describe('Whether to only use sitemap for mapping').default(false),
    timeout: z.number().describe('Timeout for the mapping operation in seconds').default(30),
  });

  description =
    'Maps a website to discover all URLs and links. Extremely fast for getting a complete overview of website structure without scraping content.';

  protected params: FirecrawlToolParams;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new FirecrawlClient({
        apiKey: this.params.apiKey,
        baseUrl: this.params.baseUrl,
      });

      const data = await client.map({
        url: input.url,
        limit: input.limit,
        includeSubdomains: input.includeSubdomains,
        search: input.search,
        ignoreSitemap: input.ignoreSitemap,
        sitemapOnly: input.sitemapOnly,
        timeout: input.timeout,
      });

      return {
        status: 'success',
        data: data,
        summary: `Successfully mapped website: ${input.url} and discovered ${data.links?.length ?? 0} links`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error mapping website',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while mapping website',
      };
    }
  }
}

export class FirecrawlToolset extends AgentBaseToolset<FirecrawlToolParams> {
  toolsetKey = FirecrawlToolsetDefinition.key;
  tools = [
    FirecrawlScrape,
    FirecrawlSearch,
    FirecrawlCrawl,
    FirecrawlMap,
  ] satisfies readonly AgentToolConstructor<FirecrawlToolParams>[];
}
