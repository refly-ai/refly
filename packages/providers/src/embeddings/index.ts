import { EmbeddingModelConfig } from '@refly/openapi-schema';
import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { FireworksEmbeddings } from '@langchain/community/embeddings/fireworks';
import { JinaEmbeddings } from './jina';
import { OllamaEmbeddings } from './ollama';
import { BaseProvider } from '../types';
import { wrapEmbeddingsWithMonitoring } from '../monitoring/langfuse-wrapper';

export const getEmbeddings = (
  provider: BaseProvider,
  config: EmbeddingModelConfig,
  context?: { userId?: string },
): Embeddings => {
  let embeddings: Embeddings;

  switch (provider.providerKey) {
    case 'fireworks':
      embeddings = new FireworksEmbeddings({
        model: config.modelId,
        batchSize: config.batchSize,
        maxRetries: 3,
        apiKey: provider.apiKey,
      });
      break;
    case 'openai':
      embeddings = new OpenAIEmbeddings({
        model: config.modelId,
        batchSize: config.batchSize,
        dimensions: config.dimensions,
        apiKey: provider.apiKey,
      });
      break;
    case 'jina':
      embeddings = new JinaEmbeddings({
        model: config.modelId,
        batchSize: config.batchSize,
        dimensions: config.dimensions,
        apiKey: provider.apiKey,
        maxRetries: 3,
      });
      break;
    case 'ollama':
      embeddings = new OllamaEmbeddings({
        model: config.modelId,
        batchSize: config.batchSize,
        dimensions: config.dimensions,
        baseUrl: provider.baseUrl || 'http://localhost:11434/v1',
        apiKey: provider.apiKey,
        maxRetries: 3,
      });
      break;
    default:
      throw new Error(`Unsupported embeddings provider: ${provider.providerKey}`);
  }

  // Automatically wrap with monitoring
  return wrapEmbeddingsWithMonitoring(embeddings, {
    userId: context?.userId,
    modelId: config.modelId,
    provider: provider.providerKey,
  });
};

export { Embeddings };
