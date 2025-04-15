import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchResult } from '@refly-packages/openapi-schema';
import { RerankerInterface } from './reranker.interface';

// Define the expected response structure from Jina API
interface JinaRerankerResponse {
  results: {
    document: { text: string };
    relevance_score: number;
  }[];
}

@Injectable()
export class JinaReranker implements RerankerInterface {
  private readonly logger = new Logger(JinaReranker.name);
  private readonly jinaApiKey: string;
  private readonly defaultTopN: number;
  private readonly defaultRelevanceThreshold: number;
  private readonly defaultModel: string;

  constructor(private config: ConfigService) {
    // Retrieve Jina configuration from .env via ConfigService during instantiation
    this.jinaApiKey = this.config.getOrThrow<string>('credentials.jina');
    this.defaultTopN = this.config.get<number>('reranker.topN', 10); // Default from .env or 10
    this.defaultRelevanceThreshold = this.config.get<number>(
      'reranker.relevanceThreshold',
      0.5, // Default from .env or 0.5
    );
    this.defaultModel = this.config.get<string>(
      'reranker.model',
      'jina-reranker-v2-base-multilingual', // Default from .env or specific model
    );
  }

  async rerank(
    query: string,
    results: SearchResult[],
    options?: { topN?: number; relevanceThreshold?: number },
  ): Promise<SearchResult[]> {
    // Use provided options or fall back to defaults loaded from config
    const topN = options?.topN ?? this.defaultTopN;
    const relevanceThreshold =
      options?.relevanceThreshold ?? this.defaultRelevanceThreshold;

    // Avoid reranking if no results or API key is missing
    if (!results || results.length === 0) {
      return [];
    }
     if (!this.jinaApiKey) {
        this.logger.error('Jina API key is missing. Cannot perform reranking.');
        // Return original results as fallback when API key is missing
        return results.map((result, index) => ({
            ...result,
            relevanceScore: 1 - index * 0.1, // Apply fallback score
        }));
    }


    // Map results to document texts for the API call
    const contentMap = new Map<string, SearchResult>();
    const documentsToRerank: string[] = [];
    for (const r of results) {
      // Ensure snippets exist and have text
       const docText = r.snippets?.map((s) => s.text).join('\n\n') || '';
       if(docText){ // Only add if there is text content
         contentMap.set(docText, r);
         documentsToRerank.push(docText);
       }
    }

     // If no valid documents to rerank, return empty array or original results? Let's return empty.
     if (documentsToRerank.length === 0) {
        this.logger.warn('No valid document content found in results to rerank.');
        return [];
     }

    // Prepare Jina API payload
    const payload = JSON.stringify({
      query,
      model: this.defaultModel, // Use the model loaded from config
      top_n: topN,
      documents: documentsToRerank,
    });

    this.logger.debug(`Calling Jina Reranker API with ${documentsToRerank.length} documents.`);

    try {
      const res = await fetch('https://api.jina.ai/v1/rerank', {
        method: 'post',
        headers: {
          Authorization: `Bearer ${this.jinaApiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: payload,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(
          `Jina Reranker API error: ${res.status} ${res.statusText} - ${errorBody}`,
        );
      }

      const data: JinaRerankerResponse = await res.json();
      this.logger.debug(`Jina reranker raw response: ${JSON.stringify(data)}`);

      // Process and map results
      return data.results
        .filter((r) => r.relevance_score >= relevanceThreshold)
        .map((r) => {
          const originalResult = contentMap.get(r.document.text);
          if (!originalResult) {
            this.logger.warn(`Could not find original result for reranked document text: ${r.document.text.substring(0, 100)}...`);
            return null; // Handle cases where mapping might fail unexpectedly
          }
          return {
            ...originalResult,
            relevanceScore: r.relevance_score, // Add relevance score
          };
        })
        .filter(r => r !== null) as SearchResult[]; // Filter out nulls and assert type

    } catch (e) {
      this.logger.error(`Jina Reranker failed: ${e.message}`, e.stack);
      // Fallback: return original results with simple scoring
      return results.map((result, index) => ({
        ...result,
        relevanceScore: 1 - index * 0.1,
      }));
    }
  }
}