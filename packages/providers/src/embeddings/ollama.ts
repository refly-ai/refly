import { Embeddings } from '@langchain/core/embeddings';

export interface OllamaEmbeddingsConfig {
  model: string;
  batchSize?: number;
  maxRetries?: number;
  dimensions?: number;
  baseUrl: string;
  apiKey?: string;
}

export class OllamaEmbeddings extends Embeddings {
  private config: OllamaEmbeddingsConfig;

  constructor(config: OllamaEmbeddingsConfig) {
    super(config);
    this.config = {
      ...config,
      baseUrl: config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`,
      batchSize: config.batchSize || 16,
      maxRetries: config.maxRetries || 3,
    };
  }

  private async fetch(input: string[]) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const results = [];

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < input.length; i += this.config.batchSize) {
      const batch = input.slice(i, i + this.config.batchSize);
      const embeddings = await Promise.all(
        batch.map(async (text) => {
          const response = await fetch(`${this.config.baseUrl}embeddings`, {
            method: 'post',
            headers,
            body: JSON.stringify({
              model: this.config.model,
              prompt: text,
            }),
          });

          if (!response.ok) {
            throw new Error(
              `Ollama embeddings API call failed: ${response.status} ${response.statusText}`,
            );
          }

          const data = await response.json();
          return data.embedding;
        }),
      );

      results.push(...embeddings);
    }

    return results;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return await this.fetch(documents);
  }

  async embedQuery(query: string): Promise<number[]> {
    const embeddings = await this.fetch([query]);
    if (embeddings.length === 0) {
      throw new Error('No embedding returned from Ollama API');
    }
    return embeddings[0];
  }
}
