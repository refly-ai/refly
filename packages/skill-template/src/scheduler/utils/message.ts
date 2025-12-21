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

// ============ Message Validation & Sanitization ============

/**
 * Special tokens that should be escaped in message content
 * These tokens can cause API errors when sent to certain model providers
 * We escape them to visible characters instead of removing to preserve user intent
 */
const SPECIAL_TOKENS_ESCAPE_MAP: Record<string, string> = {
  '<|im_end|>': '[im_end]',
  '<|im_start|>': '[im_start]',
  '<|endoftext|>': '[endoftext]',
  '<|pad|>': '[pad]',
  '<|sep|>': '[sep]',
  '<|cls|>': '[cls]',
  '<|mask|>': '[mask]',
  '<|unk|>': '[unk]',
};

// Build regex pattern from keys (case insensitive)
const SPECIAL_TOKENS_PATTERN = new RegExp(
  Object.keys(SPECIAL_TOKENS_ESCAPE_MAP)
    .map((token) => token.replace(/[|]/g, '\\|'))
    .join('|'),
  'gi',
);

/**
 * Escape special tokens in text content to prevent API errors
 * Converts tokens like <|im_end|> to visible [im_end] format
 */
export function sanitizeTextContent(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  return text.replace(SPECIAL_TOKENS_PATTERN, (match) => {
    // Look up the escaped version (case-insensitive)
    const lowerMatch = match.toLowerCase();
    for (const [token, escaped] of Object.entries(SPECIAL_TOKENS_ESCAPE_MAP)) {
      if (token.toLowerCase() === lowerMatch) {
        return escaped;
      }
    }
    return match;
  });
}

/**
 * Validate and sanitize image content in messages
 * Ensures image_url has proper format and url fields
 */
export function validateImageContent(content: ImageUrlContent): {
  isValid: boolean;
  sanitized: ImageUrlContent | null;
  error?: string;
} {
  if (!content || content.type !== 'image_url') {
    return { isValid: false, sanitized: null, error: 'Invalid image content type' };
  }

  if (!content.image_url) {
    return { isValid: false, sanitized: null, error: 'Missing image_url object' };
  }

  if (!content.image_url.url) {
    return { isValid: false, sanitized: null, error: 'Missing image_url.url' };
  }

  // Validate URL format (must be data URI or valid URL)
  const url = content.image_url.url;
  const isDataUri = url.startsWith('data:image/');
  const isHttpUrl = url.startsWith('http://') || url.startsWith('https://');

  if (!isDataUri && !isHttpUrl) {
    return { isValid: false, sanitized: null, error: 'Invalid image URL format' };
  }

  // For data URIs, validate format exists
  if (isDataUri) {
    const formatMatch = url.match(/^data:image\/([^;,]+)/);
    if (!formatMatch || !formatMatch[1]) {
      return { isValid: false, sanitized: null, error: 'Missing image format in data URI' };
    }
  }

  return { isValid: true, sanitized: content };
}

/**
 * Sanitize message content (handles both string and array content)
 */
export function sanitizeMessageContent(content: string | ContentItem[]): {
  sanitized: string | ContentItem[];
  warnings: string[];
} {
  const warnings: string[] = [];

  if (typeof content === 'string') {
    const sanitized = sanitizeTextContent(content);
    if (sanitized !== content) {
      warnings.push('Escaped special tokens in text content');
    }
    return { sanitized, warnings };
  }

  if (!Array.isArray(content)) {
    return { sanitized: content, warnings };
  }

  const sanitizedItems: ContentItem[] = [];

  for (const item of content) {
    if (item.type === 'text') {
      const sanitizedText = sanitizeTextContent(item.text);
      if (sanitizedText !== item.text) {
        warnings.push('Escaped special tokens in text content');
      }
      // Skip empty text content
      if (!sanitizedText || sanitizedText.trim() === '') {
        warnings.push('Skipped empty text content');
        continue;
      }
      sanitizedItems.push({ ...item, text: sanitizedText });
    } else if (item.type === 'image_url') {
      const validation = validateImageContent(item as ImageUrlContent);
      if (validation.isValid && validation.sanitized) {
        sanitizedItems.push(validation.sanitized);
      } else {
        warnings.push(`Skipped invalid image: ${validation.error}`);
      }
    } else {
      // Keep other content types as-is
      sanitizedItems.push(item);
    }
  }

  return { sanitized: sanitizedItems, warnings };
}

/**
 * Validate that a message has non-empty content
 */
export function isValidMessage(message: BaseMessage): boolean {
  const content = message.content;

  if (typeof content === 'string') {
    return content.trim().length > 0;
  }

  if (Array.isArray(content)) {
    return content.some((item: unknown) => {
      if (typeof item === 'string') return item.trim().length > 0;
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if ('text' in obj && typeof obj.text === 'string') {
          return obj.text.trim().length > 0;
        }
        if ('type' in obj && obj.type === 'image_url') {
          return true; // Images are considered valid content
        }
      }
      return false;
    });
  }

  return false;
}

/**
 * Sanitize a single BaseMessage, returning a new message with sanitized content
 */
export function sanitizeMessage(message: BaseMessage): {
  message: BaseMessage;
  warnings: string[];
} {
  const { sanitized, warnings } = sanitizeMessageContent(message.content as string | ContentItem[]);

  const messageType = message._getType();

  if (messageType === 'human') {
    return {
      message: new HumanMessage({ content: sanitized } as BaseMessageFields),
      warnings,
    };
  }

  if (messageType === 'system') {
    return {
      message: new SystemMessage({ content: sanitized } as BaseMessageFields),
      warnings,
    };
  }

  if (messageType === 'ai') {
    const aiMsg = message as AIMessage;
    return {
      message: new AIMessage({
        content: sanitized,
        tool_calls: aiMsg.tool_calls,
        additional_kwargs: aiMsg.additional_kwargs,
      } as BaseMessageFields),
      warnings,
    };
  }

  if (messageType === 'tool') {
    const toolMsg = message as ToolMessage;
    return {
      message: new ToolMessage({
        content: sanitized as string,
        tool_call_id: toolMsg.tool_call_id,
        name: toolMsg.name,
      }),
      warnings,
    };
  }

  // Return original for unknown types
  return { message, warnings };
}

/**
 * Sanitize and validate an array of messages
 * - Removes special tokens from text content
 * - Validates image content format
 * - Filters out empty/invalid messages
 */
export function sanitizeMessages(messages: BaseMessage[]): {
  messages: BaseMessage[];
  warnings: string[];
} {
  const allWarnings: string[] = [];
  const sanitizedMessages: BaseMessage[] = [];

  for (const msg of messages) {
    const { message: sanitized, warnings } = sanitizeMessage(msg);
    allWarnings.push(...warnings);

    // Only include valid messages
    if (isValidMessage(sanitized)) {
      sanitizedMessages.push(sanitized);
    } else {
      allWarnings.push(`Filtered out empty ${msg._getType()} message`);
    }
  }

  return { messages: sanitizedMessages, warnings: allWarnings };
}

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
  logger,
}: {
  systemPrompt: string;
  userPrompt: string;
  chatHistory: BaseMessage[];
  messages: BaseMessage[];
  images: string[];
  modelInfo?: LLMModelConfig;
  logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void };
}) => {
  // Only sanitize user prompt (escape special tokens that may cause API errors)
  // System prompt is generated by us, no need to sanitize
  const sanitizedUserPrompt = sanitizeTextContent(userPrompt);

  // Validate and filter images
  const validImages: string[] = [];
  for (const image of images || []) {
    const tempContent: ImageUrlContent = { type: 'image_url', image_url: { url: image } };
    const validation = validateImageContent(tempContent);
    if (validation.isValid) {
      validImages.push(image);
    } else {
      logger?.warn('Filtered invalid image', { error: validation.error });
    }
  }

  // Prepare the final user message (with or without images)
  const finalUserMessage = validImages.length
    ? createHumanMessageWithContent([
        {
          type: 'text',
          text: sanitizedUserPrompt,
        } as TextContent,
        ...validImages.map(
          (image) =>
            ({
              type: 'image_url',
              image_url: { url: image },
            }) as ImageUrlContent,
        ),
      ])
    : new HumanMessage(sanitizedUserPrompt);

  // Note: We only sanitize the user prompt (already done above) and validate images
  // We do NOT sanitize chat history or other messages to avoid modifying code snippets
  // or technical content that may legitimately contain special tokens

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
 * 2. Session Dynamic Point: After the second-to-last message (messages.length - 2)
 *    - Caches the conversation history for the current user
 *    - Benefits: Reuses multi-turn conversation context within a session
 *
 * LangChain AWS uses cachePoint markers:
 * - Format: { cachePoint: { type: 'default' } }
 * - Place the cachePoint marker AFTER the content to cache
 */
const applyContextCaching = (messages: BaseMessage[]): BaseMessage[] => {
  if (messages.length <= 1) return messages;

  return messages.map((message, index) => {
    // Determine if this message should have a cache point
    // 1. Global Static Point: After System Prompt (index 0)
    // 2. Session Dynamic Point: After the last 3 messages except the last user message (index -2, -3, -4)
    const isGlobalStaticPoint = index === 0;
    const isSessionDynamicPoint =
      index === messages.length - 2 ||
      index === messages.length - 3 ||
      index === messages.length - 4;
    const shouldAddCachePoint = isGlobalStaticPoint || isSessionDynamicPoint;

    if (!shouldAddCachePoint) {
      return message;
    }

    // Apply caching using LangChain's cachePoint format
    // Use _getType() instead of instanceof to handle deserialized messages
    const messageType = message._getType();

    if (messageType === 'system') {
      const textContent =
        typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

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
      const textContent =
        typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

      const aiMessage = message as AIMessage;
      return new AIMessage({
        content: [
          {
            type: 'text',
            text: textContent,
          },
          {
            cachePoint: { type: 'default' },
          },
        ],
        tool_calls: aiMessage.tool_calls,
        additional_kwargs: aiMessage.additional_kwargs,
      } as BaseMessageFields);
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
