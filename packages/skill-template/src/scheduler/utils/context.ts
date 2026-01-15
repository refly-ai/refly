import { ActionResult, SkillContext, ToolCallResult } from '@refly/openapi-schema';
import { countToken } from '@refly/utils/token';
import { SkillEngine } from '../../engine';

// ============================================================================
// Summary extraction keywords - used to find conclusion/summary sections
// ============================================================================

const SUMMARY_KEYWORDS = [
  // Chinese - completion
  '已完成',
  '完成了',
  '实现了',
  '搞定',
  '做好了',
  // Chinese - summary
  '总结',
  '综上',
  '因此',
  '总的来说',
  '最终',
  '结论',
  // English - completion
  'done',
  'completed',
  'finished',
  "i've implemented",
  'i have implemented',
  "i've created",
  "i've added",
  "i've updated",
  "i've fixed",
  // English - summary
  'in summary',
  'to summarize',
  'in conclusion',
  'finally',
  'as a result',
];

// Maximum tokens for summary extraction
const MAX_SUMMARY_TOKENS = 100;

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
// Metadata-only types for on-demand result reading
// These types are used to reduce context size - LLM reads full content via tools
// ============================================================================

/**
 * Metadata for a tool call within an agent result
 * Used in AgentResultMeta to provide summary of tool calls without full input/output
 */
export interface ToolCallMeta {
  /** Tool call ID for retrieval via read_tool_result */
  callId: string;
  /** Name of the tool that was called */
  toolName: string;
  /** Execution status */
  status: 'success' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Files produced by this tool call */
  outputFiles?: {
    fileId: string;
    fileName: string;
  }[];
}

/**
 * Metadata-only version of AgentResult (without full content)
 * Used in ContextBlock to reduce token usage - LLM should use read_agent_result to get full content
 */
export interface AgentResultMeta {
  /** Result ID for retrieval via read_agent_result */
  resultId: string;
  /** Title/description of the task */
  title: string;
  /** Execution status */
  status: 'success' | 'failed';
  /** Summary extracted from content (max 300 tokens) */
  summary: string;
  /** Token count of full content (helps LLM decide if worth reading) */
  contentTokens: number;
  /** Creation timestamp */
  createdAt: string;
  /** Summary of tool calls made during execution */
  toolCallsMeta: ToolCallMeta[];
  /** Files produced by this result */
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
  /** Metadata-only results for on-demand reading via read_agent_result tool */
  resultsMeta?: AgentResultMeta[];
  totalTokens?: number;
  /**
   * Protected routing table for archived/compressed content references.
   * This field is NEVER truncated during context compression.
   * Allows model to quickly identify and retrieve archived data.
   */
  archivedRefs?: ArchivedRef[];
}

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
 * Truncate content from the end, keeping approximately maxTokens worth of content.
 * Tries to start from a sentence boundary for cleaner truncation.
 */
function truncateFromEnd(content: string, maxTokens: number): string {
  if (!content) return '';

  const estimatedChars = maxTokens * 3.5;

  // If content is shorter than limit, return as-is
  if (content.length <= estimatedChars) {
    return content.trim();
  }

  const tail = content.slice(-estimatedChars);
  const truncationMarker = '... [TRUNCATED DUE TO LENGTH LIMIT] ';

  // Try to start from a sentence boundary (within first 30% of tail)
  const sentenceStart = tail.search(/[.。!！?？\n]\s*/);
  if (sentenceStart !== -1 && sentenceStart < tail.length * 0.3) {
    return truncationMarker + tail.slice(sentenceStart + 1).trim();
  }

  return truncationMarker + tail.trim();
}

/**
 * Extract summary from content by:
 * 1. Looking for summary keywords (e.g., "已完成", "completed", "in summary") from the end
 * 2. If found, extract from that point to the end
 * 3. If not found or too long, fallback to taking the last maxTokens from content
 */
export function extractSummaryFromContent(
  content: string,
  maxTokens: number = MAX_SUMMARY_TOKENS,
): string {
  if (!content) return '';

  // Search for summary keywords from the end
  let bestMatchIndex = -1;
  const lowerContent = content.toLowerCase();

  for (const keyword of SUMMARY_KEYWORDS) {
    const index = lowerContent.lastIndexOf(keyword.toLowerCase());
    if (index > bestMatchIndex) {
      bestMatchIndex = index;
    }
  }

  if (bestMatchIndex !== -1) {
    // Found a keyword, expand to paragraph start
    const paragraphStart = content.lastIndexOf('\n\n', bestMatchIndex);
    const startIndex = paragraphStart !== -1 ? paragraphStart + 2 : bestMatchIndex;
    const summary = content.slice(startIndex).trim();

    // Check if summary is within token limit
    if (countToken(summary) <= maxTokens) {
      return summary;
    }
  }

  // No keyword found or too long, fallback to taking last maxTokens
  return truncateFromEnd(content, maxTokens);
}

/**
 * Build ToolCallMeta array from ToolCallResult array
 * Extracts only metadata needed for context, full content available via read_tool_result
 */
export function buildToolCallsMeta(toolCalls: ToolCallResult[] | undefined): ToolCallMeta[] {
  if (!toolCalls || !Array.isArray(toolCalls)) return [];

  return toolCalls.map((tc) => ({
    callId: tc.callId,
    toolName: tc.toolName || 'unknown',
    status: tc.status === 'completed' ? 'success' : 'failed',
    ...(tc.error && { error: tc.error.slice(0, 200) }), // Truncate error message
    // Note: outputFiles from toolCall may need to be mapped from a different structure
    // This depends on how tool results store file references
  }));
}

/**
 * Extract ToolCallResult array from ActionResult
 * Prioritizes result.toolCalls, falls back to extracting from messages
 */
function extractToolCalls(result: ActionResult): ToolCallResult[] {
  // Priority 1: Use toolCalls array if available
  if (result.toolCalls && Array.isArray(result.toolCalls) && result.toolCalls.length > 0) {
    return result.toolCalls;
  }

  // Priority 2: Extract from messages (toolCallResult is attached to tool type messages)
  if (result.messages && Array.isArray(result.messages)) {
    const toolCalls: ToolCallResult[] = [];
    for (const msg of result.messages) {
      if (msg?.type === 'tool' && msg.toolCallResult) {
        toolCalls.push(msg.toolCallResult);
      }
    }
    return toolCalls;
  }

  return [];
}

/**
 * Build AgentResultMeta from ActionResult
 * Extracts metadata and summary for context, full content available via read_agent_result
 */
export function buildAgentResultMeta(result: ActionResult): AgentResultMeta {
  // Extract full content for summary generation
  let fullContent = extractResultContent(result);
  fullContent = stripToolUseBlocks(fullContent);
  const contentTokens = countToken(fullContent);

  // Generate summary from content
  const summary = extractSummaryFromContent(fullContent, MAX_SUMMARY_TOKENS);

  // Build tool calls metadata - extract from result.toolCalls or messages
  const toolCalls = extractToolCalls(result);
  const toolCallsMeta = buildToolCallsMeta(toolCalls);

  return {
    resultId: result.resultId,
    title: result.title || 'Untitled',
    status: result.status === 'finish' ? 'success' : 'failed',
    summary,
    contentTokens,
    createdAt: result.createdAt || new Date().toISOString(),
    toolCallsMeta,
    outputFiles:
      result.files?.map((f) => ({
        name: f.name ?? 'Untitled File',
        fileId: f.fileId ?? 'unknown',
        type: f.type ?? 'unknown',
        summary: f.summary ?? '',
      })) ?? [],
  };
}

/**
 * Prepare context from SkillContext into a structured ContextBlock format
 * Filters files and results based on token limits estimated from their content
 */
export async function prepareContext(
  context: SkillContext,
  _options?: {
    maxTokens?: number;
    engine?: SkillEngine;
    summarizerConcurrentLimit?: number;
  },
): Promise<ContextBlock> {
  if (!context) {
    return { files: [], totalTokens: 0 };
  }

  const selectedFiles: ContextFileMeta[] = [];
  const selectedResultsMeta: AgentResultMeta[] = [];
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

  // Process results - only store metadata with summary
  // LLM should use read_agent_result/read_tool_result tools to get full content
  if (context?.results?.length > 0) {
    for (const item of context.results) {
      const result = item?.result;
      if (!result) continue;

      const meta = buildAgentResultMeta(result);

      // Estimate tokens for metadata (summary + other fields)
      const metaTokens = estimateTokens(JSON.stringify(meta));
      currentTokens += metaTokens;

      selectedResultsMeta.push(meta);
    }
  }

  return {
    files: selectedFiles,
    resultsMeta: selectedResultsMeta,
    totalTokens: currentTokens,
  };
}
