import { z } from 'zod/v3';
import { AgentBaseTool, ToolCallResult, AgentBaseToolset, AgentToolConstructor } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { JinaClient } from './client';
import { ToolParams } from '@langchain/core/tools';
import { countToken, truncateContent } from '@refly/utils';

// Maximum tokens for a single tool result to prevent excessive context usage
// Can be overridden via environment variable
const MAX_TOOL_RESULT_TOKENS = Number(process.env.MAX_TOOL_RESULT_TOKENS) || 20000;

export const JinaToolsetDefinition: ToolsetDefinition = {
  key: 'jina',
  domain: 'https://jina.ai',
  labelDict: {
    en: 'Jina',
    'zh-CN': 'Jina',
  },
  descriptionDict: {
    en: 'Jina provides URL content extraction and site-specific search capabilities',
    'zh-CN': 'Jina 提供 URL 内容提取和站点定向搜索能力',
  },
  tools: [
    {
      name: 'read',
      descriptionDict: {
        en: 'Fetch and extract content from a specific URL. Supports markdown/html/text/screenshot output. Use when you have a known URL to read.',
        'zh-CN':
          '从指定 URL 获取并提取内容。支持 markdown/html/text/screenshot 输出格式。适用于已知 URL 的内容读取。',
      },
    },
    {
      name: 'serp',
      descriptionDict: {
        en: 'Search with site-specific filtering (site parameter). Can read full content of results. Use for targeted domain search, NOT general web search.',
        'zh-CN':
          '支持站点定向搜索（site 参数）。可读取搜索结果完整内容。适用于特定站点搜索，不适用于通用网络搜索。',
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
            en: 'The API key for Jina',
            'zh-CN': 'Jina  的 API 密钥',
          },
          required: true,
        },
      ],
    },
  ],
  configItems: [],
};

interface JinaToolParams extends ToolParams {
  apiKey: string;
}

export class JinaRead extends AgentBaseTool<JinaToolParams> {
  name = 'read';
  toolsetKey = JinaToolsetDefinition.key;

  schema = z.object({
    url: z.string().describe('The URL to read'),
    returnFormat: z
      .enum(['markdown', 'html', 'text', 'screenshot', 'pageshot'])
      .describe('Output formats to return')
      .default('markdown'),
  });

  description =
    'Fetch and extract content from a specific URL. Supports markdown/html/text/screenshot output. Use when you have a known URL to read.';

  protected params: JinaToolParams;

  constructor(params: JinaToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new JinaClient({ apiKey: this.params.apiKey });
      const response = await client.read(input.url, input.returnFormat);

      // Calculate credit cost based on tokens used: 7 credits per million tokens, minimum 1 credit
      const tokens = response.data?.usage?.tokens ?? 0;
      const creditCost = Math.max(1, Math.ceil((tokens / 1000000) * 7));

      // Truncate content if it exceeds the maximum token limit
      if (response.data?.content) {
        const contentTokens = countToken(response.data.content);

        if (contentTokens > MAX_TOOL_RESULT_TOKENS) {
          response.data.content = truncateContent(response.data.content, MAX_TOOL_RESULT_TOKENS);
        }
      }

      return {
        status: 'success',
        data: response.data,
        summary: `Successfully read the content of ${input.url}`,
        creditCost,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error reading URL',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while reading URL',
      };
    }
  }
}

export class JinaSerp extends AgentBaseTool<JinaToolParams> {
  name = 'serp';
  toolsetKey = JinaToolsetDefinition.key;

  schema = z.object({
    query: z.string().describe('The query to search for'),
    readFullContent: z
      .boolean()
      .describe(
        'Whether to read the full content of the search results, default is false, try to choose false if possible',
      )
      .default(false),
    site: z.string().describe('The site to search for').optional(),
    offset: z.number().describe('The offset to search for').default(1),
  });

  description =
    'Search with site-specific filtering (site parameter). Can read full content of results. Use for targeted domain search, NOT general web search.';

  protected params: JinaToolParams;

  constructor(params: JinaToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new JinaClient({ apiKey: this.params.apiKey });
      const response = await client.serp(
        input.query,
        input.readFullContent,
        input.site,
        input.offset,
      );

      // Strategy: ensure all results get some space, truncate proportionally
      if (response.data && Array.isArray(response.data)) {
        const totalContentTokens = response.data.reduce(
          (sum: number, result: any) => sum + (result?.usage?.tokens ?? 0),
          0,
        );
        // If total exceeds limit, truncate each result proportionally
        if (totalContentTokens > MAX_TOOL_RESULT_TOKENS) {
          const MIN_TOKENS_PER_RESULT = 500; // Each result gets at least this much
          const resultCount = response.data.length;
          const reservedTokens = MIN_TOKENS_PER_RESULT * resultCount;

          // Check if we can give everyone the minimum
          if (reservedTokens > MAX_TOOL_RESULT_TOKENS) {
            // Give everyone equal share
            const tokensPerResult = Math.floor(MAX_TOOL_RESULT_TOKENS / resultCount);

            for (let i = 0; i < response.data.length; i++) {
              const result = response.data[i];
              const originalTokens = result?.usage?.tokens ?? 0;

              if (result?.content && originalTokens > tokensPerResult) {
                result.content = truncateContent(result.content, tokensPerResult);
                const newTokens = countToken(result.content);
                if (result.usage) result.usage.tokens = newTokens;
              }
            }
          } else {
            // Distribute remaining budget proportionally
            const remainingBudget = MAX_TOOL_RESULT_TOKENS - reservedTokens;

            for (let i = 0; i < response.data.length; i++) {
              const result = response.data[i];
              const originalTokens = result?.usage?.tokens ?? 0;

              // Each result gets: minimum + proportional share of remaining budget
              const proportionalShare = Math.floor(
                (originalTokens / totalContentTokens) * remainingBudget,
              );
              const targetTokens = MIN_TOKENS_PER_RESULT + proportionalShare;

              if (result?.content && originalTokens > targetTokens) {
                result.content = truncateContent(result.content, targetTokens);
                const newTokens = countToken(result.content);
                if (result.usage) result.usage.tokens = newTokens;
              }
            }
          }
        }
      }

      // Calculate total tokens from all search results and determine credit cost
      // Each search result has usage.tokens, sum them all up
      const totalTokens =
        response.data?.reduce((sum: number, result: any) => {
          return sum + (result?.usage?.tokens ?? 0);
        }, 0) ?? 0;

      // Calculate credit cost based on tokens used: 7 credits per million tokens, minimum 1 credit
      const creditCost = Math.max(1, Math.ceil((totalTokens / 1000000) * 7));

      return {
        status: 'success',
        data: response.data,
        summary: `Successfully searched the web for ${input.query}`,
        creditCost,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error searching the web',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while searching the web',
      };
    }
  }
}
export class JinaToolset extends AgentBaseToolset<JinaToolParams> {
  toolsetKey = JinaToolsetDefinition.key;
  tools = [JinaRead, JinaSerp] satisfies readonly AgentToolConstructor<JinaToolParams>[];
}
