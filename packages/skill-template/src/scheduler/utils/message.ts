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

  console.log(`buildFinalRequestMessages: ${modelInfo?.contextLimit}`);

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

/**
 * Truncate a single message to target token count
 * Strategy: Keep head and tail, remove middle part
 */
function truncateMessage(msg: BaseMessage, targetTokens: number): BaseMessage {
  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
  const currentTokens = countToken(content);

  if (currentTokens <= targetTokens) {
    return msg;
  }

  // Strategy: Keep 70% at head, 30% at tail
  const headRatio = 0.7;
  const tailRatio = 0.3;

  // Reserve tokens for the truncation message
  const truncationMessageTokens = 50;
  const availableTokens = Math.max(100, targetTokens - truncationMessageTokens);

  const headTargetTokens = Math.floor(availableTokens * headRatio);
  const tailTargetTokens = Math.floor(availableTokens * tailRatio);

  // Binary search for head length
  let headLength = 0;
  {
    let left = 0;
    let right = content.length;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = content.substring(0, mid);
      const tokens = countToken(truncated);

      if (tokens <= headTargetTokens) {
        headLength = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
  }

  // Binary search for tail length
  let tailLength = 0;
  {
    let left = 0;
    let right = content.length;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = content.substring(content.length - mid);
      const tokens = countToken(truncated);

      if (tokens <= tailTargetTokens) {
        tailLength = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
  }

  const headContent = content.substring(0, headLength);
  const tailContent = content.substring(content.length - tailLength);
  const removedChars = content.length - headLength - tailLength;
  const removedTokens = currentTokens - countToken(headContent) - countToken(tailContent);

  const truncationMessage = `\n\n[... Middle part truncated: removed ${removedChars} chars (≈${removedTokens} tokens) ...]\n\n`;
  const truncatedContent = headContent + truncationMessage + tailContent;

  // Return appropriate message type
  if (msg instanceof ToolMessage) {
    return new ToolMessage({
      content: truncatedContent,
      tool_call_id: msg.tool_call_id,
      name: msg.name,
    });
  }

  if (msg instanceof AIMessage) {
    return new AIMessage(truncatedContent);
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

  console.warn(`Core mode: ${messages.length} -> ${result.length} messages`);
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
