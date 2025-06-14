import { Embeddings } from '@langchain/core/embeddings';

export interface JinaEmbeddingsConfig {
  model: string;
  batchSize: number;
  maxRetries: number;
  dimensions: number;
  apiKey: string;
}

/**
 * Split text into chunks by sentence boundaries while respecting maximum length
 * @param text The text to split
 * @param maxLength Maximum length for each chunk
 * @returns Array of text chunks with preserved sentence boundaries
 */
const splitTextIntoChunks = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];

  // Split by sentence boundaries (periods, exclamation marks, question marks)
  // Also handle Chinese punctuation
  const sentences = text.split(/(?<=[.!?。！？])\s+/);

  let currentChunk = '';

  for (const sentence of sentences) {
    // If adding this sentence would exceed the limit
    if (currentChunk.length + sentence.length > maxLength) {
      if (currentChunk.length > 0) {
        // Save current chunk and start a new one
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        // Single sentence is too long, fall back to character splitting
        const subChunks = splitByCharacterLength(sentence, maxLength);
        chunks.push(...subChunks);
        currentChunk = '';
      }
    } else {
      // Add sentence to current chunk
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((chunk) => chunk.length > 0);
};

/**
 * Fallback function to split text by character length when sentence splitting fails
 * @param text The text to split
 * @param maxLength Maximum length for each chunk
 * @returns Array of text chunks
 */
const splitByCharacterLength = (text: string, maxLength: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
};

/**
 * Calculate the average of multiple embeddings
 * @param embeddings Array of embedding vectors
 * @returns Averaged embedding vector
 */
const calculateAverageEmbedding = (embeddings: number[][]): number[] => {
  if (embeddings.length === 0) {
    throw new Error('No embeddings to average');
  }

  const embeddingLength = embeddings[0].length;
  const averaged = new Array(embeddingLength).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < embeddingLength; i++) {
      averaged[i] += embedding[i] / embeddings.length;
    }
  }

  return averaged;
};

export class JinaEmbeddings extends Embeddings {
  private config: JinaEmbeddingsConfig;

  constructor(config: JinaEmbeddingsConfig) {
    super(config);
    this.config = config;
  }

  private async fetch(input: string[]) {
    const payload = {
      model: this.config.model,
      task: 'retrieval.passage',
      dimensions: this.config.dimensions,
      late_chunking: false,
      input,
    };

    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status !== 200) {
      throw new Error(
        `call embeddings failed: ${response.status} ${response.statusText} ${response.text}`,
      );
    }

    const data = await response.json();

    return data;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const maxLength = 2048;
    const results: number[][] = [];

    for (const document of documents) {
      if (document.length <= maxLength) {
        // Document is within limit, process directly
        const body = await this.fetch([document]);
        results.push(body.data[0].embedding);
      } else {
        // Document exceeds limit, split into chunks and process sequentially
        const chunks = splitTextIntoChunks(document, maxLength);
        const chunkEmbeddings: number[][] = [];

        for (const chunk of chunks) {
          const body = await this.fetch([chunk]);
          chunkEmbeddings.push(body.data[0].embedding);
        }

        // Average all chunk embeddings to represent the document
        const averagedEmbedding = calculateAverageEmbedding(chunkEmbeddings);
        results.push(averagedEmbedding);
      }
    }

    return results;
  }

  async embedQuery(query: string): Promise<number[]> {
    const maxLength = 2048;

    if (query.length <= maxLength) {
      // Query is within limit, process directly
      const body = await this.fetch([query]);
      if (body.data.length === 0) {
        throw new Error('No embedding returned');
      }
      return body.data[0].embedding;
    } else {
      // Query exceeds limit, split into chunks and process sequentially
      const chunks = splitTextIntoChunks(query, maxLength);
      const chunkEmbeddings: number[][] = [];

      for (const chunk of chunks) {
        const body = await this.fetch([chunk]);
        chunkEmbeddings.push(body.data[0].embedding);
      }

      // Average all chunk embeddings to represent the query
      return calculateAverageEmbedding(chunkEmbeddings);
    }
  }
}
