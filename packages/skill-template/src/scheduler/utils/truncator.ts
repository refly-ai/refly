import {
  SkillContextContentItem,
  SkillContextDocumentItem,
  SkillContextResourceItem,
  Source,
} from '@refly-packages/openapi-schema';
import { BaseSkill, SkillRunnableConfig } from '../../base';
import { sortContentBySimilarity } from './semanticSearch';

import { IContext, GraphState } from '../types';
import { countToken } from './token';
import { BaseMessage, MessageContent } from '@langchain/core/messages';

// chat history params
import { MAX_MESSAGES, MAX_MESSAGE_TOKENS, MAX_MESSAGES_TOTAL_TOKENS } from './constants';

export const isEmptyMessage = (message: BaseMessage) => {
  if (typeof message.content === 'string') {
    return message.content.trim() === '';
  }

  if (message.content.length === 0) {
    return true;
  }

  // If the message contains an image, it is not empty
  if (message.content.some((item) => item.type === 'image_url')) {
    return false;
  }

  const textContent = message.content
    .map((item) => (item.type === 'text' ? item.text : ''))
    .join('\n\n');
  return textContent.trim() === '';
};

export const truncateMessages = (
  messages: BaseMessage[] = [],
  maxMessages = MAX_MESSAGES,
  maxMessageTokens = MAX_MESSAGE_TOKENS,
  maxMessagesTotalTokens = MAX_MESSAGES_TOTAL_TOKENS,
): BaseMessage[] => {
  let totalTokens = 0;
  const truncatedMessages: BaseMessage[] = [];

  for (let i = messages.length - 1; i >= Math.max(0, messages.length - maxMessages); i--) {
    const message = messages[i];
    let content = message.content;
    let tokens = countToken(content);

    if (tokens > maxMessageTokens) {
      content = truncateTextWithToken(content, maxMessageTokens);
      tokens = maxMessageTokens;
    }

    if (totalTokens + tokens > maxMessagesTotalTokens) {
      break;
    }

    message.content = content; // replace content other than new message
    truncatedMessages.unshift(message);
    totalTokens += tokens;
  }

  return truncatedMessages;
};

export const truncateTextWithToken = (content: MessageContent, maxTokens: number): string => {
  if (!content) return '';

  if (typeof content !== 'string') {
    const textContent = content.map((item) => (item.type === 'text' ? item.text : '')).join('\n\n');
    return truncateTextWithToken(textContent, maxTokens);
  }

  const words = content.split(' ');
  let truncatedText = '';
  let currentTokens = 0;

  for (const word of words) {
    const wordTokens = countToken(word);
    if (currentTokens + wordTokens <= maxTokens) {
      truncatedText += (truncatedText ? ' ' : '') + word;
      currentTokens += wordTokens;
    } else {
      break;
    }
  }

  return truncatedText + (truncatedText.length < content.length ? '...' : '');
};

export const truncateContext = (context: IContext, maxTokens: number): IContext => {
  let remainingTokens = maxTokens;
  const truncatedContext: IContext = { ...context };

  // Helper function to truncate a list of items, truncate priority is resource > document > contentList
  const truncateItems = <
    T extends SkillContextContentItem | SkillContextResourceItem | SkillContextDocumentItem,
  >(
    items: T[],
    getContent: (item: T) => string,
    setContent: (item: T, content: string) => T,
  ): T[] => {
    const truncatedItems: T[] = [];
    for (const item of items) {
      const content = getContent(item);
      const tokens = countToken(content);
      if (tokens <= remainingTokens) {
        truncatedItems.push(item);
        remainingTokens -= tokens;
      } else if (remainingTokens > 0) {
        const truncatedContent = truncateTextWithToken(content, remainingTokens);
        truncatedItems.push(setContent(item, truncatedContent));
        remainingTokens = 0;
      } else {
        break;
      }
    }
    return truncatedItems;
  };

  // Truncate resources
  truncatedContext.resources = truncateItems<SkillContextResourceItem>(
    context.resources,
    (item) => item.resource?.content ?? '',
    (item, content) => ({ ...item, resource: { ...item.resource, content } }),
  );

  // Truncate documents
  truncatedContext.documents = truncateItems<SkillContextDocumentItem>(
    context.documents,
    (item) => item.document?.content ?? '',
    (item, content) => ({ ...item, document: { ...item.document, content } }),
  );

  // Truncate contentList
  truncatedContext.contentList = truncateItems<SkillContextContentItem>(
    context.contentList,
    (item) => item.content || '',
    (item, content) => ({ ...item, content }),
  );

  return truncatedContext;
};

export async function mergeAndTruncateContexts(
  relevantContext: IContext,
  containerLevelContext: IContext,
  query: string,
  maxTokens: number,
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill; state: GraphState },
): Promise<IContext> {
  // 1. Handle contentList (highest priority)
  const allContentList = [...relevantContext.contentList, ...containerLevelContext.contentList];
  const uniqueContentList = Array.from(
    new Set(allContentList.map((item) => JSON.stringify(item))),
  ).map((item) => JSON.parse(item));

  let sortedContentList: SkillContextContentItem[] = [];
  if (uniqueContentList.length > 1) {
    sortedContentList = await sortContentBySimilarity(query, uniqueContentList, ctx);
  } else {
    sortedContentList = uniqueContentList;
  }

  // 2. Merge resources and documents into one array
  const combinedItems: (SkillContextResourceItem | SkillContextDocumentItem)[] = [
    ...relevantContext.resources,
    ...relevantContext.documents,
    ...containerLevelContext.resources,
    ...containerLevelContext.documents,
  ];

  // 3. Deduplicate (by id and content combination)
  const uniqueCombinedItems = Array.from(
    new Set(
      combinedItems.map((item) => {
        const id =
          (item as SkillContextResourceItem).resource?.resourceId ??
          (item as SkillContextDocumentItem).document?.docId;
        const content =
          (item as SkillContextResourceItem).resource?.content ??
          (item as SkillContextDocumentItem).document?.content;
        return `${id}:${content}`;
      }),
    ),
  ).map(
    (key) =>
      combinedItems.find((item) => {
        const id =
          (item as SkillContextResourceItem).resource?.resourceId ??
          (item as SkillContextDocumentItem).document?.docId;
        const content =
          (item as SkillContextResourceItem).resource?.content ??
          (item as SkillContextDocumentItem).document?.content;
        return `${id}:${content}` === key;
      }) ?? combinedItems[0],
  );

  // 4. Sort by similarity
  const itemsForSorting = uniqueCombinedItems.map((item) => ({
    content:
      (item as SkillContextResourceItem).resource?.content ??
      (item as SkillContextDocumentItem).document?.content,
    metadata: {
      type: 'resource' in item ? 'resource' : 'document',
      id:
        (item as SkillContextResourceItem).resource?.resourceId ??
        (item as SkillContextDocumentItem).document?.docId,
    },
  }));

  let sortedItems: (SkillContextResourceItem | SkillContextDocumentItem)[] = [];
  if (itemsForSorting.length > 1) {
    sortedItems = await sortContentBySimilarity(query, itemsForSorting, ctx);
  } else {
    sortedItems = itemsForSorting;
  }

  // Restore the actual items after sorting
  const sortedCombinedItems = sortedItems.map(
    (sortedItem) =>
      uniqueCombinedItems.find(
        (item) =>
          ('resource' in item ? 'resource' : 'document') === sortedItem.metadata.type &&
          ((item as SkillContextResourceItem).resource?.resourceId ??
            (item as SkillContextDocumentItem).document?.docId) === sortedItem.metadata.id,
      ) ?? uniqueCombinedItems[0],
  );

  // 5. Truncate
  const truncatedContext = truncateContextWithPriority(
    sortedContentList,
    sortedCombinedItems,
    maxTokens,
  );

  return truncatedContext;
}

function truncateContextWithPriority(
  contentList: SkillContextContentItem[],
  combinedItems: any[],
  maxTokens: number,
): IContext {
  let remainingTokens = maxTokens;
  const truncatedContext: IContext = {
    contentList: [],
    resources: [],
    documents: [],
  };

  // First, add contentList items
  for (const item of contentList) {
    const tokens = countToken(item.content);
    if (remainingTokens >= tokens) {
      truncatedContext.contentList.push(item);
      remainingTokens -= tokens;
    } else {
      break;
    }
  }

  // Then, add combined items (resources and documents)
  for (const item of combinedItems) {
    const content = 'resource' in item ? item.resource?.content : item.document?.content;
    const tokens = countToken(content);
    if (remainingTokens >= tokens) {
      if ('resource' in item) {
        truncatedContext.resources.push(item);
      } else {
        truncatedContext.documents.push(item);
      }
      remainingTokens -= tokens;
    } else {
      break;
    }
  }

  return truncatedContext;
}

/**
 * Truncate text to a maximum length, considering both character count and word count
 * @param text Text to truncate
 * @param maxChars Maximum number of characters (default: 170)
 * @param maxWords Maximum number of words (default: 30)
 * @returns Truncated text with ellipsis if needed
 */
function truncateTextWithWord(text: string, maxChars = 170, maxWords = 30): string {
  // First check word count
  const words = text.split(/\s+/);
  let truncatedText = text;

  if (words.length > maxWords) {
    truncatedText = words.slice(0, maxWords).join(' ');
  }

  // Then check character count
  if (truncatedText.length > maxChars) {
    truncatedText = truncatedText.slice(0, maxChars);
    // Ensure we don't cut in the middle of a word
    const lastSpace = truncatedText.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.8) {
      // Only trim to last space if it's not too far back
      truncatedText = truncatedText.slice(0, lastSpace);
    }
  }

  // Add ellipsis if text was truncated
  if (truncatedText.length < text.length) {
    truncatedText = `${truncatedText.trim()}...`;
  }

  return truncatedText;
}

/**
 * Truncate source by limiting pageContent length to improve performance
 * @param sources Array of sources or single source object
 * @returns Truncated source(s) with limited content length
 */
export function truncateSource<T extends Source | Source[]>(sources: T): T {
  if (Array.isArray(sources)) {
    return sources.map((source) => ({
      ...source,
      pageContent: truncateTextWithWord(source.pageContent),
      // Also truncate selections if they exist
      selections: source.selections?.map((selection) => ({
        ...selection,
        content: selection.content ? truncateTextWithWord(selection.content) : '',
      })),
    })) as T;
  }

  return {
    ...sources,
    pageContent: truncateTextWithWord(sources.pageContent),
    // Also truncate selections if they exist
    selections: sources.selections?.map((selection) => ({
      ...selection,
      content: selection.content ? truncateTextWithWord(selection.content) : '',
    })),
  } as T;
}

/**
 * Truncate sources by token limit
 * @param sources Array of sources
 * @param maxTokens Maximum number of tokens allowed for all sources combined
 * @returns Truncated sources array that fits within token limit
 */
export function truncateSourcesByTokenLimit(sources: Source[], maxTokens: number): Source[] {
  if (!sources || sources.length === 0 || maxTokens <= 0) {
    return [];
  }

  let remainingTokens = maxTokens;
  const truncatedSources: Source[] = [];

  for (const source of sources) {
    // Calculate tokens for this source
    const sourceTokens = countToken(source.pageContent);

    if (sourceTokens <= remainingTokens) {
      // Source fits completely
      truncatedSources.push(source);
      remainingTokens -= sourceTokens;
    } else if (remainingTokens > 0) {
      // Source needs to be truncated
      const truncatedContent = truncateTextWithToken(source.pageContent, remainingTokens);
      truncatedSources.push({
        ...source,
        pageContent: truncatedContent,
      });
      remainingTokens = 0;
    } else {
      // No tokens left
      break;
    }
  }

  return truncatedSources;
}
