/**
 * Regular Tool Post-Handler Service
 *
 * Post-processing for regular tools (Jina, Perplexity) stored in our database.
 * Handles search result filtering, AI response compression, and file archiving.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { DriveFile } from '@refly/openapi-schema';
import type { IToolPostHandler, PostHandlerInput, PostHandlerOutput } from './post.interface';
import {
  DEFAULT_MAX_TOKENS,
  MAX_SNIPPET_TOKENS,
  estimateTokens,
  truncateToTokens,
  truncateContent,
  truncateAndFilterContent,
  filterAndDedupeItems,
  filterAndDedupeUrls,
  pick,
  safeParseJSON,
} from '../../utils/token';
import { ResourceHandler } from '../../resource.service';
import { extractFileIdToTopLevel } from '../../dynamic-tooling/core/handler-post';

// ============================================================================
// Regular Tool Post-Handler Service
// ============================================================================

@Injectable()
export class RegularToolPostHandlerService implements IToolPostHandler {
  readonly name = 'regular-tool-post-handler';
  private readonly logger = new Logger(RegularToolPostHandlerService.name);

  constructor(private readonly resourceHandler: ResourceHandler) {}

  /**
   * Process regular tool result (Jina, Perplexity)
   * Applies tool-specific compression based on toolsetKey
   */
  async process(input: PostHandlerInput): Promise<PostHandlerOutput> {
    const { toolName, toolsetKey, rawResult, context } = input;
    const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;

    try {
      const normalized = this.normalizeResult(rawResult);
      const fullContent =
        typeof normalized === 'string' ? normalized : JSON.stringify(normalized ?? {}, null, 2);

      // Apply tool-specific compression
      const compressed = await this.compressContent({
        toolsetKey,
        toolName,
        rawResult: normalized,
        maxTokens,
      });

      // Archive if compressed content still exceeds token limit
      const compressedTokens = estimateTokens(compressed);
      const wasTruncated = compressedTokens > maxTokens;

      let fileId: string | undefined;
      let fileMeta: DriveFile | undefined;

      // Upload full content to file if truncated
      if (wasTruncated) {
        const uploadResult = await this.uploadToFile({
          toolsetKey,
          toolName,
          content: fullContent,
          context,
        });
        fileId = uploadResult.fileId;
        fileMeta = uploadResult.fileMeta;
      }

      // If file was archived, include files array for frontend display
      let contentData: Record<string, unknown> = {};
      try {
        contentData = JSON.parse(compressed);
      } catch {
        contentData = { rawContent: compressed };
      }

      if (fileId && fileMeta) {
        contentData.files = [
          {
            fileId: fileMeta.fileId,
            canvasId: fileMeta.canvasId,
            name: fileMeta.name,
            mimeType: fileMeta.type,
            summary: 'Full content stored here. Use read_file tool to obtain detailed content.',
          },
        ];
      }

      // Extract fileId and files to top level for frontend accessibility
      const extractedResponse = extractFileIdToTopLevel({
        success: true,
        data: contentData,
      });

      return {
        content: JSON.stringify(extractedResponse.data ?? contentData, null, 2),
        fileId,
        fileMeta,
        success: true,
        wasTruncated,
      };
    } catch (error) {
      this.logger.error('Regular tool post-handler error', {
        error: (error as Error)?.message,
        toolName,
        toolsetKey,
      });

      const fallbackContent =
        typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult ?? {}, null, 2);

      return {
        content: truncateToTokens(fallbackContent, maxTokens),
        success: false,
        error: (error as Error)?.message,
        wasTruncated: estimateTokens(fallbackContent) > maxTokens,
      };
    }
  }

  private normalizeResult(raw: unknown): unknown {
    // Some tool adapters return [content, artifacts]
    if (Array.isArray(raw) && raw.length === 2) {
      return raw[0];
    }
    return raw;
  }

  /**
   * Compress content based on toolsetKey
   * - jina: search results array or single read result
   * - perplexity: AI response with citations and searchResults
   * - default: generic compression
   */
  private async compressContent(args: {
    toolsetKey: string;
    toolName: string;
    rawResult: unknown;
    maxTokens: number;
  }): Promise<string> {
    const { toolsetKey, toolName, rawResult, maxTokens } = args;

    const rawObj: any =
      typeof rawResult === 'string' ? (safeParseJSON(rawResult) ?? rawResult) : rawResult;

    // Non-object: simple truncation
    if (!rawObj || typeof rawObj !== 'object') {
      const asText =
        typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult ?? {}, null, 2);
      return truncateToTokens(asText, maxTokens);
    }

    const compressed: any = {
      toolsetKey,
      toolName,
      ...pick(rawObj, ['status', 'summary', 'creditCost', 'error', 'message']),
    };

    const data = rawObj?.data;

    // Jina-specific compression
    if (toolsetKey === 'jina') {
      return this.compressJinaResult(compressed, data);
    }

    // Perplexity-specific compression
    if (toolsetKey === 'perplexity') {
      return this.compressPerplexityResult(compressed, data);
    }

    // Default compression for other regular tools
    return this.compressGenericResult(compressed, data, rawObj);
  }

  /**
   * Compress Jina search/read results
   * - Array data: serp results (filter, dedupe, truncate snippets)
   * - Object data: single read result (truncate content)
   */
  private compressJinaResult(compressed: any, data: any): string {
    if (Array.isArray(data)) {
      // Jina serp: array of search results (content is scraped - needs filtering)
      const { filtered, originalCount } = filterAndDedupeItems(data);
      compressed.data = filtered.map((item: any) => {
        const rawContent = String(item?.content ?? item?.snippet ?? '');
        // All search content may contain web noise - use truncateAndFilterContent
        const { content } = truncateAndFilterContent(rawContent, MAX_SNIPPET_TOKENS);
        return {
          ...pick(item, ['title', 'url', 'description', 'site', 'publishedTime', 'usage']),
          content,
        };
      });

      if (originalCount > filtered.length) {
        compressed.truncated = { total: originalCount, kept: filtered.length };
      }
    } else if (data && typeof data === 'object') {
      // Jina read: single URL content (full page scrape - needs filtering)
      const { content } = truncateAndFilterContent(String(data?.content ?? ''), MAX_SNIPPET_TOKENS);
      compressed.data = {
        ...pick(data, ['url', 'title', 'usage']),
        content,
      };
    } else {
      compressed.data = data;
    }

    return JSON.stringify(compressed, null, 2);
  }

  /**
   * Compress Perplexity AI response
   * - Truncate response text (AI generated - no filtering needed)
   * - Filter citations (dedupe by domain)
   * - Filter searchResults (dedupe by domain)
   */
  private compressPerplexityResult(compressed: any, data: any): string {
    if (data && typeof data === 'object') {
      compressed.data = {
        ...pick(data, ['model', 'usage']),
      };

      // AI response - no filtering needed
      if (data.response) {
        compressed.data.response = truncateContent(String(data.response), MAX_SNIPPET_TOKENS);
      }

      // Filter citations
      if (Array.isArray(data.citations)) {
        compressed.data.citations = filterAndDedupeUrls(data.citations);
      }

      // Filter search results - these may contain web content
      if (Array.isArray(data.searchResults)) {
        const { filtered } = filterAndDedupeItems(data.searchResults);
        compressed.data.searchResults = filtered.map((r: any) => {
          const rawContent = String(r?.snippet ?? r?.content ?? '');
          const { content } = truncateAndFilterContent(rawContent, MAX_SNIPPET_TOKENS);
          return {
            ...pick(r, ['title', 'url']),
            content,
          };
        });
      }
    } else {
      compressed.data = data;
    }

    return JSON.stringify(compressed, null, 2);
  }

  /**
   * Generic compression for other regular tools
   */
  private compressGenericResult(compressed: any, data: any, rawObj: any): string {
    if (Array.isArray(data)) {
      const { filtered, originalCount } = filterAndDedupeItems(data);
      compressed.data = filtered.map((item: any) => {
        const rawContent = String(item?.content ?? item?.snippet ?? '');
        // All search content may contain web noise - use truncateAndFilterContent
        const { content } = truncateAndFilterContent(rawContent, MAX_SNIPPET_TOKENS);
        return {
          ...pick(item, ['title', 'url', 'description', 'site', 'publishedTime']),
          content,
        };
      });

      if (originalCount > filtered.length) {
        compressed.truncated = { total: originalCount, kept: filtered.length };
      }
    } else if (data && typeof data === 'object') {
      compressed.data = { ...pick(data, ['url', 'title', 'model', 'usage']) };

      // Web content - use truncateAndFilterContent
      if (data.content) {
        const { content } = truncateAndFilterContent(String(data.content), MAX_SNIPPET_TOKENS);
        compressed.data.content = content;
      }

      // AI response - no filtering needed
      if (data.response) {
        compressed.data.response = truncateContent(String(data.response), MAX_SNIPPET_TOKENS);
      }

      if (Array.isArray(data.citations)) {
        compressed.data.citations = filterAndDedupeUrls(data.citations);
      }

      if (Array.isArray(data.searchResults)) {
        const { filtered } = filterAndDedupeItems(data.searchResults);
        compressed.data.searchResults = filtered.map((r: any) => {
          const rawContent = String(r?.snippet ?? r?.content ?? '');
          const { content } = truncateAndFilterContent(rawContent, MAX_SNIPPET_TOKENS);
          return {
            ...pick(r, ['title', 'url']),
            content,
          };
        });
      }
    } else {
      compressed.data = data ?? pick(rawObj, ['data']);
    }

    return JSON.stringify(compressed, null, 2);
  }

  private async uploadToFile(args: {
    toolsetKey: string;
    toolName: string;
    content: string;
    context: PostHandlerInput['context'];
  }): Promise<{ fileId?: string; fileMeta?: DriveFile }> {
    const { toolsetKey, toolName, content, context } = args;

    const fileMeta = await this.resourceHandler.uploadToolResult(context.user, {
      canvasId: context.canvasId,
      toolsetKey,
      toolName,
      content,
      resultId: context.resultId,
      resultVersion: context.resultVersion,
    });

    return fileMeta ? { fileId: fileMeta.fileId, fileMeta } : {};
  }
}
