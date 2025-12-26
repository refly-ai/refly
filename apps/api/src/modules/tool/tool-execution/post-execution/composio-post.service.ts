/**
 * Composio Tool Post-Handler Service
 *
 * Post-processing for Composio tools (Exa, Tavily, etc.).
 * Handles search result compression, large data upload, and billing.
 *
 * Migrated from: apps/api/src/modules/tool/composio/post-handler.service.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import type { DriveFile, User } from '@refly/openapi-schema';
import axios from 'axios';
import HTMLtoDOCX from 'html-to-docx';
import * as XLSX from 'xlsx';
import { BillingService } from '../../billing/billing.service';
import { extractFileIdToTopLevel } from '../../dynamic-tooling/core/handler-post';
import { ResourceHandler } from '../../resource.service';
import {
  DEFAULT_MAX_TOKENS,
  MAX_SNIPPET_TOKENS,
  estimateTokens,
  truncateAndFilterContent,
  filterAndDedupeItems,
  filterAndDedupeUrls,
  pick,
  safeParseJSON,
  truncateContent,
  truncateToTokens,
} from '../../utils/token';
import type {
  ComposioPostHandlerInput,
  IToolPostHandler,
  PostHandlerInput,
  PostHandlerOutput,
} from './post.interface';

/**
 * Structure for downloaded file content from Composio
 */
interface DownloadedFileContent {
  mimetype?: string;
  name?: string;
  s3url?: string;
}

/**
 * Result from content compression
 */
interface CompressResult {
  content: string;
  fullContent: string;
  wasTruncated: boolean;
}

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
   * Check if toolset requires compression/truncation (search tools)
   */
  private isSearchTool(toolsetKey: string): boolean {
    const toolsetLower = toolsetKey.toLowerCase();
    return toolsetLower === 'exa' || toolsetLower === 'tavily';
  }

  // Default MIME type for unknown file types
  private readonly DEFAULT_MIME_TYPE = 'text/plain';

  // Google MIME types that need conversion
  private readonly GOOGLE_DOCS_MIME = 'application/vnd.google-apps.document';
  private readonly GOOGLE_SHEETS_MIME = 'application/vnd.google-apps.spreadsheet';

  /**
   * Resolve MIME type from multiple sources
   * Priority: outerMimeType > dataMimeType > innerMimeType > default
   */
  private resolveMimeType(
    outerMimeType: string | undefined,
    dataMimeType: string | undefined,
    innerMimeType: string | undefined,
  ): string {
    // Check if innerMimeType indicates binary stream (should be ignored)
    const isBinaryStream =
      innerMimeType === 'application/octet-stream' || innerMimeType === 'binary/octet-stream';
    const effectiveInnerMimeType = isBinaryStream ? undefined : innerMimeType;

    // Resolve MIME type with priority chain
    return outerMimeType || dataMimeType || effectiveInnerMimeType || this.DEFAULT_MIME_TYPE;
  }

  /**
   * Check if MIME type is a Google format that needs conversion
   */
  private isGoogleFormat(mimeType: string): boolean {
    return mimeType === this.GOOGLE_DOCS_MIME || mimeType === this.GOOGLE_SHEETS_MIME;
  }

  /**
   * Convert file content for Google formats
   * - Google Docs (HTML) -> DOCX using html-to-docx library
   * - Google Sheets -> CSV (no conversion needed, just change extension)
   */
  private async convertGoogleFormat(
    buffer: Buffer,
    sourceMimeType: string,
    fileName: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    // Remove extension - uploadBufferResource will add the correct extension based on mimeType
    const baseName = fileName.replace(/\.[^.]+$/, '');

    if (sourceMimeType === this.GOOGLE_DOCS_MIME) {
      // Google Docs exports as HTML, convert to DOCX using html-to-docx
      const htmlContent = buffer.toString('utf8');

      this.logger.debug('Converting Google Docs HTML to DOCX', {
        bufferSize: buffer.length,
        bufferPreview: htmlContent.substring(0, 200),
      });

      try {
        const docxBuffer = await HTMLtoDOCX(htmlContent, null, {
          table: { row: { cantSplit: true } },
          footer: true,
          header: true,
        });

        this.logger.debug('Converted Google Docs to DOCX', {
          originalSize: buffer.length,
          convertedSize: docxBuffer.byteLength,
          fileName: baseName,
        });

        return {
          buffer: Buffer.from(docxBuffer),
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileName: baseName, // No extension - uploadBufferResource will add .docx
        };
      } catch (conversionError) {
        this.logger.error('HTML to DOCX conversion failed', {
          error: (conversionError as Error)?.message,
          stack: (conversionError as Error)?.stack,
        });
        throw conversionError;
      }
    }

    if (sourceMimeType === this.GOOGLE_SHEETS_MIME) {
      // Google Sheets exports as HTML, convert to XLSX using SheetJS
      const htmlContent = buffer.toString('utf8');

      this.logger.debug('Converting Google Sheets HTML to XLSX', {
        bufferSize: buffer.length,
        bufferPreview: htmlContent.substring(0, 200),
      });

      try {
        // Parse HTML table and create workbook
        const workbook = XLSX.read(htmlContent, { type: 'string' });

        // Write workbook to buffer
        const xlsxBuffer = XLSX.write(workbook, {
          type: 'buffer',
          bookType: 'xlsx',
        });

        this.logger.debug('Converted Google Sheets to XLSX', {
          originalSize: buffer.length,
          convertedSize: xlsxBuffer.length,
          fileName: baseName,
        });

        return {
          buffer: Buffer.from(xlsxBuffer),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileName: baseName, // No extension - uploadBufferResource will add .xlsx
        };
      } catch (conversionError) {
        this.logger.error('HTML to XLSX conversion failed', {
          error: (conversionError as Error)?.message,
          stack: (conversionError as Error)?.stack,
        });
        throw conversionError;
      }
    }

    // No conversion needed
    return { buffer, mimeType: sourceMimeType, fileName };
  }

  /**
   * Process Composio tool result
   * - For search tools (Exa, Tavily): applies compression and truncation
   * - For other tools: checks for downloaded_file_content and saves to file library
   */
  async process(input: PostHandlerInput): Promise<PostHandlerOutput> {
    const composioInput = input as ComposioPostHandlerInput;
    const { toolName, toolsetKey, rawResult, context } = input;
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

      // Route to different processing based on tool type
      if (this.isSearchTool(toolsetKey)) {
        return await this.processSearchToolResult({
          toolName,
          toolsetKey,
          normalized,
          maxTokens,
          context,
          isSuccessful,
        });
      } else {
        return await this.processGeneralToolResult({
          normalized,
          maxTokens,
          context,
          isSuccessful,
        });
      }
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

  /**
   * Process search tool results (Exa, Tavily)
   * Applies compression, truncation, and uploads full content if needed
   */
  private async processSearchToolResult(args: {
    toolName: string;
    toolsetKey: string;
    normalized: unknown;
    maxTokens: number;
    context: PostHandlerInput['context'];
    isSuccessful: boolean;
  }): Promise<PostHandlerOutput> {
    const { toolName, toolsetKey, normalized, maxTokens, context, isSuccessful } = args;

    // Apply tool-specific compression (returns content, fullContent, and wasTruncated)
    const compressResult = this.compressContent({
      toolsetKey,
      toolName,
      rawResult: normalized,
      maxTokens,
    });

    const { fullContent, wasTruncated } = compressResult;

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
    let content = compressResult.content;
    if (fileId && fileMeta) {
      try {
        const parsed = JSON.parse(compressResult.content);
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
  }

  /**
   * Process general tool results (non-search tools)
   * Checks for downloaded_file_content and saves to file library
   */
  private async processGeneralToolResult(args: {
    normalized: unknown;
    maxTokens: number;
    context: PostHandlerInput['context'];
    isSuccessful: boolean;
  }): Promise<PostHandlerOutput> {
    const { normalized, maxTokens, context, isSuccessful } = args;

    const normalizedObj = normalized as Record<string, unknown> | null;
    let fileId: string | undefined;
    let fileMeta: DriveFile | undefined;

    // Check for downloaded_file_content and upload to file library
    if (normalizedObj && typeof normalizedObj === 'object') {
      const outerMimeType = (normalizedObj?.data as Record<string, unknown>)?.mimeType as
        | string
        | undefined;
      const downloadedFile = await this.handleDownloadedFileContent(
        normalizedObj,
        outerMimeType,
        context,
      );
      if (downloadedFile) {
        fileId = downloadedFile.fileId;
        fileMeta = downloadedFile;
      }
    }

    // Build response data with file info injected
    const responseData: Record<string, unknown> =
      normalizedObj && typeof normalizedObj === 'object' ? { ...normalizedObj } : {};

    // If file was downloaded, inject files array for extractFileIdToTopLevel to process
    if (fileId && fileMeta) {
      responseData.files = [
        {
          fileId: fileMeta.fileId,
          canvasId: fileMeta.canvasId,
          name: fileMeta.name,
          mimeType: fileMeta.type,
          summary: 'Downloaded file from external service.',
        },
      ];
    }

    // Use extractFileIdToTopLevel to extract fileId and files to top level
    const extractedResponse = extractFileIdToTopLevel({
      success: isSuccessful,
      data: responseData,
    });

    // Build final content
    const rawContent = JSON.stringify(extractedResponse.data ?? {}, null, 2);
    const wasTruncated = estimateTokens(rawContent) > maxTokens;
    const content = truncateToTokens(rawContent, maxTokens);

    return {
      content,
      fileId,
      fileMeta,
      success: isSuccessful,
      wasTruncated,
    };
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
   * Returns compressed content, full content, and truncation status
   * - exa: search results with highlights
   * - tavily: search results with content
   */
  private compressContent(args: {
    toolsetKey: string;
    toolName: string;
    rawResult: unknown;
    maxTokens: number;
  }): CompressResult {
    const { toolsetKey, toolName, rawResult, maxTokens } = args;

    const rawObj: any =
      typeof rawResult === 'string' ? (safeParseJSON(rawResult) ?? rawResult) : rawResult;

    // Calculate full content for archiving
    const fullContent =
      typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult ?? {}, null, 2);

    // Non-object: simple truncation
    if (!rawObj || typeof rawObj !== 'object') {
      const content = truncateToTokens(fullContent, maxTokens);
      return {
        content,
        fullContent,
        wasTruncated: estimateTokens(fullContent) > maxTokens,
      };
    }

    const compressed: any = {
      toolsetKey,
      toolName,
      ...pick(rawObj, ['status', 'summary', 'error', 'message', 'successful']),
    };

    // Handle Composio response structure (data may be in different locations)
    const data = rawObj?.data ?? rawObj?.response ?? rawObj?.results ?? rawObj;

    const toolsetLower = toolsetKey.toLowerCase();
    let content: string;

    if (toolsetLower === 'exa') {
      content = this.compressExaResult(compressed, data, rawObj);
    } else if (toolsetLower === 'tavily') {
      content = this.compressTavilyResult(compressed, data, rawObj);
    } else {
      // Return original result for all other tools (no compression)
      content = fullContent;
    }

    return {
      content,
      fullContent,
      wasTruncated: estimateTokens(fullContent) > maxTokens,
    };
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
        results: filtered.map((item: any) => {
          const rawContent = String(
            item?.text ?? item?.highlights?.join('\n') ?? item?.snippet ?? '',
          );
          // All search content may contain web noise - use truncateAndFilterContent
          const { content } = truncateAndFilterContent(rawContent, MAX_SNIPPET_TOKENS);
          return {
            ...pick(item, ['title', 'url', 'score', 'publishedDate', 'author']),
            content,
          };
        }),
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
        results: filtered.map((item: any) => {
          const rawContent = String(item?.content ?? item?.snippet ?? item?.raw_content ?? '');
          // All search content may contain web noise - use truncateAndFilterContent
          const { content } = truncateAndFilterContent(rawContent, MAX_SNIPPET_TOKENS);
          return {
            ...pick(item, ['title', 'url', 'score', 'publishedDate']),
            content,
          };
        }),
      };

      if (originalCount > filtered.length) {
        compressed.truncated = { total: originalCount, kept: filtered.length };
      }
    } else {
      compressed.data = { results: [] };
    }

    // Include Tavily's AI-generated answer if available (no filtering needed for AI response)
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
      compressed.data = filtered.map((item: any) => {
        const rawContent = String(item?.content ?? item?.snippet ?? item?.text ?? '');
        // All search content may contain web noise - use truncateAndFilterContent
        const { content } = truncateAndFilterContent(rawContent, MAX_SNIPPET_TOKENS);
        return {
          ...pick(item, ['title', 'url', 'description', 'site', 'publishedTime', 'score']),
          content,
        };
      });

      if (originalCount > filtered.length) {
        compressed.truncated = { total: originalCount, kept: filtered.length };
      }
    } else if (data && typeof data === 'object') {
      compressed.data = { ...pick(data, ['url', 'title', 'model', 'usage', 'answer']) };

      // Web content - use truncateAndFilterContent
      if (data.content) {
        const { content } = truncateAndFilterContent(String(data.content), MAX_SNIPPET_TOKENS);
        compressed.data.content = content;
      }

      // AI response - no filtering needed
      if (data.response) {
        compressed.data.response = truncateContent(String(data.response), MAX_SNIPPET_TOKENS);
      }

      // Web content - use truncateAndFilterContent
      if (data.text) {
        const { content } = truncateAndFilterContent(String(data.text), MAX_SNIPPET_TOKENS);
        compressed.data.text = content;
      }

      if (Array.isArray(data.citations)) {
        compressed.data.citations = filterAndDedupeUrls(data.citations);
      }

      if (Array.isArray(data.results)) {
        const { filtered } = filterAndDedupeItems(data.results);
        compressed.data.results = filtered.map((r: any) => {
          const rawContent = String(r?.content ?? r?.snippet ?? r?.text ?? '');
          const { content } = truncateAndFilterContent(rawContent, MAX_SNIPPET_TOKENS);
          return {
            ...pick(r, ['title', 'url', 'score']),
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

  /**
   * Handle downloaded_file_content from Composio response
   * Downloads the file from s3url and uploads to Drive
   *
   * @param rawObj - The raw result object that may contain downloaded_file_content
   * @param outerMimeType - Optional mimeType from the outer data object (takes priority)
   * @param context - Post handler context with user and canvas info
   * @returns DriveFile if upload successful, null otherwise
   */
  private async handleDownloadedFileContent(
    rawObj: Record<string, unknown>,
    outerMimeType: string | undefined,
    context: PostHandlerInput['context'],
  ): Promise<DriveFile | null> {
    const data = rawObj?.data as Record<string, unknown> | undefined;
    const downloadedFileContent = data?.downloaded_file_content as
      | DownloadedFileContent
      | undefined;
    if (!downloadedFileContent?.s3url) {
      return null;
    }

    try {
      const { s3url, name, mimetype: innerMimeType } = downloadedFileContent;

      // Resolve MIME type
      const resolvedMimeType = this.resolveMimeType(
        outerMimeType,
        data?.mimeType as string | undefined,
        innerMimeType,
      );

      // Use name from downloaded_file_content or fallback
      let fileName = name || `downloaded_file_${Date.now()}`;
      let mimeType = resolvedMimeType;
      let fileContent: string | Buffer = s3url;

      // Check if Google format needs conversion
      if (this.isGoogleFormat(resolvedMimeType)) {
        this.logger.debug('Google format detected, downloading for conversion', {
          mimeType: resolvedMimeType,
          fileName,
        });

        // Download file first
        const response = await axios.get(s3url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // Convert Google format to standard format
        const converted = await this.convertGoogleFormat(buffer, resolvedMimeType, fileName);
        fileContent = converted.buffer;
        mimeType = converted.mimeType;
        fileName = converted.fileName;

        this.logger.debug('Conversion completed', {
          originalMimeType: resolvedMimeType,
          convertedMimeType: mimeType,
          convertedFileName: fileName,
        });
      }

      // Upload the file
      const driveFile = await this.resourceHandler.uploadResource(
        context.user as User,
        context.canvasId,
        fileContent,
        fileName,
        {
          resultId: context.resultId,
          resultVersion: context.resultVersion,
          mimeType,
        },
      );

      return driveFile;
    } catch (error) {
      this.logger.error('Failed to handle downloaded file content', {
        error: (error as Error)?.message,
        stack: (error as Error)?.stack,
        s3url: downloadedFileContent?.s3url,
        resolvedMimeType: this.resolveMimeType(
          outerMimeType,
          data?.mimeType as string | undefined,
          downloadedFileContent?.mimetype,
        ),
      });
      return null;
    }
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
