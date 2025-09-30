import { z } from 'zod';
import { ToolParams } from '@langchain/core/tools';
import { PerplexityClient, ChatCompletionMessage } from './client';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';

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
        en: 'Generate responses using Perplexity AI models with real-time web search capabilities. Supports various models including sonar, sonar-pro, reasoning models, and sonar-deep-research for exhaustive research across hundreds of sources with expert-level insights and detailed report generation.',
        'zh-CN':
          '使用 Perplexity AI 模型生成响应，具有实时网络搜索功能。支持各种模型，包括 sonar、sonar-pro、推理模型和 sonar-deep-research，可进行数百个来源的全面研究，提供专家级洞察和详细报告生成。',
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

  schema = z.object({
    model: z
      .enum(['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'])
      .describe('The model to use for generating responses')
      .default('sonar'),
    messages: z
      .array(
        z.object({
          role: z.enum(['system', 'user', 'assistant']).describe('The role of the message sender'),
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
  });

  description =
    'Generate responses using Perplexity AI models with real-time web search capabilities. Supports various models including sonar, sonar-pro, reasoning models, and sonar-deep-research for exhaustive research across hundreds of sources with expert-level insights and detailed report generation.';

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

      const response = await client.chatCompletions({
        model: input.model,
        messages: input.messages as ChatCompletionMessage[],
        max_tokens: input.max_tokens,
        temperature: input.temperature,
        top_p: input.top_p,
        top_k: input.top_k,
        presence_penalty: input.presence_penalty,
        frequency_penalty: input.frequency_penalty,
        repetition_penalty: input.repetition_penalty,
      });

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

      if (response.usage?.cost?.total_cost) {
        summaryParts.push(`(cost: $${response.usage.cost.total_cost.toFixed(4)})`);
      }

      return {
        status: 'success',
        data: result,
        summary: summaryParts.join(' '),
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating chat completion',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while generating chat completion',
      };
    }
  }
}

export class PerplexityToolset extends AgentBaseToolset<PerplexityToolParams> {
  toolsetKey = PerplexityToolsetDefinition.key;
  tools = [
    PerplexityChatCompletions,
  ] satisfies readonly AgentToolConstructor<PerplexityToolParams>[];
}
