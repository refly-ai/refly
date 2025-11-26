// // Firecrawl API Client
// // Generated from OpenAPI schema v1

// export interface FirecrawlConfig {
//   apiKey: string;
//   baseUrl?: string;
// }

// export interface ScrapeOptions {
//   formats?: Array<
//     | 'markdown'
//     | 'html'
//     | 'rawHtml'
//     | 'links'
//     | 'screenshot'
//     | 'screenshot@fullPage'
//     | 'json'
//     | 'changeTracking'
//   >;
//   onlyMainContent?: boolean;
//   includeTags?: string[];
//   excludeTags?: string[];
//   maxAge?: number;
//   headers?: Record<string, string>;
//   waitFor?: number;
//   mobile?: boolean;
//   skipTlsVerification?: boolean;
//   timeout?: number;
//   parsePDF?: boolean;
//   jsonOptions?: {
//     schema?: Record<string, any>;
//     systemPrompt?: string;
//     prompt?: string;
//   };
//   actions?: Array<{
//     type:
//       | 'wait'
//       | 'screenshot'
//       | 'click'
//       | 'write'
//       | 'press'
//       | 'scroll'
//       | 'scrape'
//       | 'executeJavascript';
//     milliseconds?: number;
//     selector?: string;
//     fullPage?: boolean;
//     all?: boolean;
//     text?: string;
//     key?: string;
//     direction?: 'up' | 'down';
//     script?: string;
//   }>;
//   location?: {
//     country?: string;
//     languages?: string[];
//   };
//   removeBase64Images?: boolean;
//   blockAds?: boolean;
//   proxy?: 'basic' | 'stealth' | 'auto';
//   changeTrackingOptions?: {
//     modes?: Array<'git-diff' | 'json'>;
//     schema?: Record<string, any>;
//     prompt?: string;
//     tag?: string | null;
//   };
//   storeInCache?: boolean;
// }

// export interface ScrapeRequest {
//   url: string;
//   formats?: ScrapeOptions['formats'];
//   onlyMainContent?: boolean;
//   includeTags?: string[];
//   excludeTags?: string[];
//   maxAge?: number;
//   headers?: Record<string, string>;
//   waitFor?: number;
//   mobile?: boolean;
//   skipTlsVerification?: boolean;
//   timeout?: number;
//   parsePDF?: boolean;
//   jsonOptions?: ScrapeOptions['jsonOptions'];
//   actions?: ScrapeOptions['actions'];
//   location?: ScrapeOptions['location'];
//   removeBase64Images?: boolean;
//   blockAds?: boolean;
//   proxy?: ScrapeOptions['proxy'];
//   changeTrackingOptions?: ScrapeOptions['changeTrackingOptions'];
//   storeInCache?: boolean;
// }

// export interface ScrapeResponse {
//   success: boolean;
//   data: {
//     markdown?: string;
//     html?: string | null;
//     rawHtml?: string | null;
//     screenshot?: string | null;
//     links?: string[];
//     actions?: {
//       screenshots?: string[];
//       scrapes?: Array<{
//         url: string;
//         html: string;
//       }>;
//       javascriptReturns?: Array<{
//         type: string;
//         value: any;
//       }>;
//     } | null;
//     metadata: {
//       title?: string;
//       description?: string;
//       language?: string | null;
//       sourceURL?: string;
//       statusCode?: number;
//       error?: string | null;
//       [key: string]: any;
//     };
//     llm_extraction?: any;
//     warning?: string | null;
//     changeTracking?: {
//       previousScrapeAt?: string | null;
//       changeStatus?: 'new' | 'same' | 'changed' | 'removed';
//       visibility?: 'visible' | 'hidden';
//       diff?: string | null;
//       json?: any;
//     } | null;
//   };
// }

// export interface BatchScrapeRequest {
//   urls: string[];
//   webhook?: {
//     url: string;
//     headers?: Record<string, string>;
//     metadata?: Record<string, any>;
//     events?: Array<'completed' | 'page' | 'failed' | 'started'>;
//   };
//   ignoreInvalidURLs?: boolean;
//   formats?: ScrapeOptions['formats'];
//   onlyMainContent?: boolean;
//   includeTags?: string[];
//   excludeTags?: string[];
//   maxAge?: number;
//   headers?: Record<string, string>;
//   waitFor?: number;
//   mobile?: boolean;
//   skipTlsVerification?: boolean;
//   timeout?: number;
//   parsePDF?: boolean;
//   jsonOptions?: ScrapeOptions['jsonOptions'];
//   actions?: ScrapeOptions['actions'];
//   location?: ScrapeOptions['location'];
//   removeBase64Images?: boolean;
//   blockAds?: boolean;
//   proxy?: ScrapeOptions['proxy'];
//   changeTrackingOptions?: ScrapeOptions['changeTrackingOptions'];
//   storeInCache?: boolean;
// }

// export interface BatchScrapeResponse {
//   success: boolean;
//   id: string;
//   url: string;
//   invalidURLs?: string[];
// }

// export interface BatchScrapeStatusResponse {
//   status: 'scraping' | 'completed' | 'failed';
//   total: number;
//   completed: number;
//   creditsUsed: number;
//   expiresAt: string;
//   next?: string | null;
//   data: Array<{
//     markdown?: string;
//     html?: string | null;
//     rawHtml?: string | null;
//     links?: string[];
//     screenshot?: string | null;
//     metadata: {
//       title?: string;
//       description?: string;
//       language?: string | null;
//       sourceURL?: string;
//       statusCode?: number;
//       error?: string | null;
//       [key: string]: any;
//     };
//   }>;
// }

// export interface CrawlRequest {
//   url: string;
//   excludePaths?: string[];
//   includePaths?: string[];
//   maxDepth?: number;
//   maxDiscoveryDepth?: number;
//   ignoreSitemap?: boolean;
//   ignoreQueryParameters?: boolean;
//   limit?: number;
//   allowBackwardLinks?: boolean;
//   allowExternalLinks?: boolean;
//   delay?: number;
//   webhook?: {
//     url: string;
//     headers?: Record<string, string>;
//     metadata?: Record<string, any>;
//     events?: Array<'completed' | 'page' | 'failed' | 'started'>;
//   };
//   scrapeOptions?: ScrapeOptions;
// }

// export interface CrawlResponse {
//   success: boolean;
//   id: string;
//   url: string;
// }

// export interface CrawlStatusResponse {
//   status: 'scraping' | 'completed' | 'failed';
//   total: number;
//   completed: number;
//   creditsUsed: number;
//   expiresAt: string;
//   next?: string | null;
//   data: Array<{
//     markdown?: string;
//     html?: string | null;
//     rawHtml?: string | null;
//     links?: string[];
//     screenshot?: string | null;
//     metadata: {
//       title?: string;
//       description?: string;
//       language?: string | null;
//       sourceURL?: string;
//       statusCode?: number;
//       error?: string | null;
//       [key: string]: any;
//     };
//   }>;
// }

// export interface CrawlErrorsResponse {
//   errors: Array<{
//     id: string;
//     timestamp?: string | null;
//     url: string;
//     error: string;
//   }>;
//   robotsBlocked: string[];
// }

// export interface MapRequest {
//   url: string;
//   search?: string;
//   ignoreSitemap?: boolean;
//   sitemapOnly?: boolean;
//   includeSubdomains?: boolean;
//   limit?: number;
//   timeout?: number;
// }

// export interface MapResponse {
//   success: boolean;
//   links: string[];
// }

// export interface ExtractRequest {
//   urls: string[];
//   prompt?: string;
//   schema?: Record<string, any>;
//   enableWebSearch?: boolean;
//   ignoreSitemap?: boolean;
//   includeSubdomains?: boolean;
//   showSources?: boolean;
//   scrapeOptions?: ScrapeOptions;
//   ignoreInvalidURLs?: boolean;
// }

// export interface ExtractResponse {
//   success: boolean;
//   id: string;
//   invalidURLs?: string[];
// }

// export interface ExtractStatusResponse {
//   success: boolean;
//   data: any;
//   status: 'completed' | 'processing' | 'failed' | 'cancelled';
//   expiresAt: string;
// }

// export interface DeepResearchRequest {
//   query: string;
//   maxDepth?: number;
//   timeLimit?: number;
//   maxUrls?: number;
//   analysisPrompt?: string;
//   systemPrompt?: string;
//   formats?: Array<'markdown' | 'json'>;
//   jsonOptions?: {
//     schema?: Record<string, any>;
//     systemPrompt?: string;
//     prompt?: string;
//   };
// }

// export interface DeepResearchResponse {
//   success: boolean;
//   id: string;
// }

// export interface DeepResearchStatusResponse {
//   success: boolean;
//   data: {
//     finalAnalysis?: string;
//     json?: any;
//     activities?: Array<{
//       type: string;
//       status: string;
//       message: string;
//       timestamp: string;
//       depth: number;
//     }>;
//     sources?: Array<{
//       url: string;
//       title: string;
//       description: string;
//       favicon: string;
//     }>;
//     status: 'processing' | 'completed' | 'failed';
//     error?: string;
//     expiresAt: string;
//     currentDepth: number;
//     maxDepth: number;
//     totalUrls: number;
//   };
// }

// export interface SearchRequest {
//   query: string;
//   limit?: number;
//   tbs?: string;
//   location?: string;
//   timeout?: number;
//   ignoreInvalidURLs?: boolean;
//   scrapeOptions?: {
//     formats?: Array<
//       'markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot' | 'screenshot@fullPage' | 'json'
//     >;
//   };
// }

// export interface SearchResponse {
//   success: boolean;
//   data: Array<{
//     title?: string;
//     description?: string;
//     url?: string;
//     markdown?: string | null;
//     html?: string | null;
//     rawHtml?: string | null;
//     links?: string[];
//     screenshot?: string | null;
//     metadata: {
//       title?: string;
//       description?: string;
//       sourceURL?: string;
//       statusCode?: number;
//       error?: string | null;
//     };
//   }>;
//   warning?: string | null;
// }

// export interface LLMsTxtRequest {
//   url: string;
//   maxUrls?: number;
//   showFullText?: boolean;
// }

// export interface LLMsTxtResponse {
//   success: boolean;
//   id: string;
// }

// export interface LLMsTxtStatusResponse {
//   success: boolean;
//   status: 'processing' | 'completed' | 'failed';
//   data: {
//     llmstxt?: string;
//     llmsfulltxt?: string;
//   };
//   expiresAt: string;
// }

// export interface CreditUsageResponse {
//   success: boolean;
//   data: {
//     remaining_credits: number;
//   };
// }

// export interface TokenUsageResponse {
//   success: boolean;
//   data: {
//     remaining_tokens: number;
//   };
// }

// export class FirecrawlError extends Error {
//   constructor(
//     message: string,
//     public status: number,
//     public response?: any,
//   ) {
//     super(message);
//     this.name = 'FirecrawlError';
//   }
// }

// export class FirecrawlClient {
//   private config: Required<FirecrawlConfig>;

//   constructor(config: FirecrawlConfig) {
//     this.config = {
//       baseUrl: config.baseUrl || 'https://api.firecrawl.dev/v1',
//       apiKey: config.apiKey,
//     };
//   }

//   private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
//     const url = `${this.config.baseUrl}${endpoint}`;

//     const response = await fetch(url, {
//       ...options,
//       headers: {
//         Authorization: `Bearer ${this.config.apiKey}`,
//         'Content-Type': 'application/json',
//         ...options.headers,
//       },
//     });

//     if (!response.ok) {
//       let errorData: any = {};
//       try {
//         errorData = await response.json();
//       } catch {
//         // Ignore JSON parsing errors
//       }

//       throw new FirecrawlError(
//         errorData.error ?? `HTTP ${response.status}: ${response.statusText}`,
//         response.status,
//         errorData,
//       );
//     }

//     return response.json();
//   }

//   // Scraping endpoints
//   async scrape(request: ScrapeRequest): Promise<ScrapeResponse> {
//     return this.request<ScrapeResponse>('/scrape', {
//       method: 'POST',
//       body: JSON.stringify(request),
//     });
//   }

//   async batchScrape(request: BatchScrapeRequest): Promise<BatchScrapeResponse> {
//     return this.request<BatchScrapeResponse>('/batch/scrape', {
//       method: 'POST',
//       body: JSON.stringify(request),
//     });
//   }

//   async getBatchScrapeStatus(id: string): Promise<BatchScrapeStatusResponse> {
//     return this.request<BatchScrapeStatusResponse>(`/batch/scrape/${id}`);
//   }

//   async cancelBatchScrape(id: string): Promise<{ success: boolean; message: string }> {
//     return this.request<{ success: boolean; message: string }>(`/batch/scrape/${id}`, {
//       method: 'DELETE',
//     });
//   }

//   async getBatchScrapeErrors(id: string): Promise<CrawlErrorsResponse> {
//     return this.request<CrawlErrorsResponse>(`/batch/scrape/${id}/errors`);
//   }

//   // Crawling endpoints
//   async crawl(request: CrawlRequest): Promise<CrawlResponse> {
//     return this.request<CrawlResponse>('/crawl', {
//       method: 'POST',
//       body: JSON.stringify(request),
//     });
//   }

//   async getCrawlStatus(id: string): Promise<CrawlStatusResponse> {
//     return this.request<CrawlStatusResponse>(`/crawl/${id}`);
//   }

//   async cancelCrawl(id: string): Promise<{ status: 'cancelled' }> {
//     return this.request<{ status: 'cancelled' }>(`/crawl/${id}`, {
//       method: 'DELETE',
//     });
//   }

//   async getCrawlErrors(id: string): Promise<CrawlErrorsResponse> {
//     return this.request<CrawlErrorsResponse>(`/crawl/${id}/errors`);
//   }

//   async getActiveCrawls(): Promise<{
//     success: boolean;
//     crawls: Array<{
//       id: string;
//       teamId: string;
//       url: string;
//       status: string;
//       options: {
//         scrapeOptions?: ScrapeOptions;
//       };
//     }>;
//   }> {
//     return this.request('/crawl/active');
//   }

//   // Mapping endpoints
//   async map(request: MapRequest): Promise<MapResponse> {
//     return this.request<MapResponse>('/map', {
//       method: 'POST',
//       body: JSON.stringify(request),
//     });
//   }

//   // Extraction endpoints
//   async extract(request: ExtractRequest): Promise<ExtractResponse> {
//     return this.request<ExtractResponse>('/extract', {
//       method: 'POST',
//       body: JSON.stringify(request),
//     });
//   }

//   async getExtractStatus(id: string): Promise<ExtractStatusResponse> {
//     return this.request<ExtractStatusResponse>(`/extract/${id}`);
//   }

//   // Deep Research endpoints
//   async startDeepResearch(request: DeepResearchRequest): Promise<DeepResearchResponse> {
//     return this.request<DeepResearchResponse>('/deep-research', {
//       method: 'POST',
//       body: JSON.stringify(request),
//     });
//   }

//   async getDeepResearchStatus(id: string): Promise<DeepResearchStatusResponse> {
//     return this.request<DeepResearchStatusResponse>(`/deep-research/${id}`);
//   }

//   // Search endpoints
//   async search(request: SearchRequest): Promise<SearchResponse> {
//     return this.request<SearchResponse>('/search', {
//       method: 'POST',
//       body: JSON.stringify(request),
//     });
//   }

//   // LLMs.txt endpoints
//   async generateLLMsTxt(request: LLMsTxtRequest): Promise<LLMsTxtResponse> {
//     return this.request<LLMsTxtResponse>('/llmstxt', {
//       method: 'POST',
//       body: JSON.stringify(request),
//     });
//   }

//   async getLLMsTxtStatus(id: string): Promise<LLMsTxtStatusResponse> {
//     return this.request<LLMsTxtStatusResponse>(`/llmstxt/${id}`);
//   }

//   // Billing endpoints
//   async getCreditUsage(): Promise<CreditUsageResponse> {
//     return this.request<CreditUsageResponse>('/team/credit-usage');
//   }

//   async getTokenUsage(): Promise<TokenUsageResponse> {
//     return this.request<TokenUsageResponse>('/team/token-usage');
//   }
// }

// // Export default instance creator
// export const createFirecrawlClient = (config: FirecrawlConfig): FirecrawlClient => {
//   return new FirecrawlClient(config);
// };

// // All types are already exported as interfaces above
