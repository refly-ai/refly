import {
  LLMModelConfig,
  MediaGenerationModelConfig,
  ModelCapabilities,
  ModelInfo,
  ProviderCategory,
  ProviderItem,
} from '@refly/openapi-schema';

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

export const providerItemToModelInfo = (item: ProviderItem): ModelInfo => {
  const category = item?.category;

  if (category === 'mediaGeneration') {
    const config = item?.config as MediaGenerationModelConfig;
    return {
      name: config?.modelId ?? '',
      label: item?.name ?? '',
      provider: item?.provider?.providerKey ?? '',
      providerItemId: item?.itemId ?? '',
      contextLimit: 0, // MediaGenerationModelConfig doesn't have contextLimit
      maxOutput: 0, // MediaGenerationModelConfig doesn't have maxOutput
      capabilities: config?.capabilities as ModelCapabilities, // Cast to ModelCapabilities for compatibility
      creditBilling: item?.creditBilling ?? null,
      group: item?.group ?? '',
      category: item?.category,
      inputParameters: config?.inputParameters ?? [],
      tooltip: config?.tooltip,
    };
  } else {
    const config = item?.config as LLMModelConfig;
    return {
      name: config?.modelId ?? '',
      label: item?.name ?? '',
      provider: item?.provider?.providerKey ?? '',
      providerItemId: item?.itemId ?? '',
      contextLimit: config?.contextLimit ?? 0,
      maxOutput: config?.maxOutput ?? 0,
      capabilities: config?.capabilities ?? {},
      creditBilling: item?.creditBilling ?? null,
      group: item?.group ?? '',
      category: item?.category,
      inputParameters: [],
      tooltip: config?.tooltip,
    };
  }
};
