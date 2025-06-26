import { SearchResult } from '@refly/openapi-schema';
import { BaseReranker } from './base';

interface OllamaCompletionResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama-specific implementation of the reranker
 * Uses the LLM directly for reranking via completion API
 */
export class OllamaReranker extends BaseReranker {
  /**
   * Rerank search results using Ollama LLM.
   *
   * @param query The user query
   * @param results The search results to rerank
   * @param options Additional options for reranking
   * @returns Reranked search results
   */
  async rerank(
    query: string,
    results: SearchResult[],
    options?: {
      topN?: number;
      relevanceThreshold?: number;
      modelId?: string;
    },
  ): Promise<SearchResult[]> {
    const topN = options?.topN || this.config.topN || 5;
    const relevanceThreshold = options?.relevanceThreshold || this.config.relevanceThreshold || 0.5;
    const model = options?.modelId || this.config.modelId;

    if (results.length === 0) {
      return [];
    }

    // Extract texts from search results
    const documents = results.map((result) =>
      result.snippets.map((snippet) => snippet.text).join('\n\n'),
    );

    // For each document, ask the LLM to rate its relevance to the query
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }

      // Prepare the base URL
      const baseUrl = (this.config.baseUrl || 'http://localhost:11434/api').replace(/\/+$/, '');
      const apiEndpoint = `${baseUrl}/generate`;

      // Rate each document in parallel
      const ratedResults = await Promise.all(
        documents.map(async (document, index) => {
          const systemPrompt = `You are an expert at determining the relevance of a document to a query. 
            Rate the relevance of the following document to the query on a scale from 0.0 to 1.0,
            where 0.0 is completely irrelevant and 1.0 is perfectly relevant.
            Return only the numeric score without any explanation.`;

          const userPrompt = `Query: ${query}\n\nDocument: ${document}\n\nRelevance score:`;

          const response = await fetch(apiEndpoint, {
            method: 'post',
            headers,
            body: JSON.stringify({
              model,
              prompt: userPrompt,
              system: systemPrompt,
              stream: false,
              format: 'json',
            }),
          });

          if (!response.ok) {
            throw new Error(`Ollama API returned ${response.status}: ${await response.text()}`);
          }

          const data: OllamaCompletionResponse = await response.json();

          // Extract the score from the response
          // Clean up the response to ensure we get a valid number
          const scoreMatch = data.response.trim().match(/([0-9]*\.?[0-9]+)/);
          const score = scoreMatch ? Number.parseFloat(scoreMatch[0]) : 0;

          // Ensure the score is within the valid range
          const normalizedScore = Math.max(0, Math.min(1, score));

          return {
            ...results[index],
            relevanceScore: normalizedScore,
          };
        }),
      );

      // Filter by relevance threshold and sort by score
      return ratedResults
        .filter((result) => (result.relevanceScore ?? 0) >= relevanceThreshold)
        .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
        .slice(0, topN);
    } catch (e) {
      console.error(`Ollama reranker failed, fallback to default: ${e.stack}`);
      // Use the fallback from the base class
      return this.defaultFallback(results);
    }
  }
}
