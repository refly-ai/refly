import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
  BaseMessageFields,
  AIMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { LLMModelConfig } from '@refly/openapi-schema';
import { ContextBlock } from './context';
import { countToken, countMessagesTokens } from './token';

export interface SkillPromptModule {
  buildSystemPrompt: (
    locale: string,
    needPrepareContext: boolean,
    customInstructions?: string,
  ) => string;
  buildUserPrompt: ({
    query,
    context,
  }: {
    query: string;
    context: ContextBlock;
  }) => string;
}

// Define interfaces for content types
interface TextContent {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

interface ImageUrlContent {
  type: 'image_url';
  image_url: { url: string };
  // Note: We don't add cache_control to image content as per Anthropic docs
  // Images are cached as part of the prefix but don't have their own cache_control
}

type ContentItem = TextContent | ImageUrlContent;

// Note about minimum token thresholds:
// Different Claude models have minimum requirements for caching:
// - 1024 tokens: Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3 Opus
// - 2048 tokens: Claude 3.5 Haiku, Claude 3 Haiku

export const buildFinalRequestMessages = ({
  systemPrompt,
  userPrompt,
  chatHistory,
  messages,
  images,
  modelInfo,
}: {
  systemPrompt: string;
  userPrompt: string;
  chatHistory: BaseMessage[];
  messages: BaseMessage[];
  images: string[];
  modelInfo?: LLMModelConfig;
}) => {
  // Prepare the final user message (with or without images)
  const finalUserMessage = images?.length
    ? createHumanMessageWithContent([
        {
          type: 'text',
          text: userPrompt,
        } as TextContent,
        ...images.map(
          (image) =>
            ({
              type: 'image_url',
              image_url: { url: image },
            }) as ImageUrlContent,
        ),
      ])
    : new HumanMessage(userPrompt);

  // Assemble all messages - following Anthropic's caching order: tools -> system -> messages
  let requestMessages = [
    new SystemMessage(systemPrompt), // System message comes first in our implementation
    ...chatHistory, // Historical conversation
    ...messages, // Additional messages
    finalUserMessage, // The actual query that needs a response (should not be cached)
  ];

  // Apply message list truncation if model info is available
  if (modelInfo?.contextLimit) {
    requestMessages = truncateMessageList(requestMessages, modelInfo);
  }

  // Check if context caching should be enabled and the model supports it
  const shouldEnableContextCaching = !!modelInfo?.capabilities?.contextCaching;
  if (shouldEnableContextCaching) {
    // Note: In a production system, you might want to:
    // 1. Estimate token count based on model name
    // 2. Check against minimum token thresholds
    // 3. Skip caching if below the threshold

    return applyContextCaching(requestMessages);
  }

  return requestMessages;
};

/**
 * Applies context caching to messages - only caches up to 3 most recent messages
 * before the final message
 *
 * According to Anthropic documentation:
 * - All messages except the final one should be marked with cache_control
 * - Images are included in caching but don't have their own cache_control parameter
 * - Changing whether there are images in a prompt will break the cache
 */
const applyContextCaching = (messages: BaseMessage[]): BaseMessage[] => {
  if (messages.length <= 1) return messages;

  // Calculate the minimum index to start caching from
  // We want to cache at most 3 messages before the last message
  const minCacheIndex = Math.max(0, messages.length - 4);

  return messages.map((message, index) => {
    // Don't cache the last message (final user query)
    if (index === messages.length - 1) return message;

    // Don't cache messages beyond the 3 most recent (before the last one)
    if (index < minCacheIndex) return message;

    // Apply caching only to the 3 most recent messages (before the last one)
    if (message instanceof SystemMessage) {
      return new SystemMessage({
        content: [
          {
            type: 'text',
            text:
              typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content),
            cache_control: { type: 'ephemeral' },
          },
        ],
      } as BaseMessageFields);
    }

    if (message instanceof HumanMessage) {
      if (typeof message.content === 'string') {
        return new HumanMessage({
          content: [
            {
              type: 'text',
              text: message.content,
              cache_control: { type: 'ephemeral' },
            },
          ],
        } as BaseMessageFields);
      }

      if (Array.isArray(message.content)) {
        // Handle array content (like images mixed with text)
        // According to Anthropic docs, we only apply cache_control to text blocks,
        // but images are still included in the cached content
        const updatedContent = message.content.map((item: any) => {
          if (item.type === 'text') {
            return {
              ...item,
              cache_control: { type: 'ephemeral' },
            };
          }
          // For image content, we don't add cache_control
          return item;
        });

        return new HumanMessage({
          content: updatedContent,
        } as BaseMessageFields);
      }
    }

    // Return original message if we can't apply caching
    return message;
  });
};

/**
 * Creates a HumanMessage with array content
 */
const createHumanMessageWithContent = (contentItems: ContentItem[]): HumanMessage => {
  return new HumanMessage({ content: contentItems } as BaseMessageFields);
};

// ============ Message List Truncation ============

interface TruncateRule {
  canTruncate: boolean; // Whether this message can be truncated
  priority: number; // Higher number = higher priority to truncate
  keepRatio: number; // Ratio to keep after truncation (0-1)
  minKeep: number; // Minimum tokens to keep
}

/**
 * Get truncation rule for a specific message
 */
function getTruncateRule(msg: BaseMessage, index: number, totalLength: number): TruncateRule {
  // SystemMessage - never truncate
  if (msg instanceof SystemMessage) {
    return { canTruncate: false, priority: 0, keepRatio: 1, minKeep: 0 };
  }

  // Last HumanMessage - never truncate (current user query)
  if (index === totalLength - 1 && msg instanceof HumanMessage) {
    return { canTruncate: false, priority: 0, keepRatio: 1, minKeep: 0 };
  }

  const tokens = countToken(msg.content);

  // ToolMessage
  if (msg instanceof ToolMessage) {
    if (tokens > 5000) {
      // Large ToolMessage - highest priority to truncate
      return { canTruncate: true, priority: 10, keepRatio: 0.1, minKeep: 1000 };
    }
    if (tokens > 2000) {
      // Medium ToolMessage
      return { canTruncate: true, priority: 7, keepRatio: 0.3, minKeep: 500 };
    }
    // Small ToolMessage - don't truncate
    return { canTruncate: false, priority: 0, keepRatio: 1, minKeep: 0 };
  }

  // ChatHistory (messages between first and last)
  const isChatHistory = index > 0 && index < totalLength - 1;
  if (isChatHistory) {
    const recentThreshold = Math.max(1, totalLength - 6); // Last 3 rounds (6 messages)

    if (index < recentThreshold) {
      // Old chat history - high priority to remove
      return { canTruncate: true, priority: 9, keepRatio: 0, minKeep: 0 };
    } else {
      // Recent chat history - low priority to truncate
      return { canTruncate: true, priority: 3, keepRatio: 0.5, minKeep: 200 };
    }
  }

  // Other messages
  return { canTruncate: true, priority: 5, keepRatio: 0.5, minKeep: 200 };
}

/**
 * Truncate a single message to target token count
 */
function truncateMessage(msg: BaseMessage, targetTokens: number): BaseMessage {
  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

  // Binary search to find the right truncation length
  let left = 0;
  let right = content.length;
  let bestLength = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const truncated = content.substring(0, mid);
    const tokens = countToken(truncated);

    if (tokens <= targetTokens) {
      bestLength = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  const truncatedContent = content.substring(0, bestLength);
  const suffix = `\n\n[... truncated ${content.length - bestLength} chars ...]`;

  // Return appropriate message type
  if (msg instanceof ToolMessage) {
    return new ToolMessage({
      content: truncatedContent + suffix,
      tool_call_id: msg.tool_call_id,
      name: msg.name,
    });
  }

  if (msg instanceof AIMessage) {
    return new AIMessage(truncatedContent + suffix);
  }

  if (msg instanceof HumanMessage) {
    return new HumanMessage(truncatedContent + suffix);
  }

  return msg;
}

/**
 * Core mode: keep only essential messages
 */
function buildCoreMessages(messages: BaseMessage[], targetBudget: number): BaseMessage[] {
  const result: BaseMessage[] = [];
  let tokens = 0;

  // 1. System message
  const system = messages.find((m) => m instanceof SystemMessage);
  if (system) {
    result.push(system);
    tokens += countToken(system.content);
  }

  // 2. Last user message
  const last = messages[messages.length - 1];
  if (last) {
    result.push(last);
    tokens += countToken(last.content);
  }

  // 3. If there's space, add 1-2 recent messages
  for (let i = messages.length - 2; i >= 1 && tokens < targetBudget * 0.8; i--) {
    const msg = messages[i];
    const msgTokens = countToken(msg.content);
    if (tokens + msgTokens < targetBudget * 0.8) {
      result.splice(result.length - 1, 0, msg); // Insert before last message
      tokens += msgTokens;
    }
  }

  return result;
}

/**
 * Truncate message list to fit within target budget
 */
export function truncateMessageList(
  messages: BaseMessage[],
  modelInfo: LLMModelConfig,
): BaseMessage[] {
  const contextLimit = modelInfo.contextLimit || 100000;
  const targetBudget = contextLimit * 0.8; // Target: use 80%, reserve 20% for output

  const currentTokens = countMessagesTokens(messages);
  const needToTruncate = currentTokens - targetBudget;

  // No truncation needed
  if (needToTruncate <= 0) {
    return messages;
  }

  // Score each message
  const scoredMessages = messages.map((msg, index) => {
    const tokens = countToken(msg.content);
    const rule = getTruncateRule(msg, index, messages.length);

    return {
      index,
      message: msg,
      tokens,
      rule,
      // Calculate max tokens we can save from this message
      maxSavable: rule.canTruncate
        ? Math.max(0, tokens - Math.max(tokens * rule.keepRatio, rule.minKeep))
        : 0,
    };
  });

  // Sort by priority (higher priority first)
  const sortedByPriority = scoredMessages
    .filter((item) => item.maxSavable > 0)
    .sort((a, b) => b.rule.priority - a.rule.priority);

  // Truncate one by one until we have saved enough
  const toTruncate = new Map<number, number>(); // index -> keepTokens
  let saved = 0;

  for (const item of sortedByPriority) {
    if (saved >= needToTruncate) break;

    const needMore = needToTruncate - saved;
    const canSave = item.maxSavable;

    if (canSave <= needMore) {
      // This message contributes all it can
      const keepTokens = Math.max(item.tokens * item.rule.keepRatio, item.rule.minKeep);
      toTruncate.set(item.index, Math.ceil(keepTokens));
      saved += canSave;
    } else {
      // This message only needs to contribute part of what it can
      const shouldSave = needMore;
      const keepTokens = item.tokens - shouldSave;
      toTruncate.set(item.index, Math.ceil(keepTokens));
      saved += shouldSave;
    }
  }

  // If we can't save enough even after truncating everything, fallback to core mode
  if (saved < needToTruncate) {
    return buildCoreMessages(messages, targetBudget);
  }

  // Execute truncation
  const result = messages
    .map((msg, index) => {
      const keepTokens = toTruncate.get(index);
      if (keepTokens === undefined) return msg; // No truncation
      if (keepTokens === 0) return null; // Remove this message
      return truncateMessage(msg, keepTokens); // Truncate to specified size
    })
    .filter((msg): msg is BaseMessage => msg !== null);

  return result;
}
