// 模拟@refly/openapi-schema中的ProviderCategory类型
type ProviderCategory =
  | 'llm'
  | 'embedding'
  | 'reranker'
  | 'urlParsing'
  | 'webSearch'
  | 'pdfParsing'
  | 'mediaGeneration';

export type ProviderField = 'apiKey' | 'baseUrl';

export interface ProviderFieldConfig {
  presence: 'required' | 'optional' | 'omit';
  defaultValue?: string;
}

export interface ProviderInfo {
  key: string;
  name: string;
  categories: ProviderCategory[];
  fieldConfig: Record<ProviderField, ProviderFieldConfig>;
}

export const providerInfoList: ProviderInfo[] = [
  {
    key: 'openai',
    name: 'OpenAI',
    categories: ['llm', 'embedding'],
    fieldConfig: {
      apiKey: { presence: 'required' },
      baseUrl: {
        presence: 'optional',
        defaultValue: 'https://api.openai.com/v1',
      },
    },
  },
  {
    key: 'ollama',
    name: 'Ollama',
    categories: ['llm', 'embedding', 'reranker'],
    fieldConfig: {
      apiKey: { presence: 'optional' },
      baseUrl: {
        presence: 'required',
        defaultValue: 'http://localhost:11434/v1',
      },
    },
  },
  {
    key: 'jina',
    name: 'Jina',
    categories: ['embedding', 'reranker', 'urlParsing'],
    fieldConfig: {
      apiKey: { presence: 'required' },
      baseUrl: { presence: 'omit' },
    },
  },
  {
    key: 'fireworks',
    name: 'Fireworks',
    categories: ['llm', 'embedding'],
    fieldConfig: {
      apiKey: { presence: 'required' },
      baseUrl: { presence: 'omit' },
    },
  },
  {
    key: 'searxng',
    name: 'SearXNG',
    categories: ['webSearch'],
    fieldConfig: {
      apiKey: { presence: 'omit' },
      baseUrl: { presence: 'required' },
    },
  },
  {
    key: 'serper',
    name: 'Serper',
    categories: ['webSearch'],
    fieldConfig: {
      apiKey: { presence: 'required' },
      baseUrl: { presence: 'omit' },
    },
  },
  {
    key: 'marker',
    name: 'Marker',
    categories: ['pdfParsing'],
    fieldConfig: {
      apiKey: { presence: 'required' },
      baseUrl: {
        presence: 'optional',
        defaultValue: 'https://www.datalab.to/api/v1/marker',
      },
    },
  },
  {
    key: 'mineru',
    name: 'MinerU',
    categories: ['pdfParsing'],
    fieldConfig: {
      apiKey: { presence: 'required' },
      baseUrl: {
        presence: 'optional',
        defaultValue: 'https://mineru.net/api/v4',
      },
    },
  },
  {
    key: 'replicate',
    name: 'Replicate',
    categories: ['llm', 'embedding', 'mediaGeneration'],
    fieldConfig: {
      apiKey: { presence: 'required' },
      baseUrl: {
        presence: 'optional',
        defaultValue: 'https://api.replicate.com/v1',
      },
    },
  },
  {
    key: 'fal',
    name: 'FAL',
    categories: ['mediaGeneration'],
    fieldConfig: {
      apiKey: { presence: 'required' },
      baseUrl: {
        presence: 'optional',
        defaultValue: 'https://fal.run/fal-ai',
      },
    },
  },
  {
    key: 'volces',
    name: 'Volces',
    categories: ['mediaGeneration'],
    fieldConfig: {
      apiKey: { presence: 'required' },
      baseUrl: {
        presence: 'optional',
        defaultValue: 'https://ark.cn-beijing.volces.com/api/v3',
      },
    },
  },
];
