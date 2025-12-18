import { SkillContext } from '@refly/openapi-schema';
import { encode } from 'gpt-tokenizer';
import { SkillEngine } from '../../engine';
import { truncateContent } from './token';

export interface ContextFile {
  name: string;
  fileId: string;
  type: string;
  summary: string;
  content: string;
  variableId?: string;
  variableName?: string;
}

export interface AgentResult {
  resultId: string;
  title: string;
  content: string;
  outputFiles: ContextFile[];
}

// ============================================================================
// Archived Reference - Protected routing table for compressed/archived content
// This field is NEVER truncated and allows quick retrieval of archived data
// ============================================================================

export type ArchivedRefType = 'search_result' | 'chat_history' | 'tool_output' | 'context_file';

export interface ArchivedRef {
  /** Unique file ID for retrieval */
  fileId: string;
  /** Type of archived content */
  type: ArchivedRefType;
  /** Source identifier (tool name, "history", file name, etc.) */
  source: string;
  /** Brief description of archived content */
  summary: string;
  /** Timestamp when archived */
  archivedAt: number;
  /** Tokens saved by archiving */
  tokensSaved: number;
  /** Optional: original item count (messages, results, etc.) */
  itemCount?: number;
}

export interface ContextBlock {
  files: ContextFile[];
  results: AgentResult[];
  totalTokens?: number;
  /**
   * Protected routing table for archived/compressed content references.
   * This field is NEVER truncated during context compression.
   * Allows model to quickly identify and retrieve archived data.
   */
  archivedRefs?: ArchivedRef[];
}

// Maximum tokens for a single result/file to prevent one item from consuming too much space
// Can be overridden via environment variables
const MAX_SINGLE_RESULT_TOKENS = Number(process.env.MAX_SINGLE_RESULT_TOKENS) || 30000;
const MAX_SINGLE_FILE_TOKENS = Number(process.env.MAX_SINGLE_FILE_TOKENS) || 20000;

/**
 * Prepare context from SkillContext into a structured ContextBlock format
 * Filters files and results based on token limits estimated from their content
 */
export async function prepareContext(
  context: SkillContext,
  options: {
    maxTokens: number;
    engine: SkillEngine;
    summarizerConcurrentLimit?: number;
  },
): Promise<ContextBlock> {
  if (!context) {
    return { files: [], results: [], totalTokens: 0 };
  }

  const maxTokens = options?.maxTokens ?? 0;
  const selectedFiles: ContextFile[] = [];
  const selectedResults: AgentResult[] = [];
  let currentTokens = 0;

  // Helper function to estimate tokens for content
  const estimateTokens = (content: string): number => {
    return encode(content ?? '').length;
  };

  // Process files with token estimation
  if (context?.files?.length > 0) {
    // Sort files by content length (shortest first) to prioritize smaller files
    // This ensures shorter files are less likely to be truncated later
    const sortedFiles = [...context.files].sort((a, b) => {
      const aContent = a?.file?.content ?? '';
      const bContent = b?.file?.content ?? '';
      return aContent.length - bContent.length;
    });

    for (const item of sortedFiles) {
      const file = item?.file;
      if (!file) continue;

      let fileContent = file?.content ?? '';
      let contentTokens = estimateTokens(fileContent);

      // Truncate single file if it exceeds the limit
      if (contentTokens > MAX_SINGLE_FILE_TOKENS) {
        fileContent = truncateContent(fileContent, MAX_SINGLE_FILE_TOKENS);
        contentTokens = estimateTokens(fileContent);
      }

      // Check if adding this file would exceed token limit
      if (maxTokens > 0 && currentTokens + contentTokens > maxTokens) {
        // If we can't add the full file, skip it
        continue;
      }

      const contextFile: ContextFile = {
        name: file?.name ?? 'Untitled File',
        fileId: file?.fileId ?? 'unknown',
        type: file?.type ?? 'unknown',
        summary: file?.summary ?? '',
        content: fileContent,
        ...(item.variableId && { variableId: item.variableId }),
        ...(item.variableName && { variableName: item.variableName }),
      };

      selectedFiles.push(contextFile);
      currentTokens += contentTokens;
    }
  }

  // Process results with token estimation
  if (context?.results?.length > 0) {
    // Sort results by content length (shortest first) to prioritize smaller results
    // This ensures shorter results are less likely to be truncated later
    const sortedResults = [...context.results].sort((a, b) => {
      const aContent = a?.result?.steps?.map((step) => step.content).join('\n\n') ?? '';
      const bContent = b?.result?.steps?.map((step) => step.content).join('\n\n') ?? '';
      return aContent.length - bContent.length;
    });

    for (const item of sortedResults) {
      const result = item?.result;
      if (!result) continue;

      let resultContent = result?.steps?.map((step) => step.content).join('\n\n') ?? '';
      let contentTokens = estimateTokens(resultContent);

      // Truncate single result if it exceeds the limit
      if (contentTokens > MAX_SINGLE_RESULT_TOKENS) {
        resultContent = truncateContent(resultContent, MAX_SINGLE_RESULT_TOKENS);
        contentTokens = estimateTokens(resultContent);
      }

      // Check if adding this result would exceed token limit
      if (maxTokens > 0 && currentTokens + contentTokens > maxTokens) {
        // If we can't add the full result, skip it
        continue;
      }

      const agentResult: AgentResult = {
        resultId: result?.resultId ?? 'unknown',
        title: result?.title ?? 'Untitled Result',
        content: resultContent,
        outputFiles:
          result?.files?.map((file) => ({
            name: file?.name ?? 'Untitled File',
            fileId: file?.fileId ?? 'unknown',
            type: file?.type ?? 'unknown',
            summary: file?.summary ?? '',
            content: file?.content ?? '',
          })) ?? [],
      };

      selectedResults.push(agentResult);
      currentTokens += contentTokens;
    }
  }

  return {
    files: selectedFiles,
    results: selectedResults,
    totalTokens: currentTokens,
  };
}
