import { Injectable, Logger } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import { Request } from 'express';
import { InternalMcpService } from '../internal-mcp.service';
import { User as UserModel } from '@prisma/client';
import { SearchService } from '../../search/search.service';

@Injectable()
export class SearchTools {
  private readonly logger = new Logger(SearchTools.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly internalMcpService: InternalMcpService,
  ) {}

  /**
   * Search internal resources, documents, and canvases
   */
  @Tool({
    name: 'search_internal',
    description: "Search user's internal resources, documents, and canvases",
    parameters: z.object({
      query: z.string().describe('Search query text'),
      limit: z.number().optional().describe('Maximum number of results to return (1-10)'),
      mode: z.enum(['keyword', 'vector', 'hybrid']).optional().describe('Search mode'),
      domains: z
        .array(z.enum(['resource', 'document', 'canvas']))
        .optional()
        .describe('Domains to search in'),
      projectId: z.string().optional().describe('Filter by project ID'),
      enableReranker: z.boolean().optional().describe('Enable result reranking'),
    }),
  })
  async searchInternal(
    params: {
      query: string;
      limit?: number;
      mode?: string;
      domains?: string[];
      projectId?: string;
      enableReranker?: boolean;
    },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'search_internal' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      const searchRequest = {
        query: params.query,
        limit: Math.min(Math.max(params.limit || 5, 1), 10),
        mode: (params.mode as 'keyword' | 'vector' | 'hybrid') || 'keyword',
        domains: params.domains as ('resource' | 'document' | 'canvas')[] | undefined,
        projectId: params.projectId,
      };

      const results = await this.searchService.search(user, searchRequest, {
        enableReranker: params.enableReranker || false,
      });

      return this.internalMcpService.formatSuccessResponse({
        results,
        totalCount: results.length,
        query: params.query,
        searchMode: searchRequest.mode,
        domains: searchRequest.domains,
      });
    } catch (error) {
      this.logger.error(`Error in search_internal: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }

  /**
   * Advanced knowledge base search with multilingual support and intelligent ranking
   */
  @Tool({
    name: 'search_knowledge_base',
    description:
      'Advanced knowledge base search with multilingual support, query rewriting, and intelligent ranking',
    parameters: z.object({
      query: z.string().describe('Search query text'),
      rewrittenQueries: z
        .array(z.string())
        .optional()
        .describe('Additional rewritten queries for better search coverage'),
      searchLocaleList: z
        .array(z.string())
        .optional()
        .describe('List of locales to search in (e.g., ["en", "zh-CN"])'),
      displayLocale: z
        .string()
        .optional()
        .describe('Display locale for results (auto for auto-detection)'),
      searchLimit: z
        .number()
        .optional()
        .describe('Maximum number of search results per query (1-20)'),
      enableQueryRewrite: z
        .boolean()
        .optional()
        .describe('Enable automatic query rewriting for better results'),
      enableTranslateQuery: z
        .boolean()
        .optional()
        .describe('Enable query translation to multiple languages'),
      enableTranslateResult: z
        .boolean()
        .optional()
        .describe('Enable result translation to display locale'),
      enableRerank: z
        .boolean()
        .optional()
        .describe('Enable intelligent reranking of search results'),
      rerankRelevanceThreshold: z
        .number()
        .optional()
        .describe('Relevance threshold for reranking (0.0-1.0)'),
      rerankLimit: z.number().optional().describe('Maximum number of results after reranking'),
      enableDeepSearch: z
        .boolean()
        .optional()
        .describe('Enable deep search with expanded query coverage'),
      enableSearchWholeSpace: z
        .boolean()
        .optional()
        .describe('Search across entire workspace instead of project-specific'),
      projectId: z.string().optional().describe('Filter by specific project ID'),
      concurrencyLimit: z
        .number()
        .optional()
        .describe('Concurrency limit for parallel search operations (1-10)'),
      batchSize: z.number().optional().describe('Batch size for processing search queries (1-10)'),
    }),
  })
  async searchKnowledgeBase(
    params: {
      query: string;
      rewrittenQueries?: string[];
      searchLocaleList?: string[];
      displayLocale?: string;
      searchLimit?: number;
      enableQueryRewrite?: boolean;
      enableTranslateQuery?: boolean;
      enableTranslateResult?: boolean;
      enableRerank?: boolean;
      rerankRelevanceThreshold?: number;
      rerankLimit?: number;
      enableDeepSearch?: boolean;
      enableSearchWholeSpace?: boolean;
      projectId?: string;
      concurrencyLimit?: number;
      batchSize?: number;
    },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'search_knowledge_base' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      // Validate and set default parameters
      const searchParams = {
        query: params.query,
        rewrittenQueries: params.rewrittenQueries || [],
        searchLocaleList: params.searchLocaleList || ['en'],
        resultDisplayLocale: params.displayLocale || 'auto',
        searchLimit: Math.min(Math.max(params.searchLimit || 10, 1), 20),
        enableQueryRewrite: params.enableQueryRewrite ?? true,
        enableTranslateQuery: params.enableTranslateQuery || false,
        enableTranslateResult: params.enableTranslateResult || false,
        enableRerank: params.enableRerank || true,
        rerankRelevanceThreshold: params.rerankRelevanceThreshold || 0.2,
        rerankLimit: params.rerankLimit,
        enableDeepSearch: params.enableDeepSearch || false,
        enableSearchWholeSpace: params.enableSearchWholeSpace || false,
        translateConcurrencyLimit: Math.min(Math.max(params.concurrencyLimit || 5, 1), 10),
        libraryConcurrencyLimit: Math.min(Math.max(params.concurrencyLimit || 3, 1), 10),
        batchSize: Math.min(Math.max(params.batchSize || 5, 1), 10),
        projectId: params.projectId,
      };

      // Use the basic search method with enhanced parameters
      const basicSearchRequest = {
        query: params.query,
        limit: searchParams.searchLimit,
        mode: 'vector' as const,
        domains: ['resource', 'document'] as ('resource' | 'document')[],
        projectId: searchParams.projectId,
      };

      const searchOptions = {
        enableReranker: searchParams.enableRerank,
      };

      const results = await this.searchService.search(user, basicSearchRequest, searchOptions);

      // Convert search results to sources format for consistency
      const sources = results.map((result) => ({
        url: '',
        title: result.title || '',
        pageContent:
          result.snippets?.map((s) => s.text).join('\n\n') || result.contentPreview || '',
        metadata: {
          entityId: result.id,
          entityType: result.domain,
          source: 'knowledge_base',
          sourceType: 'library',
          originalQuery: params.query,
          searchMode: basicSearchRequest.mode,
          ...result.metadata,
        },
      }));

      return this.internalMcpService.formatSuccessResponse({
        sources,
        results, // Include original search results for backward compatibility
        totalCount: results.length,
        query: params.query,
        rewrittenQueries: params.rewrittenQueries || [],
        searchMode: basicSearchRequest.mode,
        domains: basicSearchRequest.domains,
        searchParameters: {
          enableQueryRewrite: searchParams.enableQueryRewrite,
          enableTranslateQuery: searchParams.enableTranslateQuery,
          enableTranslateResult: searchParams.enableTranslateResult,
          enableRerank: searchParams.enableRerank,
          enableDeepSearch: searchParams.enableDeepSearch,
          enableSearchWholeSpace: searchParams.enableSearchWholeSpace,
          rerankRelevanceThreshold: searchParams.rerankRelevanceThreshold,
          searchLimit: searchParams.searchLimit,
          concurrencyLimit: params.concurrencyLimit,
          batchSize: searchParams.batchSize,
          projectId: params.projectId,
        },
      });
    } catch (error) {
      this.logger.error(`Error in search_knowledge_base: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }

  /**
   * Search the web for information
   */
  @Tool({
    name: 'search_web',
    description: 'Search the web for information using external search engines',
    parameters: z.object({
      query: z.string().describe('Search query text'),
      limit: z.number().optional().describe('Maximum number of results to return'),
      locale: z.string().optional().describe('Search locale (e.g., en, zh-CN)'),
    }),
  })
  async searchWeb(
    params: { query: string; limit?: number; locale?: string },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'search_web' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      const webSearchRequest = {
        queries: [
          {
            q: params.query,
            hl: params.locale || 'en',
          },
        ],
        limit: params.limit || 10,
      };

      const results = await this.searchService.webSearch(user, webSearchRequest);

      return this.internalMcpService.formatSuccessResponse({
        results,
        totalCount: results.length,
        query: params.query,
        locale: params.locale || 'en',
      });
    } catch (error) {
      this.logger.error(`Error in search_web: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }

  /**
   * Search the web with multiple languages and advanced options
   */
  @Tool({
    name: 'search_web_multilingual',
    description: 'Search the web with multiple languages, translation, and reranking capabilities',
    parameters: z.object({
      query: z.string().describe('Search query text'),
      searchLocaleList: z.array(z.string()).optional().describe('List of locales to search in'),
      displayLocale: z
        .string()
        .optional()
        .describe('Display locale for results (auto for auto-detection)'),
      searchLimit: z.number().optional().describe('Maximum number of search results'),
      enableRerank: z.boolean().optional().describe('Enable result reranking'),
      rerankLimit: z.number().optional().describe('Maximum number of results after reranking'),
      rerankRelevanceThreshold: z.number().optional().describe('Relevance threshold for reranking'),
    }),
  })
  async searchWebMultilingual(
    params: {
      query: string;
      searchLocaleList?: string[];
      displayLocale?: string;
      searchLimit?: number;
      enableRerank?: boolean;
      rerankLimit?: number;
      rerankRelevanceThreshold?: number;
    },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'search_web_multilingual' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      const multilingualRequest = {
        query: params.query,
        searchLocaleList: params.searchLocaleList || ['en', 'zh-CN'],
        displayLocale: params.displayLocale || 'auto',
        searchLimit: params.searchLimit || 10,
        enableRerank: params.enableRerank || false,
        rerankLimit: params.rerankLimit,
        rerankRelevanceThreshold: params.rerankRelevanceThreshold || 0.1,
      };

      const result = await this.searchService.multiLingualWebSearch(user, multilingualRequest);

      return this.internalMcpService.formatSuccessResponse({
        sources: result.sources,
        searchSteps: result.searchSteps,
        totalCount: result.sources.length,
        query: params.query,
        searchLocales: params.searchLocaleList || ['en', 'zh-CN'],
        displayLocale: params.displayLocale || 'auto',
        enableRerank: params.enableRerank || false,
      });
    } catch (error) {
      this.logger.error(`Error in search_web_multilingual: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }
}
