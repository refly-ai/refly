import { ActionResult, SkillContext } from '@refly/openapi-schema';
import { countToken } from '@refly/utils/token';
import { SkillEngine } from '../../engine';
import { truncateContent } from './token';

// Regex to match and remove tool_use code blocks from content
// This prevents the model from seeing and copying these internal XML patterns
// Matches both markdown code block format and standalone XML tags:
// 1. ```tool_use\n<tool_use>...</tool_use>\n```
// 2. <tool_use>...</tool_use> (standalone)
const TOOL_USE_BLOCK_REGEX = /\n*```tool_use(?:_result)?[^\n]*\n[\s\S]*?```\n*/g;
const TOOL_USE_TAG_REGEX = /<tool_use[\s\S]*?<\/tool_use>/g;

export interface ContextFile {
  name: string;
  fileId: string;
  type: string;
  summary: string;
  content: string;
  variableId?: string;
  variableName?: string;
}

/**
 * Metadata-only version of ContextFile (without content)
 * Used in ContextBlock to reduce token usage - LLM should use read_file to get full content
 */
export interface ContextFileMeta {
  name: string;
  fileId: string;
  type: string;
  summary: string;
  variableId?: string;
  variableName?: string;
}

export interface AgentResult {
  resultId: string;
  title: string;
  content: string;
  outputFiles: ContextFileMeta[];
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
  files: ContextFileMeta[];
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

/**
 * Strip tool_use code blocks from content.
 *
 * When previous result content is included in the context, it may contain
 * ```tool_use ... ``` blocks that were used for frontend rendering.
 * If the model sees these XML patterns, it may copy them as text output
 * instead of actually invoking tools. This function removes such blocks.
 */
function stripToolUseBlocks(content: string): string {
  if (!content) return content;
  // First remove markdown code blocks, then any remaining standalone XML tags
  return content.replace(TOOL_USE_BLOCK_REGEX, '\n').replace(TOOL_USE_TAG_REGEX, '').trim();
}

/**
 * Extract content from ActionResult, preferring messages over steps.
 *
 * Priority order:
 * 1. Messages (action_messages table) - cleanly separated AI and tool messages
 * 2. Steps (action_steps table) - fallback for backward compatibility
 *
 * Using messages avoids XML-formatted tool calls in the context, which prevents
 * the model from learning incorrect patterns.
 */
function extractResultContent(result: ActionResult): string {
  if (!result) return '';

  // Priority 1: Use messages if available (preferred)
  if (result.messages && Array.isArray(result.messages) && result.messages.length > 0) {
    return result.messages
      .filter((msg: any) => msg?.type === 'ai') // Only include AI messages
      .map((msg: any) => {
        // Combine reasoning content and regular content
        const reasoning = msg?.reasoningContent || '';
        const content = msg?.content || '';
        return reasoning ? `${reasoning}\n\n${content}` : content;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  // Priority 2: Fallback to steps for backward compatibility
  if (result.steps && Array.isArray(result.steps)) {
    return result.steps.map((step: any) => step?.content || '').join('\n\n');
  }

  return '';
}

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
  const selectedFiles: ContextFileMeta[] = [];
  const selectedResults: AgentResult[] = [];
  let currentTokens = 0;

  // Helper function to estimate tokens for content
  const estimateTokens = (content: string): number => {
    return countToken(content);
  };

  // Process files - only store metadata (no content) to save tokens
  // LLM should use read_file tool to get full content when needed
  if (context?.files?.length > 0) {
    for (const item of context.files) {
      const file = item?.file;
      if (!file) continue;

      const contextFile: ContextFileMeta = {
        name: file?.name ?? 'Untitled File',
        fileId: file?.fileId ?? 'unknown',
        type: file?.type ?? 'unknown',
        summary: file?.summary ?? '',
        ...(item.variableId && { variableId: item.variableId }),
        ...(item.variableName && { variableName: item.variableName }),
      };

      selectedFiles.push(contextFile);
    }
  }

  // Process results with token estimation
  if (context?.results?.length > 0) {
    // Sort results by content length (shortest first) to prioritize smaller results
    // This ensures shorter results are less likely to be truncated later
    const sortedResults = [...context.results].sort((a, b) => {
      // Prefer using messages for content estimation if available
      const aContent = extractResultContent(a?.result);
      const bContent = extractResultContent(b?.result);
      return aContent.length - bContent.length;
    });

    for (const item of sortedResults) {
      const result = item?.result;
      if (!result) continue;

      // Extract content from result, preferring messages over steps
      // Messages provide cleaner separation between AI responses and tool calls
      let resultContent = extractResultContent(result);
      resultContent = stripToolUseBlocks(resultContent);
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
        title: result?.title ?? 'Untitled Agent',
        content: resultContent,
        // outputFiles only contain metadata (no content) to save tokens
        // LLM should use read_file tool to get full content when needed
        outputFiles:
          result?.files?.map((file) => ({
            name: file?.name ?? 'Untitled File',
            fileId: file?.fileId ?? 'unknown',
            type: file?.type ?? 'unknown',
            summary: file?.summary ?? '',
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
