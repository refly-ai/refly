import { EmbeddingModelConfig } from '@refly/openapi-schema';
import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { FireworksEmbeddings } from '@langchain/community/embeddings/fireworks';
import { JinaEmbeddings } from './jina';
import { BaseProvider } from '../types';

export interface EmbeddingConfig extends EmbeddingModelConfig {
  dimensions: number;
}

export const getEmbeddings = (provider: BaseProvider, config: EmbeddingConfig): Embeddings => {
  switch (provider.providerKey) {
    case 'fireworks':
      return new FireworksEmbeddings({
        model: config.modelId,
        batchSize: config.batchSize,
        maxRetries: 3,
        apiKey: provider.apiKey,
      });
    case 'openai':
      return new OpenAIEmbeddings({
        model: config.modelId,
        batchSize: config.batchSize,
        dimensions: config.dimensions,
        apiKey: provider.apiKey,
      });
    case 'jina':
      return new JinaEmbeddings({
        model: config.modelId,
        batchSize: config.batchSize,
        dimensions: config.dimensions,
        apiKey: provider.apiKey,
        maxRetries: 3,
      });
    default:
      throw new Error(`Unsupported embeddings provider: ${provider.providerKey}`);
  }
};

export { Embeddings };
