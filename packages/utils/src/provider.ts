import { ProviderCategory } from '@refly/openapi-schema';

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
];
