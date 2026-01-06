/**
 * DocumentInterpreterService - Analyzes PDF documents using Gemini multimodal API
 * Supports native visual understanding of documents including charts, tables, and layouts
 */

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { GeminiClientInstance } from './client.service';
import { GeminiFileStoreService } from './file-store.service';
import { buildDocumentAnalysisPrompt } from './prompts';
import type {
  MediaInput,
  DocumentInterpretRequest,
  BatchDocumentInterpretRequest,
  TableData,
  DocumentStructure,
  GeminiFileRef,
  DocumentInterpretResultWithUsage,
  BatchDocumentInterpretResultWithUsage,
  MultimodalTokenUsage,
} from './types';
import { MultimodalError, MultimodalErrorCode } from './types';
import * as fs from 'node:fs/promises';

/** Maximum document file size (50MB per Gemini API) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Maximum page count (1000 pages per Gemini API) */
const _MAX_PAGE_COUNT = 1000;

/**
 * Service for interpreting document content using Gemini multimodal API
 */
@Injectable()
export class DocumentInterpreterService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly fileStoreService: GeminiFileStoreService,
  ) {
    this.logger.setContext(DocumentInterpreterService.name);
  }

  /**
   * Interpret document content and return structured analysis with token usage
   */
  async interpret(
    client: GeminiClientInstance,
    request: DocumentInterpretRequest,
  ): Promise<DocumentInterpretResultWithUsage> {
    const { document, query, mode = 'summary', pageRange } = request;

    // Validate document input
    if (!document.buffer && !document.filePath && !document.url) {
      throw new MultimodalError(
        'Document input must have buffer, filePath, or url',
        MultimodalErrorCode.INVALID_CONFIG,
        false,
      );
    }

    // Check file size if buffer is provided
    if (document.buffer && document.buffer.length > MAX_FILE_SIZE) {
      throw new MultimodalError(
        'Document file exceeds 50MB limit. Please use a smaller document.',
        MultimodalErrorCode.DOCUMENT_TOO_LARGE,
        false,
        { maxSize: '50MB', actualSize: `${(document.buffer.length / (1024 * 1024)).toFixed(2)}MB` },
      );
    }

    // Validate MIME type
    if (document.mimeType !== 'application/pdf') {
      throw new MultimodalError(
        `Unsupported document type: ${document.mimeType}. Only PDF is supported.`,
        MultimodalErrorCode.UNSUPPORTED_TYPE,
        false,
      );
    }

    // Always use File API for documents (more efficient than inline base64 for PDFs)
    let fileRef: GeminiFileRef;
    try {
      fileRef = await this.fileStoreService.uploadFile({
        buffer: document.buffer,
        filePath: document.filePath,
        url: document.url,
        mimeType: document.mimeType,
        name: document.name,
        cacheKey: document.cacheKey,
      });
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to upload document: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.UPLOAD_FAILED,
        true,
      );
    }

    // Build analysis prompt
    const prompt = buildDocumentAnalysisPrompt({ query, mode, pageRange });

    // Generate analysis using File API
    try {
      const result = await client.generateFromFiles(prompt, [fileRef]);

      // Extract tables if in extract mode
      const tables = mode === 'extract' ? this.parseTables(result.text) : undefined;

      // Build token usage from response metadata
      const tokenUsage: MultimodalTokenUsage | undefined = result.usageMetadata
        ? {
            promptTokens: result.usageMetadata.promptTokenCount,
            outputTokens: result.usageMetadata.candidatesTokenCount,
            totalTokens: result.usageMetadata.totalTokenCount,
            cachedContentTokens: result.usageMetadata.cachedContentTokenCount,
            modalityType: 'document',
          }
        : undefined;

      return {
        analysis: result.text,
        tables,
        structure: undefined, // Structure parsing is complex, can be added later
        fileRef,
        tokenUsage,
      };
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to analyze document: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Extract tables from a document
   */
  async extractTables(client: GeminiClientInstance, document: MediaInput): Promise<TableData[]> {
    const prompt = `Extract all tables from this document and format them as markdown tables.

## Guidelines
- Extract every table found in the document
- Preserve all column headers and row data
- Include table captions or titles if present
- Note the page number where each table appears
- Format each table as a markdown table

For each table, output in this format:
### Table [N]: [Title or description]
Page: [page number]

| Header1 | Header2 | Header3 |
|---------|---------|---------|
| data    | data    | data    |

Extract the tables:`;

    const fileRef = await this.fileStoreService.uploadFile({
      buffer: document.buffer,
      filePath: document.filePath,
      url: document.url,
      mimeType: document.mimeType,
      cacheKey: document.cacheKey,
    });

    const result = await client.generateFromFiles(prompt, [fileRef]);
    return this.parseTables(result.text);
  }

  /**
   * Extract document structure (TOC, sections, headings)
   */
  async extractStructure(
    client: GeminiClientInstance,
    document: MediaInput,
  ): Promise<DocumentStructure> {
    const prompt = `Analyze the structure of this document.

## Guidelines
- Identify the document title
- Extract the table of contents or section headings
- Note heading levels (H1, H2, H3, etc.)
- Include page numbers if visible
- Count total pages

Output in JSON format:
{
  "title": "Document title",
  "pageCount": number,
  "sections": [
    { "title": "Section name", "level": 1, "pageNumber": 1 },
    { "title": "Subsection name", "level": 2, "pageNumber": 3 }
  ]
}

Extract the structure:`;

    const fileRef = await this.fileStoreService.uploadFile({
      buffer: document.buffer,
      filePath: document.filePath,
      url: document.url,
      mimeType: document.mimeType,
      cacheKey: document.cacheKey,
    });

    const result = await client.generateFromFiles(prompt, [fileRef]);

    try {
      // Try to parse JSON from the result
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || undefined,
          pageCount: parsed.pageCount || 0,
          sections: (parsed.sections || []).map(
            (s: { title: string; level: number; pageNumber?: number }) => ({
              title: s.title,
              level: s.level,
              pageNumber: s.pageNumber,
            }),
          ),
        };
      }
    } catch {
      this.logger.warn('Failed to parse document structure JSON');
    }

    return {
      title: undefined,
      pageCount: 0,
      sections: [],
    };
  }

  /**
   * Answer a specific question about the document
   */
  async answerQuestion(
    client: GeminiClientInstance,
    document: MediaInput,
    question: string,
  ): Promise<string> {
    const result = await this.interpret(client, {
      document,
      query: question,
      mode: 'qa',
    });

    return result.analysis;
  }

  /**
   * Parse markdown tables from analysis output
   */
  private parseTables(content: string): TableData[] {
    const tables: TableData[] = [];
    const tableRegex =
      /###\s*Table\s*\[?(\d+)\]?:?\s*(.+?)?\n(?:Page:\s*(\d+)\n)?\n?((?:\|.+\|[\r\n]+)+)/g;

    for (const match of content.matchAll(tableRegex)) {
      const title = match[2]?.trim() || `Table ${match[1]}`;
      const pageNumber = match[3] ? Number.parseInt(match[3], 10) : undefined;
      const tableContent = match[4];

      // Parse markdown table
      const lines = tableContent.trim().split('\n');
      if (lines.length < 2) continue;

      // Extract headers from first line
      const headers = lines[0]
        .split('|')
        .filter((c) => c.trim())
        .map((c) => c.trim());

      // Skip separator line and extract rows
      const rows: string[][] = [];
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i]
          .split('|')
          .filter((c) => c.trim())
          .map((c) => c.trim());
        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      tables.push({ title, headers, rows, pageNumber });
    }

    return tables;
  }

  /**
   * Batch interpret multiple documents in a single API call
   * Uses File API for documents >= 2MB, inline base64 for smaller documents
   */
  async batchInterpret(
    client: GeminiClientInstance,
    request: BatchDocumentInterpretRequest,
  ): Promise<BatchDocumentInterpretResultWithUsage> {
    const { documents, query, mode = 'summary' } = request;

    if (!documents || documents.length === 0) {
      throw new MultimodalError(
        'At least one document is required',
        MultimodalErrorCode.INVALID_CONFIG,
        false,
      );
    }

    // Validate all documents
    for (const doc of documents) {
      if (!doc.buffer && !doc.filePath && !doc.url) {
        throw new MultimodalError(
          'Each document must have buffer, filePath, or url',
          MultimodalErrorCode.INVALID_CONFIG,
          false,
        );
      }

      // Check file size
      const size = await this.getDocumentSize(doc);
      if (size > MAX_FILE_SIZE) {
        throw new MultimodalError(
          `Document ${doc.name || 'unknown'} exceeds 50MB limit`,
          MultimodalErrorCode.DOCUMENT_TOO_LARGE,
          false,
        );
      }

      // Validate MIME type
      if (doc.mimeType !== 'application/pdf') {
        throw new MultimodalError(
          `Unsupported document type: ${doc.mimeType}. Only PDF is supported.`,
          MultimodalErrorCode.UNSUPPORTED_TYPE,
          false,
        );
      }
    }

    const fileRefs: GeminiFileRef[] = [];
    const docNames: (string | undefined)[] = [];

    // Always use File API for all documents
    for (const doc of documents) {
      docNames.push(doc.name);
      try {
        const fileRef = await this.fileStoreService.uploadFile({
          buffer: doc.buffer,
          filePath: doc.filePath,
          url: doc.url,
          mimeType: doc.mimeType,
          name: doc.name,
          cacheKey: doc.cacheKey,
        });
        fileRefs.push(fileRef);
      } catch (error) {
        if (error instanceof MultimodalError) {
          throw error;
        }
        throw new MultimodalError(
          `Failed to upload document ${doc.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
          MultimodalErrorCode.UPLOAD_FAILED,
          true,
        );
      }
    }

    // Build prompt for batch analysis
    const docCount = documents.length;
    const prompt = this.buildBatchPrompt(docCount, query, mode, docNames);

    // Generate analysis using File API
    try {
      const result = await client.generateFromFiles(prompt, fileRefs);

      // Build token usage from response metadata
      const tokenUsage: MultimodalTokenUsage | undefined = result.usageMetadata
        ? {
            promptTokens: result.usageMetadata.promptTokenCount,
            outputTokens: result.usageMetadata.candidatesTokenCount,
            totalTokens: result.usageMetadata.totalTokenCount,
            cachedContentTokens: result.usageMetadata.cachedContentTokenCount,
            modalityType: 'document',
          }
        : undefined;

      return {
        analysis: result.text,
        fileRefs,
        tokenUsage,
      };
    } catch (error) {
      if (error instanceof MultimodalError) {
        throw error;
      }
      throw new MultimodalError(
        `Failed to analyze documents: ${error instanceof Error ? error.message : String(error)}`,
        MultimodalErrorCode.GENERATION_FAILED,
        true,
      );
    }
  }

  /**
   * Get document size in bytes
   */
  private async getDocumentSize(doc: MediaInput): Promise<number> {
    if (doc.buffer) {
      return doc.buffer.length;
    }
    if (doc.filePath) {
      const stats = await fs.stat(doc.filePath);
      return stats.size;
    }
    // For URLs, assume max size (will use File API anyway)
    return MAX_FILE_SIZE;
  }

  /**
   * Build prompt for batch document analysis
   */
  private buildBatchPrompt(
    docCount: number,
    query: string | undefined,
    mode: 'summary' | 'extract' | 'qa',
    docNames: (string | undefined)[],
  ): string {
    const docList = docNames
      .map((name, i) => `${i + 1}. ${name || `Document ${i + 1}`}`)
      .join('\n');

    const basePrompt = buildDocumentAnalysisPrompt({ query, mode });

    return `You are analyzing ${docCount} PDF document${docCount > 1 ? 's' : ''}.

## Documents
${docList}

${basePrompt}

Provide a unified analysis covering all documents. When referencing specific content, indicate which document it comes from.`;
  }
}
