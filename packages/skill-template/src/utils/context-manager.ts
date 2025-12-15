/**
 * Context Manager
 *
 * This module handles context truncation for LLM prompts.
 * For tool result post-processing, see ../post-handler.ts
 */

import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import type { LLMModelConfig, User, DriveFile } from '@refly/openapi-schema';
import type { ReflyService } from '@refly/agent-tools';
import type { ContextBlock, ArchivedRef, ArchivedRefType } from '../scheduler/utils/context';
import { truncateContent, estimateTokens, estimateMessagesTokens } from '../scheduler/utils/token';

// ============================================================================
// Constants (only for item-level limits, not token budgets)
// ============================================================================

const DEFAULT_MAX_CONTEXT_FILES = 100;
const DEFAULT_MAX_CONTEXT_RESULTS = 100;
const DEFAULT_MAX_CONTEXT_OUTPUT_FILES = 100;
const DEFAULT_MIN_CONTEXT_ITEM_CONTENT_TOKENS = 1000;

// History compression thresholds
const REMAINING_SPACE_THRESHOLD = 0.05; // 5%
const HISTORY_COMPRESS_RATIO = 0.7; // 70% archived, 30% kept

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
    const role = msg.getType();
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
 * Create a summary message that references the archived history file
 */
function createHistoryReferenceMessage(
  fileId: string,
  archivedCount: number,
  summary: string,
): HumanMessage {
  return new HumanMessage({
    content: `[Earlier conversation history (${archivedCount} messages) has been archived to file: ${fileId}]\n\nSummary of archived conversation:\n${summary}`,
  });
}

/**
 * Create a placeholder AIMessage + ToolMessage pair to replace archived tool calls.
 * This maintains the required tool_use/tool_result pairing while reducing tokens.
 *
 * @returns [AIMessage with tool_call, ToolMessage with result] pair
 */
function createToolPairPlaceholder(
  fileId: string,
  toolNames: string[],
  originalToolCallId: string,
): [AIMessage, ToolMessage] {
  const toolCallId = originalToolCallId || `archived_${Date.now()}`;

  const aiMessage = new AIMessage({
    content: '',
    tool_calls: [
      {
        id: toolCallId,
        name: 'archived_tool_calls',
        args: {
          file_id: fileId,
          archived_tools: toolNames,
        },
      },
    ],
  });

  const toolMessage = new ToolMessage({
    content: `[Tool calls archived to file: ${fileId}]\n\nArchived tools: ${toolNames.join(', ')}\n\n⚠️ Note: Reading this file directly may consume too much context. Only use read_file if you need to retrieve specific details from these tool results.`,
    tool_call_id: toolCallId,
  });

  return [aiMessage, toolMessage];
}

/**
 * Generate a brief summary of archived messages
 */
function generateHistorySummary(messages: BaseMessage[]): string {
  const messageTypes: Record<string, number> = {};
  const toolsUsed: Set<string> = new Set();

  for (const msg of messages) {
    const type = msg.getType();
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

/**
 * Compress chat history when remaining context space is below threshold.
 *
 * Token-based compression strategy:
 * 1. Calculate how many tokens need to be freed (tokensToFree)
 * 2. Archive messages from oldest to newest until we free enough tokens
 * 3. Upload archived messages to a DriveFile
 * 4. Replace with a single reference message containing fileId and summary
 * 5. Keep the most recent messages intact
 *
 * This ensures we archive exactly enough to fit within budget while preserving
 * the most recent conversation context.
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

  // Calculate total tokens in chat history (use estimation for speed)
  const totalHistoryTokens = estimateMessagesTokens(chatHistory);

  // Calculate how many tokens we need to free
  // We want to have at least (targetBudget * REMAINING_SPACE_THRESHOLD) remaining after compression
  const minRemainingTokens = targetBudget * REMAINING_SPACE_THRESHOLD;
  const tokensToFree = Math.max(0, -remainingBudget + minRemainingTokens);

  // Also apply minimum compression ratio (archive at least HISTORY_COMPRESS_RATIO of tokens)
  const minTokensToArchive = Math.floor(totalHistoryTokens * HISTORY_COMPRESS_RATIO);
  const targetTokensToArchive = Math.max(tokensToFree, minTokensToArchive);

  // Priority-based compression with TOOL PAIRING:
  //
  // CRITICAL: AIMessage with tool_calls MUST be kept together with corresponding ToolMessages
  // Claude/Bedrock requires each tool_use to have a matching tool_result immediately after.
  //
  // Message groups:
  // 1. System messages - NEVER archive
  // 2. Tool pairs (AIMessage with tool_calls + corresponding ToolMessages) - archive first (oldest pairs first)
  // 3. Standalone AIMessages (no tool_calls) - archive second
  // 4. Human messages - archive last
  //
  // TODO: Make MIN_KEEP_COUNT dynamic based on context/model capacity
  const MIN_KEEP_COUNT = 5; // minimum number of keeping

  // First pass: identify all messages and build tool call mappings
  interface MessageEntry {
    msg: BaseMessage;
    index: number;
    tokens: number;
  }

  interface ToolPairGroup {
    aiMessage: MessageEntry;
    toolMessages: MessageEntry[];
    totalTokens: number;
    oldestIndex: number; // For sorting by age
  }

  const systemMessages: MessageEntry[] = [];
  const humanMessages: MessageEntry[] = [];
  const standaloneAiMessages: MessageEntry[] = []; // AI messages without tool_calls
  const toolPairGroups: ToolPairGroup[] = [];

  // Map tool_call_id -> ToolMessage entry
  const toolMessagesByCallId = new Map<string, MessageEntry>();
  // Map to track which AI messages have tool_calls
  const aiMessagesWithToolCalls: MessageEntry[] = [];

  // First pass: classify all messages (use estimation for speed)
  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i];
    const msgType = msg.getType();
    const msgTokens = estimateTokens(msg.content);
    const entry: MessageEntry = { msg, index: i, tokens: msgTokens };

    switch (msgType) {
      case 'system':
        systemMessages.push(entry);
        break;
      case 'human':
        humanMessages.push(entry);
        break;
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
          standaloneAiMessages.push(entry);
        }
        break;
      }
      default:
        // Unknown type, treat as standalone AI message
        standaloneAiMessages.push(entry);
    }
  }

  // Second pass: build tool pair groups (AIMessage + its ToolMessages)
  for (const aiEntry of aiMessagesWithToolCalls) {
    const toolCalls = (aiEntry.msg as AIMessage).tool_calls || [];
    const pairedToolMessages: MessageEntry[] = [];

    for (const tc of toolCalls) {
      const toolEntry = toolMessagesByCallId.get(tc.id);
      if (toolEntry) {
        pairedToolMessages.push(toolEntry);
        // Remove from map so we know which tool messages are orphaned
        toolMessagesByCallId.delete(tc.id);
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

  // Any remaining tool messages without paired AI message (orphaned) - treat as standalone
  const orphanedToolMessages = Array.from(toolMessagesByCallId.values());

  // Archive messages in priority order (oldest first) until we reach target tokens
  let archivedTokens = 0;
  const archivedIndices = new Set<number>();

  // Helper: archive tool pair groups (oldest first, keep at least MIN_KEEP_COUNT groups)
  const archiveToolPairGroups = (): void => {
    // Sort by oldest index (oldest groups first)
    const sortedGroups = [...toolPairGroups].sort((a, b) => a.oldestIndex - b.oldestIndex);
    const archivableCount = Math.max(0, sortedGroups.length - MIN_KEEP_COUNT);

    for (let i = 0; i < archivableCount; i++) {
      if (archivedTokens >= targetTokensToArchive) {
        return;
      }

      const group = sortedGroups[i];
      // Archive the entire group together
      archivedIndices.add(group.aiMessage.index);
      for (const toolEntry of group.toolMessages) {
        archivedIndices.add(toolEntry.index);
      }
      archivedTokens += group.totalTokens;
    }
  };

  // Helper: archive from a simple list (oldest first, keep at least MIN_KEEP_COUNT)
  const archiveFromList = (list: MessageEntry[]): void => {
    const archivableCount = Math.max(0, list.length - MIN_KEEP_COUNT);

    for (let i = 0; i < archivableCount; i++) {
      if (archivedTokens >= targetTokensToArchive) {
        return;
      }

      const entry = list[i]; // Oldest first (list is in chronological order)
      archivedIndices.add(entry.index);
      archivedTokens += entry.tokens;
    }
  };

  // Archive in priority order:
  // 1. Tool pair groups (oldest first) - this keeps tool_use/tool_result together
  // 2. Orphaned tool messages (shouldn't happen often, but handle gracefully)
  // 3. Standalone AI messages (no tool_calls)
  // 4. Human messages
  // System messages are NEVER archived

  archiveToolPairGroups();

  if (archivedTokens < targetTokensToArchive && orphanedToolMessages.length > 0) {
    archiveFromList(orphanedToolMessages);
  }

  if (archivedTokens < targetTokensToArchive) {
    archiveFromList(standaloneAiMessages);
  }

  if (archivedTokens < targetTokensToArchive) {
    archiveFromList(humanMessages);
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

  // Collect archived messages for file upload
  const messagesToArchive: BaseMessage[] = [];
  for (let i = 0; i < chatHistory.length; i++) {
    if (archivedIndices.has(i)) {
      messagesToArchive.push(chatHistory[i]);
    }
  }

  const archiveCount = messagesToArchive.length;

  // Recalculate actual archived tokens (use estimation for speed)
  archivedTokens = estimateMessagesTokens(messagesToArchive);

  // Upload archived messages to file
  const { fileId, driveFile } = await uploadHistoryToFile({
    messages: messagesToArchive,
    context,
  });

  if (!fileId) {
    // Upload failed, return original history
    context.logger?.error?.('History compression failed: could not upload to file');
    return {
      compressedHistory: chatHistory,
      wasCompressed: false,
      archivedMessageCount: 0,
      tokensSaved: 0,
    };
  }

  // Collect tool names from archived tool pair groups for the placeholder
  const archivedToolNames: string[] = [];
  for (const group of toolPairGroups) {
    if (archivedIndices.has(group.aiMessage.index)) {
      const toolCalls = (group.aiMessage.msg as AIMessage).tool_calls || [];
      for (const tc of toolCalls) {
        archivedToolNames.push(tc.name);
      }
    }
  }

  // Build compressed history with placeholder for tool calls
  // Strategy: Replace archived tool pairs with a single placeholder pair,
  // keep system messages and other kept messages in order
  const compressedHistory: BaseMessage[] = [];
  let placeholderInserted = false;

  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i];

    if (archivedIndices.has(i)) {
      // This message is archived
      // Insert placeholder once at the position of the first archived tool pair
      if (!placeholderInserted && archivedToolNames.length > 0) {
        const firstArchivedToolCall = toolPairGroups.find((g) =>
          archivedIndices.has(g.aiMessage.index),
        );
        if (firstArchivedToolCall) {
          const firstToolCallId =
            (firstArchivedToolCall.aiMessage.msg as AIMessage).tool_calls?.[0]?.id ||
            `archived_${Date.now()}`;
          const [placeholderAi, placeholderTool] = createToolPairPlaceholder(
            fileId,
            archivedToolNames,
            firstToolCallId,
          );
          compressedHistory.push(placeholderAi);
          compressedHistory.push(placeholderTool);
          placeholderInserted = true;
        }
      }
      // Skip this archived message (already represented by placeholder or will be in file)
      continue;
    }

    // Keep this message
    compressedHistory.push(msg);
  }

  // If we archived non-tool messages (human/standalone AI) without tool pairs,
  // add a simple reference message at the beginning
  if (!placeholderInserted && archiveCount > 0) {
    const summary = generateHistorySummary(messagesToArchive);
    const referenceMessage = createHistoryReferenceMessage(fileId, archiveCount, summary);
    compressedHistory.unshift(referenceMessage);
  }

  // Calculate tokens saved (use estimation for speed)
  const compressedTokens = estimateMessagesTokens(compressedHistory);
  const tokensSaved = Math.max(0, totalHistoryTokens - compressedTokens);

  context.logger?.info?.('Chat history compressed with tool placeholder', {
    totalHistoryTokens,
    targetTokensToArchive,
    archivedTokens,
    archivedMessageCount: archiveCount,
    compressedMessageCount: compressedHistory.length,
    tokensSaved,
    historyFileId: fileId,
    remainingRatio: `${(remainingRatio * 100).toFixed(1)}%`,
  });

  return {
    compressedHistory,
    wasCompressed: true,
    historyFileId: fileId,
    historyFile: driveFile,
    archivedMessageCount: archiveCount,
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

    const baseText = `${file.name ?? ''}\n${file.summary ?? ''}`;
    const baseTokens = estimateTokens(baseText);
    const remaining = Math.max(0, maxTokens - usedTokens - baseTokens);
    if (remaining <= 0) break;

    let content = String(file.content ?? '');
    const originalContentTokens = estimateTokens(content);
    if (originalContentTokens > remaining) {
      if (remaining < minItemContentTokens) {
        // Not enough budget to keep meaningful content; skip this item.
        continue;
      }
      content = truncateContent(content, remaining);
    }

    files.push({ ...file, content });
    usedTokens += baseTokens + estimateTokens(content);
  }

  for (const result of (context.results ?? []).slice(0, maxResults)) {
    if (usedTokens >= maxTokens) break;

    const baseText = `${result.title ?? ''}`;
    const baseTokens = estimateTokens(baseText);
    const remaining = Math.max(0, maxTokens - usedTokens - baseTokens);
    if (remaining <= 0) break;

    let content = String(result.content ?? '');
    const originalContentTokens = estimateTokens(content);
    if (originalContentTokens > remaining) {
      if (remaining < minItemContentTokens) {
        continue;
      }
      content = truncateContent(content, remaining);
    }

    // outputFiles can be huge; keep metadata only.
    const outputFiles = (result.outputFiles ?? []).slice(0, maxOutputFiles).map((of) => ({
      ...of,
      content: '',
    }));

    results.push({ ...result, content, outputFiles });
    usedTokens += baseTokens + estimateTokens(content);
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
    estimateTokens(args.systemPrompt) +
    estimateTokens(args.optimizedQuery) +
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
  } = options;

  const targetBudget = contextLimit - maxOutput;
  const currentTokens = estimateMessagesTokens(messages);
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
  };

  const compressionResult = await compressHistoryMessage({
    chatHistory: messages,
    remainingBudget,
    targetBudget,
    context: compressionContext,
  });

  return {
    messages: compressionResult.compressedHistory,
    wasCompressed: compressionResult.wasCompressed,
    historyFileId: compressionResult.historyFileId,
  };
}
