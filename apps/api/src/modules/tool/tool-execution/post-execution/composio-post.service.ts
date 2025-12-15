/**
 * Composio Tool Post-Handler Service
 *
 * Post-processing for Composio tools (Exa, Tavily, etc.).
 * Handles search result compression, large data upload, and billing.
 *
 * Migrated from: apps/api/src/modules/tool/composio/post-handler.service.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import type { DriveFile } from '@refly/openapi-schema';
import type {
  IToolPostHandler,
  PostHandlerInput,
  PostHandlerOutput,
  ComposioPostHandlerInput,
} from './post.interface';
import {
  DEFAULT_MAX_TOKENS,
  MAX_SNIPPET_TOKENS,
  estimateTokens,
  truncateToTokens,
  truncateContent,
  filterAndDedupeItems,
  filterAndDedupeUrls,
  pick,
  safeParseJSON,
} from '../../utils/token';
import { BillingService } from '../../billing/billing.service';
import { ResourceHandler } from '../../resource.service';

/**
 * Size threshold for truncating/uploading data (characters)
 * Data larger than this will be truncated and saved as file
 */
const DEFAULT_UPLOAD_THRESHOLD = 5000;

// ============================================================================
// Composio Tool Post-Handler Service
// ============================================================================

@Injectable()
export class ComposioToolPostHandlerService implements IToolPostHandler {
  readonly name = 'composio-tool-post-handler';
  private readonly logger = new Logger(ComposioToolPostHandlerService.name);
  private readonly uploadThreshold = DEFAULT_UPLOAD_THRESHOLD;

  constructor(
    private readonly billingService: BillingService,
    private readonly resourceHandler: ResourceHandler,
  ) {}

  /**
   * Process Composio tool result (Exa, Tavily, etc.)
   * Applies tool-specific compression based on toolsetKey
   * Also handles billing for successful tool executions
   */
  async process(input: PostHandlerInput): Promise<PostHandlerOutput> {
    const composioInput = input as ComposioPostHandlerInput;
    const { toolName, toolsetKey, rawResult, context } = input;
    // TODO: Optimize creditCost - should be fetched from tool configuration or calculated based on actual usage
    const creditCost = composioInput.creditCost ?? 3;
    const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;

    try {
      const normalized = this.normalizeResult(rawResult);
      const isSuccessful = this.isResultSuccessful(normalized);

      // Only bill on successful tool executions
      if (creditCost && creditCost > 0 && isSuccessful) {
        await this.processBilling({
          user: context.user,
          toolName,
          toolsetKey,
          creditCost,
          resultId: context.resultId,
          resultVersion: context.resultVersion,
        });
      }
      const fullContent =
        typeof normalized === 'string' ? normalized : JSON.stringify(normalized ?? {}, null, 2);

      // Apply tool-specific compression
      const compressed = await this.compressContent({
        toolsetKey,
        toolName,
        rawResult: normalized,
        maxTokens,
      });

      const wasTruncated = estimateTokens(fullContent) > maxTokens;

      let fileId: string | undefined;
      let fileMeta: DriveFile | undefined;

      // Upload full content to file if truncated or exceeds upload threshold
      const shouldUpload = wasTruncated || fullContent.length > this.uploadThreshold;

      if (shouldUpload) {
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
      let content = compressed;
      if (fileId && fileMeta) {
        try {
          const parsed = JSON.parse(compressed);
          parsed.files = [
            {
              fileId: fileMeta.fileId,
              canvasId: fileMeta.canvasId,
              name: fileMeta.name,
              type: fileMeta.type,
              summary:
                'Full content stored in this file. If need more details, use read_file tool with this fileId.',
            },
          ];
          content = JSON.stringify(parsed, null, 2);
        } catch {
          // If compressed is not valid JSON, keep as-is
        }
      }

      return {
        content,
        fileId,
        fileMeta,
        success: isSuccessful,
        wasTruncated,
      };
    } catch (error) {
      this.logger.error('Composio tool post-handler error', {
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
    // Composio may return response in different formats
    if (Array.isArray(raw) && raw.length === 2) {
      return raw[0];
    }
    return raw;
  }

  private isResultSuccessful(result: unknown): boolean {
    if (!result || typeof result !== 'object') {
      return false;
    }

    const candidate = result as Record<string, unknown>;
    const successFlag = candidate.successful;

    if (typeof successFlag === 'boolean') {
      return successFlag;
    }

    if (typeof successFlag === 'string') {
      return successFlag.toLowerCase() === 'true';
    }

    if (typeof candidate.status === 'string') {
      return (candidate.status as string).toLowerCase() === 'success';
    }

    return false;
  }

  /**
   * Compress content based on toolsetKey
   * - exa: search results with highlights
   * - tavily: search results with content
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
      ...pick(rawObj, ['status', 'summary', 'error', 'message', 'successful']),
    };

    // Handle Composio response structure (data may be in different locations)
    const data = rawObj?.data ?? rawObj?.response ?? rawObj?.results ?? rawObj;

    // Exa-specific compression
    if (toolsetKey.toLowerCase() === 'exa') {
      return this.compressExaResult(compressed, data, rawObj);
    }

    // Tavily-specific compression
    if (toolsetKey.toLowerCase() === 'tavily') {
      return this.compressTavilyResult(compressed, data, rawObj);
    }

    // Default compression for other Composio tools
    return this.compressGenericResult(compressed, data, rawObj);
  }

  /**
   * Compress Exa search results
   * - results: array of search results with highlights
   * - autopromptString: query expansion info
   */
  private compressExaResult(compressed: any, data: any, rawObj: any): string {
    // Exa returns results array
    const results = data?.results ?? (Array.isArray(data) ? data : []);

    if (Array.isArray(results) && results.length > 0) {
      const { filtered, originalCount } = filterAndDedupeItems(results);
      compressed.data = {
        results: filtered.map((item: any) => ({
          ...pick(item, ['title', 'url', 'score', 'publishedDate', 'author']),
          // Exa uses 'text' or 'highlights' for content
          content: truncateContent(
            String(item?.text ?? item?.highlights?.join('\n') ?? item?.snippet ?? ''),
            MAX_SNIPPET_TOKENS,
          ),
        })),
      };

      if (originalCount > filtered.length) {
        compressed.truncated = { total: originalCount, kept: filtered.length };
      }

      // Include autoprompt info if available
      if (rawObj?.autopromptString || data?.autopromptString) {
        compressed.data.autopromptString = rawObj?.autopromptString ?? data?.autopromptString;
      }
    } else {
      compressed.data = data;
    }

    return JSON.stringify(compressed, null, 2);
  }

  /**
   * Compress Tavily search results
   * - results: array of search results
   * - answer: AI-generated answer (if available)
   */
  private compressTavilyResult(compressed: any, data: any, rawObj: any): string {
    // Tavily returns results array and optional answer
    const results = data?.results ?? rawObj?.results ?? (Array.isArray(data) ? data : []);
    const answer = data?.answer ?? rawObj?.answer;

    if (Array.isArray(results) && results.length > 0) {
      const { filtered, originalCount } = filterAndDedupeItems(results);
      compressed.data = {
        results: filtered.map((item: any) => ({
          ...pick(item, ['title', 'url', 'score', 'publishedDate']),
          content: truncateContent(
            String(item?.content ?? item?.snippet ?? item?.raw_content ?? ''),
            MAX_SNIPPET_TOKENS,
          ),
        })),
      };

      if (originalCount > filtered.length) {
        compressed.truncated = { total: originalCount, kept: filtered.length };
      }
    } else {
      compressed.data = { results: [] };
    }

    // Include Tavily's AI-generated answer if available
    if (answer) {
      compressed.data.answer = truncateContent(String(answer), MAX_SNIPPET_TOKENS);
    }

    // Include follow-up questions if available
    if (rawObj?.follow_up_questions || data?.follow_up_questions) {
      compressed.data.follow_up_questions =
        rawObj?.follow_up_questions ?? data?.follow_up_questions;
    }

    return JSON.stringify(compressed, null, 2);
  }

  /**
   * Generic compression for other Composio tools
   */
  private compressGenericResult(compressed: any, data: any, rawObj: any): string {
    if (Array.isArray(data)) {
      const { filtered, originalCount } = filterAndDedupeItems(data);
      compressed.data = filtered.map((item: any) => ({
        ...pick(item, ['title', 'url', 'description', 'site', 'publishedTime', 'score']),
        content: truncateContent(
          String(item?.content ?? item?.snippet ?? item?.text ?? ''),
          MAX_SNIPPET_TOKENS,
        ),
      }));

      if (originalCount > filtered.length) {
        compressed.truncated = { total: originalCount, kept: filtered.length };
      }
    } else if (data && typeof data === 'object') {
      compressed.data = { ...pick(data, ['url', 'title', 'model', 'usage', 'answer']) };

      if (data.content) {
        compressed.data.content = truncateContent(String(data.content), MAX_SNIPPET_TOKENS);
      }

      if (data.response) {
        compressed.data.response = truncateContent(String(data.response), MAX_SNIPPET_TOKENS);
      }

      if (data.text) {
        compressed.data.text = truncateContent(String(data.text), MAX_SNIPPET_TOKENS);
      }

      if (Array.isArray(data.citations)) {
        compressed.data.citations = filterAndDedupeUrls(data.citations);
      }

      if (Array.isArray(data.results)) {
        const { filtered } = filterAndDedupeItems(data.results);
        compressed.data.results = filtered.map((r: any) =>
          pick(r, ['title', 'url', 'snippet', 'score']),
        );
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

  /**
   * Process billing for tool execution
   */
  private async processBilling(args: {
    user: { uid: string };
    toolName: string;
    toolsetKey: string;
    creditCost: number;
    resultId: string;
    resultVersion: number;
  }): Promise<void> {
    const { user, toolName, toolsetKey, creditCost, resultId, resultVersion } = args;

    try {
      await this.billingService.processBilling({
        uid: user.uid,
        toolName,
        toolsetKey,
        discountedPrice: creditCost,
        originalPrice: creditCost,
        resultId,
        version: resultVersion,
      });

      this.logger.debug(`Billing processed: ${creditCost} credits for ${toolsetKey}.${toolName}`);
    } catch (error) {
      this.logger.error('Failed to process billing', {
        error: (error as Error)?.message,
        toolName,
        toolsetKey,
        creditCost,
      });
      // Don't throw - billing failure should not fail the tool execution
    }
  }
}
