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
import { countToken, countMessagesTokens, truncateContent as truncateContentUtil } from './token';

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
//
// Note about LangChain AWS cachePoint format:
// - LangChain AWS v1.1.0+ uses cachePoint markers for Bedrock
// - Format: { cachePoint: { type: 'default' } }
// - Place the cachePoint marker AFTER the content to cache

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
 * Applies context caching to messages using LangChain's cachePoint format
 *
 * Two-level caching strategy:
 * 1. Global Static Point: After System Prompt (index 0)
 *    - Shared across all users and sessions
 *    - Contains: System Prompt + Tool Definitions + Examples
 *    - Benefits: Write once, reuse globally
 * 2. Session Dynamic Points: After the last 3 messages excluding the final user message
 *    - Caches the conversation history for the current user
 *    - Applies to System/Human/AI/Tool messages
 *    - Benefits: Reuses multi-turn conversation context within a session
 *
 * ToolMessage caching strategy:
 * - AWS Bedrock Converse API requires cachePoint as a message-level block
 * - For ToolMessage, we construct content as an array with cachePoint at the end
 * - Format: content: [{ type: 'text', text: '...' }, { cachePoint: { type: 'default' } }]
 * - @langchain/aws 1.1.0+ handles the proper serialization
 *
 * LangChain AWS uses cachePoint markers:
 * - Format: { cachePoint: { type: 'default' } }
 * - Place the cachePoint marker AFTER the content to cache
 */
/**
 * Try to add cache point to a single message.
 * Returns the cached message if successful, or null if caching is not applicable.
 */
const tryAddCachePoint = (message: BaseMessage): BaseMessage | null => {
  const messageType = message._getType();

  if (messageType === 'system') {
    const textContent =
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

    // Skip caching if content is empty
    // Bedrock Converse API does not accept empty text blocks
    if (!textContent || textContent.trim() === '') {
      return null;
    }

    return new SystemMessage({
      content: [
        {
          type: 'text',
          text: textContent,
        },
        {
          cachePoint: { type: 'default' },
        },
      ],
    } as BaseMessageFields);
  }

  if (messageType === 'human') {
    if (typeof message.content === 'string') {
      // Skip caching if content is empty
      if (!message.content || message.content.trim() === '') {
        return null;
      }

      return new HumanMessage({
        content: [
          {
            type: 'text',
            text: message.content,
          },
          {
            cachePoint: { type: 'default' },
          },
        ],
      } as BaseMessageFields);
    }

    if (Array.isArray(message.content)) {
      // Skip caching if content array is empty
      if (message.content.length === 0) {
        return null;
      }

      // For array content (like images mixed with text),
      // add cachePoint marker at the end
      return new HumanMessage({
        content: [
          ...message.content,
          {
            cachePoint: { type: 'default' },
          },
        ],
      } as BaseMessageFields);
    }
  }

  if (messageType === 'ai') {
    const aiMessage = message as AIMessage;

    // For AIMessage, we need actual text content to add cachePoint
    // AWS Bedrock requires content before cachePoint - cannot cache empty content
    if (typeof message.content === 'string') {
      const hasContent = message.content && message.content.trim() !== '';

      // Skip caching if no actual text content
      // Even if has tool_calls, cachePoint requires preceding content
      if (!hasContent) {
        return null;
      }

      // Build content array with text and cachePoint
      return new AIMessage({
        content: [
          {
            type: 'text',
            text: message.content,
          },
          {
            cachePoint: { type: 'default' },
          },
        ],
        tool_calls: aiMessage.tool_calls,
        additional_kwargs: aiMessage.additional_kwargs,
      } as BaseMessageFields);
    }

    // Handle array content
    if (Array.isArray(message.content)) {
      // Skip caching if content array is empty - cachePoint requires preceding content
      if (message.content.length === 0) {
        return null;
      }

      return new AIMessage({
        content: [
          ...message.content,
          {
            cachePoint: { type: 'default' },
          },
        ],
        tool_calls: aiMessage.tool_calls,
        additional_kwargs: aiMessage.additional_kwargs,
      } as BaseMessageFields);
    }
  }

  // Tool messages and other types cannot be cached
  // Note: AWS Bedrock Converse API's ToolResultContentBlock only supports:
  // text, image, json, document types. cachePoint is NOT a valid type.
  return null;
};

const applyContextCaching = (messages: BaseMessage[]): BaseMessage[] => {
  if (messages.length <= 1) return messages;

  // Copy messages array to avoid mutation
  const result = [...messages];
  const maxDynamicCachePoints = 3;
  let dynamicCacheCount = 0;

  // 1. Global Static Point: Try to cache system message at index 0
  if (result.length > 0) {
    const cachedSystemMessage = tryAddCachePoint(result[0]);
    if (cachedSystemMessage) {
      result[0] = cachedSystemMessage;
    }
  }

  // 2. Session Dynamic Points: Scan from end, try to cache up to 3 messages
  // Skip index 0 (system message already handled)
  for (let i = result.length - 1; i > 0 && dynamicCacheCount < maxDynamicCachePoints; i--) {
    const cachedMessage = tryAddCachePoint(result[i]);
    if (cachedMessage) {
      result[i] = cachedMessage;
      dynamicCacheCount++;
    }
    // If caching failed (returned null), continue to try the next message
  }

  return result;
};

/**
 * Applies context caching to messages for agent loop iterations.
 * This function is designed for re-applying cache points during ReAct loops
 * where new messages (AIMessage with tool_calls, ToolMessage) are added.
 *
 * Cache point strategy:
 * 1. Global Static Point: After System Prompt (index 0)
 * 2. Session Dynamic Points: Last 3 messages excluding the final user message
 *
 * @param messages - The current message array
 * @param supportsContextCaching - Whether the model supports context caching
 * @returns Messages with appropriate cache points applied
 */
export const applyAgentLoopCaching = (
  messages: BaseMessage[],
  supportsContextCaching: boolean,
): BaseMessage[] => {
  if (!supportsContextCaching || messages.length <= 1) {
    return messages;
  }

  return applyContextCaching(messages);
};

/**
 * Creates a HumanMessage with array content
 */
const createHumanMessageWithContent = (contentItems: ContentItem[]): HumanMessage => {
  return new HumanMessage({ content: contentItems } as BaseMessageFields);
};

// ============ Message List Truncation ============

/**
 * Truncate a single message to target token count
 * Strategy: Keep head and tail, remove middle part
 */
function truncateMessage(msg: BaseMessage, targetTokens: number): BaseMessage {
  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

  // Use shared truncateContent utility
  const truncatedContent = truncateContentUtil(content, targetTokens);

  // Return appropriate message type
  if (msg instanceof ToolMessage) {
    return new ToolMessage({
      content: truncatedContent,
      tool_call_id: msg.tool_call_id,
      name: msg.name,
    });
  }

  if (msg instanceof AIMessage) {
    return new AIMessage({
      content: truncatedContent,
      tool_calls: msg.tool_calls,
      additional_kwargs: msg.additional_kwargs,
    });
  }

  if (msg instanceof HumanMessage) {
    return new HumanMessage(truncatedContent);
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
  if (last && last !== system) {
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
  const maxOutput = modelInfo.maxOutput || 8000;
  const targetBudget = contextLimit - maxOutput; // Reserve maxOutput tokens for LLM response

  const currentTokens = Math.floor(countMessagesTokens(messages) * 1.3);
  const needToTruncate = currentTokens - targetBudget;

  // No truncation needed
  if (needToTruncate <= 0) {
    return messages;
  }

  // Simple strategy: Sort messages by size, truncate the largest ones
  const messagesWithTokens = messages.map((msg, index) => ({
    index,
    message: msg,
    tokens: countToken(msg.content),
    canTruncate: !(msg instanceof SystemMessage),
  }));

  // Sort by tokens (largest first), but only truncatable messages
  const truncatableMessages = messagesWithTokens
    .filter((item) => item.canTruncate)
    .sort((a, b) => b.tokens - a.tokens);

  // Truncate largest messages until we save enough
  const toTruncate = new Map<number, number>(); // index -> keepTokens
  let saved = 0;

  for (const item of truncatableMessages) {
    if (saved >= needToTruncate) break;

    const needMore = needToTruncate - saved;
    const minKeep = 1000; // Minimum tokens to keep per message
    const maxCanSave = Math.max(0, item.tokens - minKeep);

    if (maxCanSave <= 0) continue;

    if (maxCanSave >= needMore) {
      // This message can save enough by itself
      const keepTokens = item.tokens - needMore;
      toTruncate.set(item.index, keepTokens);
      saved += needMore;
    } else {
      // Truncate this message as much as possible
      toTruncate.set(item.index, minKeep);
      saved += maxCanSave;
    }
  }

  // If can't save enough, fallback to core mode
  if (saved < needToTruncate) {
    const coreMessages = buildCoreMessages(messages, targetBudget);
    return coreMessages;
  }

  // Execute truncation
  const result = messages.map((msg, index) => {
    const keepTokens = toTruncate.get(index);
    if (keepTokens === undefined) return msg; // No truncation
    return truncateMessage(msg, keepTokens); // Truncate to specified size
  });

  return result;
}
