import { CommunityProviderResponse } from '../components/settings/model-providers/provider-store-types';

// Mock data for community providers - matching real Provider structure
export const mockCommunityProviders: CommunityProviderResponse = {
  providers: [
    {
      providerId: 'openai-gpt',
      name: 'OpenAI',
      providerKey: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      description: {
        en: 'Industry-leading language models including GPT-4, GPT-3.5, and more.',
        'zh-CN': '业界领先的语言模型，包括 GPT-4、GPT-3.5 等。',
      },
      categories: ['llm', 'embedding'],
    },
    {
      providerId: 'anthropic-claude',
      name: 'Anthropic',
      providerKey: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      description: {
        en: 'Advanced AI assistant built by Anthropic. Claude excels at analysis, writing, math, coding, and creative tasks.',
        'zh-CN':
          'Anthropic 开发的先进 AI 助手。Claude 在分析、写作、数学、编程和创意任务方面表现出色。',
      },
      categories: ['llm'],
    },
    {
      providerId: 'google-gemini',
      name: 'Google',
      providerKey: 'google',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      description: {
        en: "Google's most capable AI model with multimodal capabilities.",
        'zh-CN': 'Google 最强大的 AI 模型，具有多模态能力。',
      },
      categories: ['llm'],
    },
    {
      providerId: 'azure-openai',
      name: 'Azure OpenAI',
      providerKey: 'azure-openai',
      baseUrl: 'https://your-resource.openai.azure.com',
      description: {
        en: 'OpenAI models hosted on Microsoft Azure with enterprise-grade security.',
        'zh-CN': '托管在 Microsoft Azure 上的 OpenAI 模型，具有企业级安全性。',
      },
      categories: ['llm', 'embedding'],
    },
    {
      providerId: 'cohere',
      name: 'Cohere',
      providerKey: 'cohere',
      baseUrl: 'https://api.cohere.ai/v1',
      description: {
        en: 'Enterprise-focused language models with strong multilingual capabilities.',
        'zh-CN': '专注于企业的语言模型，具有强大的多语言能力。',
      },
      categories: ['llm', 'embedding', 'reranker'],
    },
    {
      providerId: 'ollama',
      name: 'Ollama',
      providerKey: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      description: {
        en: 'Run large language models locally on your machine.',
        'zh-CN': '在您的机器上本地运行大型语言模型。',
      },
      categories: ['llm', 'embedding'],
    },
    {
      providerId: 'jina',
      name: 'Jina',
      providerKey: 'jina',
      baseUrl: 'https://api.jina.ai/v1',
      description: {
        en: 'Multimodal AI for search, recommendation, and generative tasks.',
        'zh-CN': '用于搜索、推荐和生成任务的多模态 AI。',
      },
      categories: ['embedding', 'reranker'],
    },
    {
      providerId: 'fireworks',
      name: 'Fireworks',
      providerKey: 'fireworks',
      baseUrl: 'https://api.fireworks.ai/inference/v1',
      description: {
        en: 'Fast inference for open source LLMs and custom models.',
        'zh-CN': '为开源 LLM 和定制模型提供快速推理。',
      },
      categories: ['llm', 'embedding'],
    },
    {
      providerId: 'moonshot',
      name: 'Moonshot AI',
      providerKey: 'moonshot',
      baseUrl: 'https://api.moonshot.cn/v1',
      description: {
        en: 'Chinese AI company offering advanced language models.',
        'zh-CN': '中国 AI 公司，提供先进的语言模型。',
      },
      categories: ['llm'],
    },
    {
      providerId: 'deepseek',
      name: 'DeepSeek',
      providerKey: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      description: {
        en: 'Advanced reasoning models with strong coding capabilities.',
        'zh-CN': '具有强大编程能力的先进推理模型。',
      },
      categories: ['llm'],
    },
  ],
  meta: {
    total: 10,
    lastUpdated: '2024-01-15T00:00:00.000Z',
  },
};
