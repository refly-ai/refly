/**
 * Context Manager
 *
 * This module handles context truncation for LLM prompts.
 * For tool result post-processing, see ../post-handler.ts
 */

import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import type { LLMModelConfig, User, DriveFile } from '@refly/openapi-schema';
import type { ReflyService } from '@refly/agent-tools';
import type { ContextBlock, ArchivedRef, ArchivedRefType } from '../scheduler/utils/context';
import {
  truncateContentFast,
  estimateToken,
  estimateMessagesTokens,
} from '../scheduler/utils/token';

// ============================================================================
// Constants (only for item-level limits, not token budgets)
// ============================================================================

const DEFAULT_MAX_CONTEXT_FILES = 100;
const DEFAULT_MAX_CONTEXT_RESULTS = 100;
const DEFAULT_MAX_CONTEXT_OUTPUT_FILES = 100;
const DEFAULT_MIN_CONTEXT_ITEM_CONTENT_TOKENS = 1000;

// History compression thresholds
const REMAINING_SPACE_THRESHOLD = 0.2; // 20%
const HISTORY_COMPRESS_RATIO = 0.7; // 70% archived, 30% kept

/**
 * Minimum tokens required for prompt caching by model family.
 */
export const CACHE_MIN_TOKENS = 4096;

/**
 * Number of messages to keep in cache prefix (after system message)
 */
const CACHE_PREFIX_MESSAGE_COUNT = 2;

// Maximum tokens to keep per ToolMessage after truncation
const MAX_TOOL_MESSAGE_TOKENS = 4096;

// ============================================================================
// Types for History Compression
// ============================================================================

/** Logger interface for context manager */
export interface ContextManagerLogger {
  info: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
}

export interface HistoryCompressionContext {
  user: User;
  canvasId: string;
  resultId: string;
  resultVersion: number;
  service: ReflyService;
  logger?: ContextManagerLogger;
  modelInfo?: LLMModelConfig;
}

export interface HistoryCompressionResult {
  /** Compressed chat history (with early messages replaced by reference) */
  compressedHistory: BaseMessage[];
  /** Whether compression occurred */
  wasCompressed: boolean;
  /** DriveFile ID if history was uploaded */
  historyFileId?: string;
  /** DriveFile object if uploaded */
  historyFile?: DriveFile;
  /** Number of messages archived */
  archivedMessageCount: number;
  /** Tokens saved by compression */
  tokensSaved: number;
}

// ============================================================================
// History Compression Utilities
// ============================================================================

/**
 * Serialize messages to a readable format for file storage
 */
function serializeMessagesForFile(messages: BaseMessage[]): string {
  const serialized = messages.map((msg, idx) => {
    const role = msg.type;
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

    // Include tool call info for AI messages
    const toolCalls = (msg as AIMessage).tool_calls;
    const toolCallsStr = toolCalls?.length
      ? `\n[Tool Calls: ${toolCalls.map((tc) => tc.name).join(', ')}]`
      : '';

    // Include tool call id for tool messages
    const toolCallId = (msg as ToolMessage).tool_call_id;
    const toolCallIdStr = toolCallId ? ` (tool_call_id: ${toolCallId})` : '';

    return `--- Message ${idx + 1} [${role}]${toolCallIdStr} ---\n${content}${toolCallsStr}`;
  });

  return serialized.join('\n\n');
}

/**
 * Create an AIMessage that references the archived history file.
 * Using AIMessage (instead of HumanMessage) avoids tool_use/tool_result pairing issues
 * when replacing archived tool calls.
 *
 * Pattern:
 *   Before: [Human1][AI(tool_call:A)][Tool(A)][Human2]
 *   After:  [Human1][AI("Tool calls archived...")][Human2]
 */
function createHistoryReferenceMessage(
  fileId: string,
  archivedCount: number,
  summary: string,
): AIMessage {
  return new AIMessage({
    content: `[Earlier conversation (${archivedCount} messages including tool calls) has been archived to file: ${fileId}]\n\nSummary: ${summary}\n\nYou can use read_file tool to retrieve details if needed.`,
  });
}

/**
 * Generate a brief summary of archived messages
 */
function generateHistorySummary(messages: BaseMessage[]): string {
  const messageTypes: Record<string, number> = {};
  const toolsUsed: Set<string> = new Set();

  for (const msg of messages) {
    const type = msg.type;
    messageTypes[type] = (messageTypes[type] || 0) + 1;

    // Track tool usage
    const toolCalls = (msg as AIMessage).tool_calls;
    if (toolCalls?.length) {
      for (const tc of toolCalls) {
        toolsUsed.add(tc.name);
      }
    }
  }

  const typeSummary = Object.entries(messageTypes)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');

  const toolSummary = toolsUsed.size > 0 ? `\nTools used: ${Array.from(toolsUsed).join(', ')}` : '';

  return `${typeSummary} messages${toolSummary}`;
}

/**
 * Upload history to DriveFile
 */
async function uploadHistoryToFile(args: {
  messages: BaseMessage[];
  context: HistoryCompressionContext;
}): Promise<{ fileId?: string; driveFile?: DriveFile }> {
  const { messages, context } = args;

  if (!context.canvasId || !context.service) {
    return {};
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `chat-history-${timestamp}.txt`;
    const content = serializeMessagesForFile(messages);

    const driveFile = await context.service.writeFile(context.user, {
      canvasId: context.canvasId,
      name: fileName,
      type: 'text/plain',
      content,
      summary: `Archived chat history (${messages.length} messages, ${content.length} chars)`,
      resultId: context.resultId,
      resultVersion: context.resultVersion,
      source: 'agent',
    });

    return { fileId: driveFile?.fileId, driveFile };
  } catch (error) {
    context.logger?.error?.('Failed to upload history to DriveFile', {
      error: (error as Error)?.message,
      messageCount: messages.length,
    });
    return {};
  }
}

// ============================================================================
// Cache-Friendly Compression Helper Functions
// ============================================================================

/** Message entry for compression tracking */
interface MessageEntry {
  msg: BaseMessage;
  index: number;
  tokens: number;
}

/** Tool pair group (AIMessage with tool_calls + corresponding ToolMessages) */
interface ToolPairGroup {
  aiMessage: MessageEntry;
  toolMessages: MessageEntry[];
  totalTokens: number;
  oldestIndex: number;
}

/**
 * Calculate cache prefix boundary index.
 * Messages before this index form the stable cache prefix and should never be compressed.
 *
 * Strategy:
 * 1. Always include System message (index 0)
 * 2. Add CACHE_PREFIX_MESSAGE_COUNT messages after system
 * 3. Ensure prefix has at least CACHE_MIN_TOKENS
 * 4. Return the first index that can be compressed
 */
function calculateCachePrefixBoundary(messages: BaseMessage[]): number {
  if (messages.length === 0) return 0;

  const minTokens = CACHE_MIN_TOKENS;

  // Start with system message (index 0) + CACHE_PREFIX_MESSAGE_COUNT
  let prefixEndIndex = 1 + CACHE_PREFIX_MESSAGE_COUNT;

  // Ensure we don't exceed message count
  prefixEndIndex = Math.min(prefixEndIndex, messages.length);

  // Accumulate tokens and extend prefix if needed to meet minimum
  let prefixTokens = 0;
  for (let i = 0; i < prefixEndIndex; i++) {
    prefixTokens += estimateToken(messages[i].content);
  }

  // Extend prefix until we meet minimum token requirement
  // Allow including all messages if needed to maximize cache effectiveness
  while (prefixEndIndex < messages.length && prefixTokens < minTokens) {
    prefixTokens += estimateToken(messages[prefixEndIndex].content);
    prefixEndIndex++;
  }

  // Adjust boundary to ensure tool pairing integrity
  // If the last message in prefix has tool_calls, include all its ToolMessages
  prefixEndIndex = adjustPrefixBoundaryForToolPairing(messages, prefixEndIndex);

  return prefixEndIndex;
}

/**
 * Adjust cache prefix boundary to ensure tool pairing integrity.
 * If the last message in the prefix has tool_calls, include all its ToolMessages.
 *
 * @param messages - All messages
 * @param initialPrefixEndIndex - Initial prefix boundary
 * @returns Adjusted prefix boundary that respects tool pairing
 */
function adjustPrefixBoundaryForToolPairing(
  messages: BaseMessage[],
  initialPrefixEndIndex: number,
): number {
  let prefixEndIndex = initialPrefixEndIndex;

  // Check if we need to extend the prefix to include ToolMessages
  while (prefixEndIndex > 0 && prefixEndIndex < messages.length) {
    const lastPrefixMsg = messages[prefixEndIndex - 1];

    // If last message in prefix has tool_calls, we need to include the results
    if (lastPrefixMsg.type === 'ai') {
      const toolCalls = (lastPrefixMsg as AIMessage).tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        // Find all corresponding ToolMessages and extend prefix
        let maxToolIndex = prefixEndIndex - 1;
        for (const tc of toolCalls) {
          for (let i = prefixEndIndex; i < messages.length; i++) {
            const msg = messages[i];
            if (msg.type === 'tool') {
              const toolCallId = (msg as ToolMessage).tool_call_id;
              if (toolCallId === tc.id) {
                maxToolIndex = Math.max(maxToolIndex, i);
              }
            }
          }
        }
        prefixEndIndex = maxToolIndex + 1;
      } else {
        break; // No tool calls, boundary is valid
      }
    } else {
      break; // Not an AI message with tool calls
    }
  }

  return prefixEndIndex;
}

/**
 * Calculate the end index of the compressible range.
 * Excludes recent messages based on the last message type to preserve context continuity.
 *
 * IMPORTANT: After adjustment by adjustEndIndexForToolPairing(), all messages in
 * [startIndex, endIndex) are guaranteed to be compressible without breaking tool pairs.
 *
 * @param chatHistory - Full chat history
 * @param compressibleStartIndex - Start of compressible range
 * @param logger - Optional logger
 * @returns End index of compressible range (exclusive)
 */
function calculateCompressibleEndIndex(
  chatHistory: BaseMessage[],
  compressibleStartIndex: number,
): number {
  let compressibleEndIndex = chatHistory.length - 1;
  const lastMessage = chatHistory[chatHistory.length - 1];
  const lastMessageType = lastMessage?.type;

  if (lastMessageType === 'tool') {
    // ToolMessage: Find the parent AIMessage and exclude the entire tool pair
    const lastToolCallId = (lastMessage as ToolMessage).tool_call_id;

    // Find the parent AIMessage that initiated this tool call
    let parentAiIndex = -1;
    for (let i = chatHistory.length - 2; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg.type === 'ai') {
        const toolCalls = (msg as AIMessage).tool_calls;
        if (toolCalls?.some((tc) => tc.id === lastToolCallId)) {
          parentAiIndex = i;
          break;
        }
      }
    }

    if (parentAiIndex >= 0) {
      compressibleEndIndex = parentAiIndex;
    }
  } else if (lastMessageType === 'ai') {
    // AIMessage: Exclude the last 2 messages (preserve HumanMessage + AIMessage pair)
    compressibleEndIndex = Math.max(compressibleStartIndex, chatHistory.length - 2);
  } else if (lastMessageType === 'human') {
    // HumanMessage: Exclude only the last message (current user input)
    compressibleEndIndex = chatHistory.length - 1;
  }

  // Adjust boundary to avoid cutting tool pairs
  compressibleEndIndex = adjustEndIndexForToolPairing(
    chatHistory,
    compressibleStartIndex,
    compressibleEndIndex,
  );

  return compressibleEndIndex;
}

/**
 * Adjust compressible end index to avoid cutting tool pairs.
 * If the boundary falls in the middle of a tool pair, exclude the entire pair.
 *
 * @param messages - All messages
 * @param startIndex - Start of compressible range
 * @param endIndex - Initial end index
 * @returns Adjusted end index that doesn't cut tool pairs
 */
function adjustEndIndexForToolPairing(
  messages: BaseMessage[],
  startIndex: number,
  endIndex: number,
): number {
  if (endIndex <= startIndex) return endIndex;

  let adjustedEndIndex = endIndex;

  // Check if there's an AIMessage with tool_calls just before adjustedEndIndex
  // whose ToolMessages extend beyond adjustedEndIndex
  for (let i = adjustedEndIndex - 1; i >= startIndex; i--) {
    const msg = messages[i];
    if (msg.type === 'ai') {
      const toolCalls = (msg as AIMessage).tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        // Check if any ToolMessages for this AI are at or beyond adjustedEndIndex
        let hasToolMessagesOutside = false;
        for (const tc of toolCalls) {
          for (let j = adjustedEndIndex; j < messages.length; j++) {
            const toolMsg = messages[j];
            if (toolMsg.type === 'tool') {
              const toolCallId = (toolMsg as ToolMessage).tool_call_id;
              if (toolCallId === tc.id) {
                hasToolMessagesOutside = true;
                break;
              }
            }
          }
          if (hasToolMessagesOutside) break;
        }

        // If this AIMessage has ToolMessages outside, exclude it from compressible range
        if (hasToolMessagesOutside) {
          adjustedEndIndex = i; // Exclude this AIMessage and continue checking
        }
      }
    }
  }

  return adjustedEndIndex;
}

/**
 * Build compressible tool pair groups from messages in the range [startIndex, endIndex).
 *
 * PRECONDITION: The range [startIndex, endIndex) is guaranteed by adjustPrefixBoundaryForToolPairing()
 * and adjustEndIndexForToolPairing() to not cut any tool pairs. All AIMessages with tool_calls in this
 * range have all their corresponding ToolMessages also in this range.
 */
function buildCompressibleToolPairGroups(
  messages: BaseMessage[],
  startIndex: number,
  endIndex: number,
): {
  toolPairGroups: ToolPairGroup[];
  standaloneMessages: MessageEntry[];
} {
  const toolPairGroups: ToolPairGroup[] = [];
  const standaloneMessages: MessageEntry[] = [];
  const toolMessagesByCallId = new Map<string, MessageEntry>();
  const aiMessagesWithToolCalls: MessageEntry[] = [];

  // First pass: classify messages in the compressible range
  for (let i = startIndex; i < endIndex; i++) {
    const msg = messages[i];
    const msgType = msg.type;
    const msgTokens = estimateToken(msg.content);
    const entry: MessageEntry = { msg, index: i, tokens: msgTokens };

    switch (msgType) {
      case 'tool': {
        const toolCallId = (msg as ToolMessage).tool_call_id;
        if (toolCallId) {
          toolMessagesByCallId.set(toolCallId, entry);
        }
        break;
      }
      case 'ai': {
        const toolCalls = (msg as AIMessage).tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          aiMessagesWithToolCalls.push(entry);
        } else {
          standaloneMessages.push(entry);
        }
        break;
      }
      case 'human':
        standaloneMessages.push(entry);
        break;
      default:
        standaloneMessages.push(entry);
    }
  }

  // Second pass: build tool pair groups
  for (const aiEntry of aiMessagesWithToolCalls) {
    const toolCalls = (aiEntry.msg as AIMessage).tool_calls || [];
    const pairedToolMessages: MessageEntry[] = [];

    for (const tc of toolCalls) {
      const toolEntry = toolMessagesByCallId.get(tc.id);
      if (toolEntry) {
        pairedToolMessages.push(toolEntry);
        toolMessagesByCallId.delete(tc.id); // Mark as paired
      }
    }

    const totalTokens = aiEntry.tokens + pairedToolMessages.reduce((sum, t) => sum + t.tokens, 0);

    toolPairGroups.push({
      aiMessage: aiEntry,
      toolMessages: pairedToolMessages,
      totalTokens,
      oldestIndex: aiEntry.index,
    });
  }

  // Sort tool pair groups by index DESCENDING (newest first for cache-friendly compression)
  toolPairGroups.sort((a, b) => b.oldestIndex - a.oldestIndex);

  // Sort standalone messages by index DESCENDING (newest first)
  standaloneMessages.sort((a, b) => b.index - a.index);

  return { toolPairGroups, standaloneMessages };
}

/**
 * Collect tool names from archived tool pair groups
 */
function collectArchivedToolNames(
  toolPairGroups: ToolPairGroup[],
  archivedIndices: Set<number>,
): string[] {
  const toolNames: string[] = [];
  for (const group of toolPairGroups) {
    if (archivedIndices.has(group.aiMessage.index)) {
      const toolCalls = (group.aiMessage.msg as AIMessage).tool_calls || [];
      for (const tc of toolCalls) {
        toolNames.push(tc.name);
      }
    }
  }
  return toolNames;
}

/**
 * Build compressed history by replacing archived messages with a reference message.
 *
 * @param chatHistory - Original chat history
 * @param archivedIndices - Set of indices of messages to archive
 * @param messagesToArchive - Messages being archived
 * @param toolPairGroups - Tool pair groups for collecting archived tool names
 * @param fileId - File ID where archived messages are stored
 * @returns Compressed chat history with archive reference inserted
 */
function buildCompressedHistory(
  chatHistory: BaseMessage[],
  archivedIndices: Set<number>,
  messagesToArchive: BaseMessage[],
  toolPairGroups: ToolPairGroup[],
  fileId: string,
): BaseMessage[] {
  const compressedHistory: BaseMessage[] = [];

  const archivedToolNames = collectArchivedToolNames(toolPairGroups, archivedIndices);
  const summary = generateHistorySummary(messagesToArchive);
  const referenceSummary =
    summary +
    (archivedToolNames.length > 0 ? `\nTools archived: ${archivedToolNames.join(', ')}` : '');

  const archiveReferenceMessages: BaseMessage[] = [
    createHistoryReferenceMessage(fileId, messagesToArchive.length, referenceSummary),
  ];

  let referenceInserted = false;
  for (let i = 0; i < chatHistory.length; i++) {
    if (archivedIndices.has(i)) {
      if (!referenceInserted) {
        compressedHistory.push(...archiveReferenceMessages);
        referenceInserted = true;
      }
      continue; // skip archived messages
    }
    compressedHistory.push(chatHistory[i]);
  }

  return compressedHistory;
}

/**
 * Compress chat history using cache-friendly strategy.
 *
 * CACHE-FRIENDLY COMPRESSION STRATEGY:
 * - Preserve prefix (system + first N messages) for prompt caching hits
 * - Compress NEWEST messages first (after the cache prefix)
 * - Keep the final user message intact
 *
 * Before: [System][Msg1][Msg2][Msg3][Msg4][Msg5][Current]
 * After:  [System][Msg1][Msg2][Ref][Current]
 *                  ↑________↑
 *                 Cache prefix (stable, enables 90% cost reduction)
 *
 * This ensures the message prefix remains byte-identical across requests,
 * enabling prompt caching benefits (Anthropic: 90%, OpenAI: 50%).
 */
export async function compressHistoryMessage(args: {
  chatHistory: BaseMessage[];
  remainingBudget: number;
  targetBudget: number;
  context: HistoryCompressionContext;
}): Promise<HistoryCompressionResult> {
  const { chatHistory, remainingBudget, targetBudget, context } = args;

  // Check if compression is needed (remaining < threshold% of target)
  const remainingRatio = targetBudget > 0 ? remainingBudget / targetBudget : 1;

  if (remainingRatio >= REMAINING_SPACE_THRESHOLD || chatHistory.length < 3) {
    return {
      compressedHistory: chatHistory,
      wasCompressed: false,
      archivedMessageCount: 0,
      tokensSaved: 0,
    };
  }

  // Calculate total tokens
  const totalHistoryTokens = estimateMessagesTokens(chatHistory);

  // 1. Calculate cache prefix boundary (messages before this are never compressed)
  const prefixEndIndex = calculateCachePrefixBoundary(chatHistory);

  // Early exit if cache prefix covers all or nearly all messages
  if (prefixEndIndex >= chatHistory.length - 1) {
    return {
      compressedHistory: chatHistory,
      wasCompressed: false,
      archivedMessageCount: 0,
      tokensSaved: 0,
    };
  }

  // 2. Define compressible range: [prefixEndIndex, compressibleEndIndex)
  const compressibleStartIndex = prefixEndIndex;
  const compressibleEndIndex = calculateCompressibleEndIndex(chatHistory, compressibleStartIndex);

  // If no messages can be compressed, return original
  if (compressibleStartIndex >= compressibleEndIndex) {
    return {
      compressedHistory: chatHistory,
      wasCompressed: false,
      archivedMessageCount: 0,
      tokensSaved: 0,
    };
  }

  // 3. Calculate how many tokens we need to free
  const minRemainingTokens = targetBudget * REMAINING_SPACE_THRESHOLD;
  const tokensToFree = Math.max(0, -remainingBudget + minRemainingTokens);

  const compressibleTokens = estimateMessagesTokens(
    chatHistory.slice(compressibleStartIndex, compressibleEndIndex),
  );

  const minTokensToArchive = Math.floor(compressibleTokens * HISTORY_COMPRESS_RATIO);
  const targetTokensToArchive = Math.max(tokensToFree, minTokensToArchive);

  // 4. Build compressible tool pair groups (sorted newest first)
  const { toolPairGroups, standaloneMessages } = buildCompressibleToolPairGroups(
    chatHistory,
    compressibleStartIndex,
    compressibleEndIndex,
  );

  // 5. Compress from NEWEST to OLDEST until we reach target
  let archivedTokens = 0;
  const archivedIndices = new Set<number>();

  // 5a. Compress tool pair groups first (newest first)
  for (const group of toolPairGroups) {
    if (archivedTokens >= targetTokensToArchive) break;

    archivedIndices.add(group.aiMessage.index);
    for (const toolEntry of group.toolMessages) {
      archivedIndices.add(toolEntry.index);
    }
    archivedTokens += group.totalTokens;
  }

  // 5b. Compress standalone messages (newest first)
  // All messages in the compressible range are safe to archive thanks to boundary adjustments
  for (const entry of standaloneMessages) {
    if (archivedTokens >= targetTokensToArchive) break;
    if (archivedIndices.has(entry.index)) continue;

    archivedIndices.add(entry.index);
    archivedTokens += entry.tokens;
  }

  // Need at least 1 message to archive
  if (archivedIndices.size < 1) {
    return {
      compressedHistory: chatHistory,
      wasCompressed: false,
      archivedMessageCount: 0,
      tokensSaved: 0,
    };
  }

  // 6. Collect archived messages and upload to file
  const messagesToArchive = chatHistory.filter((_, i) => archivedIndices.has(i));

  const { fileId, driveFile } = await uploadHistoryToFile({
    messages: messagesToArchive,
    context,
  });
  if (!fileId) {
    return {
      compressedHistory: chatHistory,
      wasCompressed: false,
      archivedMessageCount: 0,
      tokensSaved: 0,
    };
  }

  // 7. Build compressed history
  // Insert a single reference message at the position of the first archived message
  const compressedHistory = buildCompressedHistory(
    chatHistory,
    archivedIndices,
    messagesToArchive,
    toolPairGroups,
    fileId,
  );

  // Calculate tokens saved
  const compressedTokens = estimateMessagesTokens(compressedHistory);
  const tokensSaved = Math.max(0, totalHistoryTokens - compressedTokens);

  context.logger?.info?.('Chat history compressed (cache-friendly)', {
    prefixEndIndex,
    totalHistoryTokens,
    targetTokensToArchive,
    archivedMessageCount: messagesToArchive.length,
    compressedMessageCount: compressedHistory.length,
    compressedTokens,
    tokensSaved,
    targetBudget,
    stillOverBudget: compressedTokens > targetBudget,
    historyFileId: fileId,
    remainingRatio: `${(remainingRatio * 100).toFixed(1)}%`,
  });

  return {
    compressedHistory,
    wasCompressed: true,
    historyFileId: fileId,
    historyFile: driveFile,
    archivedMessageCount: messagesToArchive.length,
    tokensSaved,
  };
}

// ============================================================================
// Context Block Truncation
// ============================================================================

export function truncateContextBlockForPrompt(
  context: ContextBlock,
  maxTokens: number,
  opts?: Partial<{
    maxFiles: number;
    maxResults: number;
    maxOutputFiles: number;
    minItemContentTokens: number;
  }>,
): ContextBlock {
  // IMPORTANT: Always preserve archivedRefs - this is the protected routing table
  const archivedRefs = context?.archivedRefs;

  if (!context || maxTokens <= 0) {
    return { files: [], results: [], totalTokens: 0, archivedRefs };
  }

  const maxFiles = opts?.maxFiles ?? DEFAULT_MAX_CONTEXT_FILES;
  const maxResults = opts?.maxResults ?? DEFAULT_MAX_CONTEXT_RESULTS;
  const maxOutputFiles = opts?.maxOutputFiles ?? DEFAULT_MAX_CONTEXT_OUTPUT_FILES;
  const minItemContentTokens =
    opts?.minItemContentTokens ?? DEFAULT_MIN_CONTEXT_ITEM_CONTENT_TOKENS;

  let usedTokens = 0;
  const files: ContextBlock['files'] = [];
  const results: ContextBlock['results'] = [];

  for (const file of (context.files ?? []).slice(0, maxFiles)) {
    if (usedTokens >= maxTokens) break;

    // Files now only contain metadata (no content) - just calculate metadata tokens
    const metaText = `${file.name ?? ''}\n${file.summary ?? ''}`;
    const metaTokens = estimateToken(metaText);

    const remaining = Math.max(0, maxTokens - usedTokens - metaTokens);
    if (remaining <= 0) break;

    files.push({ ...file });
    usedTokens += metaTokens;
  }

  for (const result of (context.results ?? []).slice(0, maxResults)) {
    if (usedTokens >= maxTokens) break;

    const baseText = `${result.title ?? ''}`;
    const baseTokens = estimateToken(baseText);

    const remaining = Math.max(0, maxTokens - usedTokens - baseTokens);
    if (remaining <= 0) break;

    let content = String(result.content ?? '');
    const originalContentTokens = estimateToken(content);

    if (originalContentTokens > remaining) {
      if (remaining < minItemContentTokens) {
        continue;
      }
      content = truncateContentFast(content, remaining);
    }

    // outputFiles can be huge; keep metadata only.
    const outputFiles = (result.outputFiles ?? []).slice(0, maxOutputFiles).map((of) => ({
      ...of,
      content: '',
    }));

    results.push({ ...result, content, outputFiles });
    usedTokens += baseTokens + estimateToken(content);
  }

  // Return with preserved archivedRefs
  return { files, results, totalTokens: usedTokens, archivedRefs };
}

// ============================================================================
// Archived Refs Helper Functions
// ============================================================================

/**
 * Add a new archived reference to the context block
 */
export function addArchivedRef(
  context: ContextBlock,
  ref: Omit<ArchivedRef, 'archivedAt'>,
): ContextBlock {
  const newRef: ArchivedRef = {
    ...ref,
    archivedAt: Date.now(),
  };

  return {
    ...context,
    archivedRefs: [...(context.archivedRefs ?? []), newRef],
  };
}

/**
 * Get archived refs by type
 */
export function getArchivedRefsByType(context: ContextBlock, type: ArchivedRefType): ArchivedRef[] {
  return (context.archivedRefs ?? []).filter((ref) => ref.type === type);
}

/**
 * Get archived refs by source
 */
export function getArchivedRefsBySource(context: ContextBlock, source: string): ArchivedRef[] {
  return (context.archivedRefs ?? []).filter((ref) => ref.source === source);
}

// ============================================================================
// Model-Aware Context Truncation
// ============================================================================

export interface TruncateContextOptions {
  context: ContextBlock;
  systemPrompt: string;
  optimizedQuery: string;
  usedChatHistory: BaseMessage[];
  messages: BaseMessage[];
  images: string[];
  /** Required: model config for calculating context budget */
  modelInfo: LLMModelConfig;
  /** Optional logger for truncation info */
  logger?: ContextManagerLogger;
  /** Additional metadata for logging (e.g., mode, modelScene) */
  logMeta?: Record<string, unknown>;
}

export interface TruncateContextResult {
  context: ContextBlock;
  contextBudget: number;
  fixedTokens: number;
  targetBudget: number;
  /** Whether truncation occurred */
  wasTruncated: boolean;
  /** Original context tokens before truncation */
  originalContextTokens: number;
}

export function truncateContextBlockForModelPrompt(
  args: TruncateContextOptions,
): TruncateContextResult {
  // Calculate budget based on model's actual capabilities
  const contextLimit = args.modelInfo.contextLimit;
  const maxOutput = args.modelInfo.maxOutput;
  const targetBudget = Math.max(0, contextLimit - maxOutput);

  // Rough overhead reserve for formatting / role tokens.
  const overhead = 600 + (args.images?.length ? 2000 : 0);
  const fixedTokens =
    estimateToken(args.systemPrompt) +
    estimateToken(args.optimizedQuery) +
    estimateMessagesTokens([...(args.usedChatHistory ?? []), ...(args.messages ?? [])]) +
    overhead;

  // Context budget is purely based on model capacity minus fixed tokens
  const contextBudget = Math.max(0, targetBudget - fixedTokens);

  const originalContextTokens = args.context?.totalTokens ?? 0;
  const context = truncateContextBlockForPrompt(args.context, contextBudget);
  const wasTruncated = originalContextTokens > (context?.totalTokens ?? 0);

  // Log truncation info if logger is provided and truncation occurred
  if (wasTruncated && args.logger) {
    args.logger.info('ContextBlock truncated for prompt budget', {
      ...args.logMeta,
      contextLimit,
      maxOutput,
      targetBudget,
      fixedTokens,
      contextBudget,
      originalContextTokens,
      truncatedContextTokens: context?.totalTokens,
    });
  }

  return { context, contextBudget, fixedTokens, targetBudget, wasTruncated, originalContextTokens };
}

// ============================================================================
// Agent Loop Compression
// ============================================================================

export interface AgentLoopCompressionOptions {
  /** Current messages in the agent loop */
  messages: BaseMessage[];
  /** Model context limit */
  contextLimit: number;
  /** Model max output tokens */
  maxOutput: number;
  /** User object */
  user: User;
  /** Canvas ID */
  canvasId: string;
  /** Result ID */
  resultId: string;
  /** Result version */
  resultVersion: number;
  /** Refly service for file operations */
  service: ReflyService;
  /** Optional logger */
  logger?: ContextManagerLogger;
  /** Model info for cache-aware compression */
  modelInfo?: LLMModelConfig;
  /** Additional tokens consumed by tools, system prompt, etc. */
  additionalTokens?: number;
}

export interface AgentLoopCompressionResult {
  /** Messages after compression (may be same as input if no compression) */
  messages: BaseMessage[];
  /** Whether compression occurred */
  wasCompressed: boolean;
  /** File ID if history was archived */
  historyFileId?: string;
}

/**
 * Compress messages during agent loop iteration.
 * Call this before each LLM invocation to manage context window.
 *
 * @example
 * ```ts
 * const result = await compressAgentLoopMessages({
 *   messages: currentMessages,
 *   contextLimit: 128000,
 *   maxOutput: 8000,
 *   user,
 *   canvasId,
 *   resultId,
 *   resultVersion: version,
 *   service: engine.service,
 *   logger: engine.logger,
 * });
 *
 * if (result.wasCompressed) {
 *   currentMessages = result.messages;
 * }
 * ```
 */
export async function compressAgentLoopMessages(
  options: AgentLoopCompressionOptions,
): Promise<AgentLoopCompressionResult> {
  const {
    messages,
    contextLimit,
    maxOutput,
    user,
    canvasId,
    resultId,
    resultVersion,
    service,
    logger,
    modelInfo,
  } = options;

  const targetBudget = contextLimit - maxOutput;
  const messagesTokens = estimateMessagesTokens(messages);
  const additionalTokens = options.additionalTokens ?? 0;
  // Include additional tokens (tools, system prompt, etc.) in the calculation
  const currentTokens = messagesTokens + additionalTokens;
  const remainingBudget = targetBudget - currentTokens;

  // Skip if missing required context or not enough messages
  if (!service || !user || !canvasId || messages.length < 3) {
    return {
      messages,
      wasCompressed: false,
    };
  }

  const compressionContext: HistoryCompressionContext = {
    user,
    canvasId,
    resultId,
    resultVersion,
    service,
    logger,
    modelInfo,
  };

  const compressionResult = await compressHistoryMessage({
    chatHistory: messages,
    remainingBudget,
    targetBudget,
    context: compressionContext,
  });

  // After compression, check if still over budget
  // If so, truncate ToolMessage contents (not in cache prefix)
  let finalMessages = compressionResult.compressedHistory;
  const compressedTokens = estimateMessagesTokens(finalMessages) + additionalTokens;

  if (compressedTokens > targetBudget) {
    finalMessages = truncateToolMessagesForBudget({
      messages: finalMessages,
      targetBudget,
      additionalTokens,
      logger,
    });
  }

  return {
    messages: finalMessages,
    wasCompressed: compressionResult.wasCompressed,
    historyFileId: compressionResult.historyFileId,
  };
}

/**
 * Truncate ToolMessage contents to fit within budget.
 * Only truncates ToolMessages after the cache prefix (system + first few messages).
 * Uses head+tail truncation to preserve important context.
 * Each ToolMessage is capped at MAX_TOOL_MESSAGE_TOKENS (4000) after truncation.
 */
function truncateToolMessagesForBudget(args: {
  messages: BaseMessage[];
  targetBudget: number;
  additionalTokens: number;
  logger?: ContextManagerLogger;
}): BaseMessage[] {
  const { messages, targetBudget, additionalTokens, logger } = args;

  const currentTokens = estimateMessagesTokens(messages) + additionalTokens;
  const tokensToSave = currentTokens - targetBudget;

  if (tokensToSave <= 0) {
    return messages;
  }

  // Find ToolMessages and their token counts (skip system message at index 0)
  const toolMessageInfos: { index: number; tokens: number }[] = [];
  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type === 'tool') {
      const tokens = estimateToken(msg.content);
      toolMessageInfos.push({ index: i, tokens });
    }
  }

  // Simple strategy: cap each ToolMessage at MAX_TOOL_MESSAGE_TOKENS (4000)
  const truncateMap = new Map<number, number>(); // index -> targetTokens

  for (const info of toolMessageInfos) {
    if (info.tokens > MAX_TOOL_MESSAGE_TOKENS) {
      truncateMap.set(info.index, MAX_TOOL_MESSAGE_TOKENS);
    }
  }

  if (truncateMap.size === 0) {
    return messages;
  }

  // Apply truncation using truncateContentFast (head + tail)
  const truncatedMessages = messages.map((msg, index) => {
    const targetTokens = truncateMap.get(index);
    if (targetTokens === undefined) return msg;

    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const truncatedContent = truncateContentFast(content, targetTokens);
    logger?.info?.('Truncated ToolMessage content for budget', {
      messageIndex: index,
      originalTokens: estimateToken(content),
      targetTokens,
    });

    return new ToolMessage({
      content: truncatedContent,
      tool_call_id: (msg as ToolMessage).tool_call_id,
      name: (msg as ToolMessage).name,
    });
  });

  return truncatedMessages;
}
