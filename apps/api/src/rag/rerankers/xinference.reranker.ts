import { Injectable, Logger } from '@nestjs/common';
import { SearchResult } from '@refly-packages/openapi-schema';
import {
  RerankerInterface,
  RerankerConfig,
  XinferenceRerankerResponse, // Defined in reranker.interface.ts
} from './reranker.interface';

// Define a specific config interface for Xinference for clarity
interface XinferenceRerankerConfig extends RerankerConfig {
  type: 'xinference';
  baseUrl: string;
  modelName: string;
  apiKey?: string; // Optional API Key
  topN: number; // Required as per final plan
  relevanceThreshold: number; // Required as per final plan
}

@Injectable()
export class XinferenceReranker implements RerankerInterface {
  private readonly logger = new Logger(XinferenceReranker.name);
  private readonly config: XinferenceRerankerConfig;
  private readonly rerankUrl: string;

  constructor(config: XinferenceRerankerConfig) {
    // Validate required fields upon instantiation
    if (
      !config.baseUrl ||
      !config.modelName ||
      config.topN === undefined ||
      config.relevanceThreshold === undefined
    ) {
      throw new Error(
        'XinferenceReranker requires baseUrl, modelName, topN, and relevanceThreshold in config.',
      );
    }
    this.config = config;
    // Construct the full API URL once
    this.rerankUrl = `${this.config.baseUrl.replace(/\/$/, '')}/v1/rerank`; // Ensure no trailing slash before adding path
    this.logger.log(
      `Initialized XinferenceReranker with model: ${config.modelName}, url: ${this.rerankUrl}`,
    );
  }

  async rerank(
    query: string,
    results: SearchResult[],
    // Options passed here are ignored for Xinference as config comes solely from YAML
    options?: { topN?: number; relevanceThreshold?: number },
  ): Promise<SearchResult[]> {
    // Use config values directly
    const topN = this.config.topN; // Not directly used in Xinference API call itself, but could be if API supported it
    const relevanceThreshold = this.config.relevanceThreshold;

    if (!results || results.length === 0) {
      return [];
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

    // If no valid documents to rerank, return empty array
    if (documentsToRerank.length === 0) {
        this.logger.warn('No valid document content found in results to rerank.');
        return [];
    }


    // Prepare Xinference request payload
    const payload = JSON.stringify({
      model: this.config.modelName, // Use modelName from config
      query: query,
      documents: documentsToRerank,
      top_n: topN, // Pass topN to Xinference API if it supports it (check Xinference docs)
                  // If Xinference API doesn't use top_n in request, remove this line
                  // and apply topN filtering *after* receiving results.
    });

    this.logger.debug(`Calling Xinference Reranker API (${this.rerankUrl}) with ${documentsToRerank.length} documents.`);

    try {
      // Call Xinference rerank API
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const res = await fetch(this.rerankUrl, {
        method: 'post',
        headers: headers,
        body: payload,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(
          `Xinference Reranker API error: ${res.status} ${res.statusText} - ${errorBody}`,
        );
      }

      // Xinference response format might differ from Jina, adapt accordingly
      const data: XinferenceRerankerResponse = await res.json();
      this.logger.debug(`Xinference reranker raw response: ${JSON.stringify(data)}`);

      // Process Xinference response
      return data.results
        .filter((r) => r.relevance_score >= relevanceThreshold) // Filter by threshold from config
        // .slice(0, topN) // Apply topN *after* filtering if not done by API
        .map((rerankResult, resultIndex) => { // Use the index from the reranked results array itself if needed for logging, but use rerankResult.index for lookup
           this.logger.debug(`Processing Xinference result item: ${JSON.stringify(rerankResult)}`);

           // Check if rerankResult.index is a valid number and within bounds
           if (typeof rerankResult.index !== 'number' || rerankResult.index < 0 || rerankResult.index >= documentsToRerank.length) {
               this.logger.error(`Received invalid index ${rerankResult.index} from Xinference for result at position ${resultIndex}. Skipping this result.`);
               return null; // Skip this invalid result
           }

           // Get the original document text using the index provided by Xinference
           const originalDocText = documentsToRerank[rerankResult.index];

           // Use the original document text to find the full SearchResult object
           const originalResult = contentMap.get(originalDocText);

           if (!originalResult) {
             // Log the original document text safely
             this.logger.warn(`Could not find original SearchResult in contentMap for reranked document index ${rerankResult.index} (text starts with): ${originalDocText ? originalDocText.substring(0,100) + '...' : '[empty text]'}`);
             return null;
           }
           return {
             ...originalResult,
             relevanceScore: rerankResult.relevance_score, // Add relevance score
           };
         })
        .filter(r => r !== null) as SearchResult[]; // Filter out nulls and assert type

    } catch (e) {
      this.logger.error(`Xinference Reranker failed: ${e.message}`, e.stack);
      // Fallback: return original results with simple scoring
      return results.map((result, index) => ({
        ...result,
        relevanceScore: 1 - index * 0.1,
      }));
    }
  }
}
