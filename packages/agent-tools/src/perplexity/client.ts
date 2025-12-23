// Perplexity API Client
// Based on Perplexity API documentation

export interface PerplexityConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: 'sonar' | 'sonar-pro' | 'sonar-reasoning' | 'sonar-reasoning-pro' | 'sonar-deep-research';
  messages: ChatCompletionMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  repetition_penalty?: number;
  web_search_options?: {
    search_domain_filter?: string[];
    search_recency_filter?: 'hour' | 'day' | 'week' | 'month' | 'year';
  };
  response_format?: {
    type: 'text' | 'json_schema' | 'regex';
    json_schema?: {
      schema: Record<string, any>;
    };
    regex?: {
      regex: string;
    };
  };
}

export interface SearchResult {
  title?: string;
  url?: string;
  date?: string | null;
  last_updated?: string | null;
  snippet?: string;
}

export interface SearchRequest {
  query: string[];
}

export interface SearchResponse {
  results: Array<{
    query: string;
    results: SearchResult[];
  }>;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  citation_tokens?: number;
  num_search_queries?: number;
  reasoning_tokens?: number;
  cost?: {
    input_tokens_cost?: number;
    output_tokens_cost?: number;
    citation_tokens_cost?: number;
    reasoning_tokens_cost?: number;
    search_queries_cost?: number;
    total_cost?: number;
  };
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  created: number;
  usage: ChatCompletionUsage;
  object: string;
  choices: Array<{
    index: number;
    finish_reason: string | null;
    message: {
      role: string;
      content: string;
    };
    delta?: {
      role?: string;
      content?: string;
    };
  }>;
  citations?: string[];
  search_results?: SearchResult[];
}

export class PerplexityError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any,
  ) {
    super(message);
    this.name = 'PerplexityError';
  }
}

export class PerplexityClient {
  private config: Required<PerplexityConfig>;

  constructor(config: PerplexityConfig) {
    this.config = {
      baseUrl: config.baseUrl || 'https://api.perplexity.ai',
      apiKey: config.apiKey,
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parsing errors
      }

      throw new PerplexityError(
        errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData,
      );
    }

    return response.json();
  }

  async chatCompletions(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return this.request<ChatCompletionResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    return this.request<SearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

// Export default instance creator
export const createPerplexityClient = (config: PerplexityConfig): PerplexityClient => {
  return new PerplexityClient(config);
};
