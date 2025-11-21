import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
  BaseMessageFields,
} from '@langchain/core/messages';
import { LLMModelConfig } from '@refly/openapi-schema';
import { ContextBlock } from './context';

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
  const requestMessages = [
    new SystemMessage(systemPrompt), // System message comes first in our implementation
    ...chatHistory, // Historical conversation
    ...messages, // Additional messages
    finalUserMessage, // The actual query that needs a response (should not be cached)
  ];

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
