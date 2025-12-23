import { z } from 'zod/v3';
import { ToolParams } from '@langchain/core/tools';
import { PerplexityClient, ChatCompletionMessage } from './client';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';

const hasValidMessageSequence = (messages: Array<{ role?: string }>): boolean => {
  if (!messages.length) return false;
  if (messages.some((message) => !message.role)) return false;

  let index = 0;
  while (index < messages.length && messages[index].role === 'system') {
    index += 1;
  }

  if (index >= messages.length) {
    return false;
  }

  let expectedRole: 'user' | 'assistant' = 'user';
  for (let i = index; i < messages.length; i += 1) {
    if (messages[i].role !== expectedRole) {
      return false;
    }
    expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
  }

  return messages[messages.length - 1].role === 'user';
};

export const PerplexityToolsetDefinition: ToolsetDefinition = {
  key: 'perplexity',
  domain: 'https://perplexity.ai',
  labelDict: {
    en: 'Perplexity',
    'zh-CN': 'Perplexity',
  },
  descriptionDict: {
    en: 'Perplexity is an AI-powered search engine that provides comprehensive answers to questions by searching the web and synthesizing information from multiple sources. It combines real-time web search with advanced reasoning capabilities, including the powerful sonar-deep-research model for exhaustive research across hundreds of sources with expert-level insights and detailed report generation.',
    'zh-CN':
      'Perplexity 是一个由 AI 驱动的搜索引擎，通过搜索网络并综合多个来源的信息来提供全面的答案。它将实时网络搜索与高级推理能力相结合，包括强大的 sonar-deep-research 模型，可进行数百个来源的全面研究，提供专家级洞察和详细报告生成。',
  },
  tools: [
    {
      name: 'chat_completions',
      descriptionDict: {
        en: 'Generate responses using Perplexity AI models with real-time web search capabilities. Supports various models including sonar, sonar-pro, reasoning models, and sonar-deep-research for exhaustive research across hundreds of sources with expert-level insights and detailed report generation. Now supports web search options and structured JSON output.',
        'zh-CN':
          '使用 Perplexity AI 模型生成响应，具有实时网络搜索功能。支持各种模型，包括 sonar、sonar-pro、推理模型和 sonar-deep-research，可进行数百个来源的全面研究，提供专家级洞察和详细报告生成。现在支持网页搜索选项和结构化 JSON 输出。',
      },
    },
    {
      name: 'search',
      descriptionDict: {
        en: 'Perform simple web search queries using Perplexity AI. Returns search results for multiple queries in a structured format.',
        'zh-CN': '使用 Perplexity AI 执行简单的网页搜索查询。以结构化格式返回多个查询的搜索结果。',
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
            en: 'The API key for Perplexity',
            'zh-CN': 'Perplexity 的 API 密钥',
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
        en: 'The base URL of Perplexity service',
        'zh-CN': 'Perplexity 服务的 URL',
      },
      defaultValue: 'https://api.perplexity.ai',
    },
  ],
};

interface PerplexityToolParams extends ToolParams {
  apiKey: string;
  baseUrl?: string;
}

export class PerplexityChatCompletions extends AgentBaseTool<PerplexityToolParams> {
  name = 'chat_completions';
  toolsetKey = PerplexityToolsetDefinition.key;

  schema = z
    .object({
      model: z
        .enum([
          'sonar',
          'sonar-pro',
          'sonar-reasoning',
          'sonar-reasoning-pro',
          'sonar-deep-research',
        ])
        .describe('The model to use for generating responses')
        .default('sonar'),
      messages: z
        .array(
          z.object({
            role: z
              .enum(['system', 'user', 'assistant'])
              .describe('The role of the message sender'),
            content: z.string().describe('The content of the message'),
          }),
        )
        .describe('A list of messages comprising the conversation so far'),
      max_tokens: z
        .number()
        .describe('The maximum number of tokens that the model can process in a single response')
        .optional(),
      temperature: z
        .number()
        .describe('Controls randomness in the response generation (0.0 to 2.0)')
        .min(0)
        .max(2)
        .optional(),
      top_p: z
        .number()
        .describe('Controls diversity via nucleus sampling (0.0 to 1.0)')
        .min(0)
        .max(1)
        .optional(),
      top_k: z
        .number()
        .describe('Controls the number of top tokens to consider for sampling')
        .optional(),
      presence_penalty: z
        .number()
        .describe('Penalizes new tokens based on whether they appear in the text so far')
        .min(-2)
        .max(2)
        .optional(),
      frequency_penalty: z
        .number()
        .describe('Penalizes new tokens based on their existing frequency in the text')
        .min(-2)
        .max(2)
        .optional(),
      repetition_penalty: z
        .number()
        .describe('Penalizes repetition of tokens in the response')
        .min(0)
        .max(2)
        .optional(),
      web_search_options: z
        .object({
          search_domain_filter: z
            .array(z.string())
            .describe('Filter search results to specific domains')
            .optional(),
          search_recency_filter: z
            .enum(['hour', 'day', 'week', 'month', 'year'])
            .describe('Filter search results by recency')
            .optional(),
        })
        .describe('Options for web search functionality')
        .optional(),
      response_format: z
        .object({
          type: z.string().describe('The format of the response'),
          json_schema: z
            .object({
              schema: z.object({}).passthrough().describe('JSON schema for structured output'),
            })
            .describe('Schema definition for JSON structured output')
            .optional(),
          regex: z
            .object({
              regex: z.string().describe('Regex pattern for structured output'),
            })
            .describe('Regex configuration for structured output')
            .optional(),
        })
        .describe('Format specification for the response')
        .optional()
        .superRefine((data, ctx) => {
          if (!data) return;
          const allowedTypes = ['text', 'json_schema', 'regex'];
          if (!allowedTypes.includes(data.type)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `type must be one of ${allowedTypes.join(', ')}`,
              path: ['type'],
            });
          }
          if (data.type === 'json_schema' && !data.json_schema) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'json_schema is required when type is json_schema.',
              path: ['json_schema'],
            });
          }
          if (data.type === 'regex' && !data.regex) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'regex is required when type is regex.',
              path: ['regex'],
            });
          }
          if (data.type !== 'json_schema' && data.json_schema) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'json_schema is only allowed when type is json_schema.',
              path: ['json_schema'],
            });
          }
          if (data.type !== 'regex' && data.regex) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'regex is only allowed when type is regex.',
              path: ['regex'],
            });
          }
        }),
    })
    .refine(
      (data) => !(data.presence_penalty !== undefined && data.frequency_penalty !== undefined),
      {
        message: 'Cannot set both presence_penalty and frequency_penalty. Choose one or neither.',
        path: ['presence_penalty', 'frequency_penalty'],
      },
    )
    .superRefine((data, ctx) => {
      if (!hasValidMessageSequence(data.messages)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Messages must start with optional system message(s), then alternate user and assistant, and end with a user message.',
          path: ['messages'],
        });
      }
    });

  description =
    'Generate responses using Perplexity AI models with real-time web search capabilities. Supports various models including sonar, sonar-pro, reasoning models, and sonar-deep-research for exhaustive research across hundreds of sources with expert-level insights and detailed report generation. Note: presence_penalty and frequency_penalty cannot be set simultaneously - choose one or neither.';

  protected params: PerplexityToolParams;

  constructor(params: PerplexityToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new PerplexityClient({
        apiKey: this.params.apiKey,
        baseUrl: this.params.baseUrl,
      });

      const request: any = {
        model: input.model,
        messages: input.messages as ChatCompletionMessage[],
        max_tokens: input.max_tokens,
        temperature: input.temperature,
        top_p: input.top_p,
        top_k: input.top_k,
        presence_penalty: input.presence_penalty,
        frequency_penalty: input.frequency_penalty,
        repetition_penalty: input.repetition_penalty,
      };

      if (input.web_search_options) {
        request.web_search_options = input.web_search_options;
      }

      if (input.response_format) {
        request.response_format = input.response_format;
      }

      const response = await client.chatCompletions(request);

      // Extract the response content from the first choice
      const content = response.choices?.[0]?.message?.content ?? '';

      const result: any = {
        response: content,
        fullResponse: response,
        model: response.model,
        usage: response.usage,
      };

      // Add deep research specific data if available
      if (response.citations?.length) {
        result.citations = response.citations;
      }
      if (response.search_results?.length) {
        result.searchResults = response.search_results;
      }

      const summaryParts = [`Successfully generated response using ${input.model} model`];

      if (response.usage?.total_tokens) {
        summaryParts.push(`with ${response.usage.total_tokens} tokens used`);
      }

      if (input.model === 'sonar-deep-research' && response.usage?.num_search_queries) {
        summaryParts.push(`(${response.usage.num_search_queries} search queries performed)`);
      }

      // Calculate credit cost based on total_cost * 140, minimum 1, round up decimals
      const creditCost = response.usage?.cost?.total_cost
        ? Math.ceil(Math.max(response.usage.cost.total_cost * 140, 1))
        : 1;

      return {
        status: 'success',
        data: result,
        summary: summaryParts.join(' '),
        creditCost,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred while generating chat completion';
      return {
        status: 'error',
        error: message,
        summary: message,
      };
    }
  }
}

export class PerplexitySearch extends AgentBaseTool<PerplexityToolParams> {
  name = 'search';
  toolsetKey = PerplexityToolsetDefinition.key;
  private static readonly maxQueriesPerBatch = 5;
  private static readonly maxTotalQueries = 50;

  schema = z.object({
    query: z
      .array(z.string())
      .describe(
        `An array of search queries to perform (max ${PerplexitySearch.maxTotalQueries}, batched by ${PerplexitySearch.maxQueriesPerBatch})`,
      )
      .min(1)
      .max(PerplexitySearch.maxTotalQueries),
  });

  description =
    'Perform simple web search queries using Perplexity AI. Returns search results for multiple queries in a structured format.';

  protected params: PerplexityToolParams;

  constructor(params: PerplexityToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new PerplexityClient({
        apiKey: this.params.apiKey,
        baseUrl: this.params.baseUrl,
      });

      const searchResults = [];
      for (let i = 0; i < input.query.length; i += PerplexitySearch.maxQueriesPerBatch) {
        const batch = input.query.slice(i, i + PerplexitySearch.maxQueriesPerBatch);
        const response = await client.search({
          query: batch,
        });
        if (response.results?.length) {
          searchResults.push(...response.results);
        }
      }

      const totalResults =
        searchResults.reduce((sum, result) => sum + (result.results?.length ?? 0), 0) ?? 0;
      const totalQueries = input.query.length;
      const totalBatches = Math.ceil(totalQueries / PerplexitySearch.maxQueriesPerBatch);

      return {
        status: 'success',
        data: {
          searchResults,
          totalQueries,
          totalResults,
        },
        summary: `Successfully performed ${totalQueries} search queries in ${totalBatches} batches and found ${totalResults} results`,
        creditCost: totalBatches,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred while performing search';
      return {
        status: 'error',
        error: message,
        summary: message,
      };
    }
  }
}

export class PerplexityToolset extends AgentBaseToolset<PerplexityToolParams> {
  toolsetKey = PerplexityToolsetDefinition.key;
  tools = [
    PerplexityChatCompletions,
    PerplexitySearch,
  ] satisfies readonly AgentToolConstructor<PerplexityToolParams>[];
}
