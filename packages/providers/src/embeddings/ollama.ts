import { Embeddings } from '@langchain/core/embeddings';
import { OllamaEmbeddings as LangChainOllamaEmbeddings } from '@langchain/ollama';

export interface OllamaEmbeddingsConfig {
  model: string;
  batchSize?: number;
  maxRetries?: number;
  dimensions?: number;
  baseUrl: string;
  apiKey?: string;
}

export class OllamaEmbeddings extends Embeddings {
  private client: LangChainOllamaEmbeddings;

  constructor(config: OllamaEmbeddingsConfig) {
    super(config);

    // Validate required configuration
    if (!config.model) {
      throw new Error('Ollama embeddings model must be specified');
    }

    if (!config.baseUrl) {
      throw new Error('Ollama baseUrl must be specified');
    }

    try {
      // Create the LangChain OllamaEmbeddings client
      this.client = new LangChainOllamaEmbeddings({
        model: config.model,
        baseUrl: config.baseUrl,
        requestOptions: {
          useMmap: true,
          numThread: 6,
        },
      });
    } catch (error) {
      throw new Error(`Failed to initialize Ollama embeddings client: ${error.message}`);
    }
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    if (!documents || documents.length === 0) {
      return [];
    }

    try {
      return await this.client.embedDocuments(documents);
    } catch (error) {
      console.error(`Ollama embeddings error: ${error.message}`);
      throw new Error(`Failed to generate embeddings for documents: ${error.message}`);
    }
  }

  async embedQuery(query: string): Promise<number[]> {
    if (!query || query.trim() === '') {
      throw new Error('Query text cannot be empty');
    }

    try {
      return await this.client.embedQuery(query);
    } catch (error) {
      console.error(`Ollama query embedding error: ${error.message}`);
      throw new Error(`Failed to generate embedding for query: ${error.message}`);
    }
  }
}
