import { RerankerModelConfig } from '@refly/openapi-schema';
import { BaseReranker } from './base';
import { JinaReranker } from './jina';
import { OllamaReranker } from './ollama';
import { BaseProvider } from '../types';

export const getReranker = (provider: BaseProvider, config: RerankerModelConfig): BaseReranker => {
  switch (provider.providerKey) {
    case 'jina':
      return new JinaReranker({
        ...config,
        apiKey: provider.apiKey,
      });
    case 'ollama':
      return new OllamaReranker({
        ...config,
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
      });
    default:
      throw new Error(`Unsupported reranker provider: ${provider.providerKey}`);
  }
};

export * from './base';
export * from './fallback';
export * from './jina';
export * from './ollama';
