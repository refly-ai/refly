import { IContext, SelectedContentDomain, SkillContextContentItemMetadata } from '../types';
import { Source, ResourceType } from '@refly-packages/openapi-schema';
import { truncateContext, truncateMessages } from './truncator';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { getClientOrigin } from '@refly-packages/utils';
import { MAX_NEED_RECALL_TOKEN } from './constants';

export const concatChatHistoryToStr = (messages: BaseMessage[]) => {
  let chatHistoryStr = '';

  if (messages.length > 0) {
    const concatMessage = (content: string, type: string) => {
      return `<ChatHistoryItem type={${type}}>${content}</ChatHistoryItem>`;
    };

    chatHistoryStr += messages.map((m) => {
      const type = (m as HumanMessage)?.getType?.() as string;
      const content = (m?.content || '') as string;
      return concatMessage(content, type);
    });
  }

  if (chatHistoryStr?.length > 0) {
    chatHistoryStr = `<ChatHistory>${chatHistoryStr}</ChatHistory>`;
  }

  return chatHistoryStr;
};

export const concatMergedContextToStr = (mergedContext: {
  mentionedContext: IContext | null;
  lowerPriorityContext: IContext | null;
  webSearchSources: Source[];
}) => {
  const { mentionedContext, lowerPriorityContext, webSearchSources } = mergedContext || {};
  let contextStr = '';
  const currentIndex = 1; // Start index

  // Process mentioned context first
  const mentionedContextConcatRes = mentionedContext
    ? concatContextToStr(mentionedContext, currentIndex)
    : { contextStr: '', nextIndex: currentIndex };

  // Then process lower priority context
  const lowerPriorityContextConcatRes = lowerPriorityContext
    ? concatContextToStr(lowerPriorityContext, mentionedContextConcatRes.nextIndex)
    : { contextStr: '', nextIndex: mentionedContextConcatRes.nextIndex };

  // Finally process web search sources
  const webSearchContexConcatRes = concatContextToStr(
    { webSearchSources },
    lowerPriorityContextConcatRes.nextIndex,
  );

  // Add sections in priority order
  if (mentionedContextConcatRes.contextStr?.length > 0) {
    contextStr += `<MentionedContext>\n${mentionedContextConcatRes.contextStr}\n</MentionedContext>\n\n`;
  }

  if (lowerPriorityContextConcatRes.contextStr?.length > 0) {
    contextStr += `<OtherContext>\n${lowerPriorityContextConcatRes.contextStr}\n</OtherContext>\n\n`;
  }

  if (webSearchContexConcatRes.contextStr?.length > 0) {
    contextStr += `<WebSearchContext>\n${webSearchContexConcatRes.contextStr}\n</WebSearchContext>\n\n`;
  }

  return contextStr.trim();
};

export const flattenMergedContextToSources = (mergedContext: {
  mentionedContext: IContext | null;
  lowerPriorityContext: IContext | null;
  webSearchSources: Source[];
}) => {
  const { mentionedContext, lowerPriorityContext, webSearchSources = [] } = mergedContext || {};

  const sources = [
    // Prioritize mentioned context
    ...(mentionedContext ? flattenContextToSources(mentionedContext) : []),
    // Then lower priority context
    ...(lowerPriorityContext ? flattenContextToSources(lowerPriorityContext) : []),
    // Finally web search sources
    ...flattenContextToSources({
      webSearchSources,
    }),
  ];

  // Remove duplicates while preserving order
  const uniqueSources = sources.filter(
    (source, index, self) =>
      index ===
      self.findIndex(
        (s) =>
          s.url === source.url && s.title === source.title && s.pageContent === source.pageContent,
      ),
  );

  return uniqueSources;
};

// TODO: should replace id with `type-index` for better llm extraction
// citationIndex for each context item is used for LLM to cite the context item in the final answer
export const concatContextToStr = (context: Partial<IContext>, startIndex = 1) => {
  const { contentList = [], resources = [], documents = [], webSearchSources = [] } = context || {};

  let contextStr = '';
  let index = startIndex; // Use passed in startIndex

  if (contentList.length > 0) {
    // contextStr += 'Following are the user selected content: \n';
    const concatContent = (
      content: string,
      from: SelectedContentDomain,
      title: string,
      id?: string,
      url?: string,
    ) => {
      return `<ContextItem citationIndex='[[citation:${index++}]]' type='selectedContent' from='${from}' ${
        id ? `entityId='${id}'` : ''
      } title='${title}' ${url ? `weblinkUrl='${url}'` : ''}>${content}</ContextItem>`;
    };

    const contentStr = contentList
      .map((c) => {
        const { metadata } = c;
        const { domain, entityId, title, url } = metadata as any as SkillContextContentItemMetadata;
        return concatContent(c?.content, domain as SelectedContentDomain, title, entityId, url);
      })
      .join('\n\n');

    contextStr += `\n\n<UserSelectedContent>\n${contentStr}\n</UserSelectedContent>\n\n`;
  }

  if (documents.length > 0) {
    // contextStr += 'Following are the knowledge base documents: \n';
    const concatDocument = (id: string, title: string, content: string) => {
      return `<ContextItem citationIndex='[[citation:${index++}]]' type='document' entityId='${id}' title='${title}'>${content}</ContextItem>`;
    };

    const documentStr = documents
      .map((n) => concatDocument(n.document?.docId, n.document?.title, n.document?.content))
      .join('\n\n');

    contextStr += `\n\n<KnowledgeBaseDocuments>\n${documentStr}\n</KnowledgeBaseDocuments>\n\n`;
  }

  if (resources.length > 0) {
    // contextStr += 'Following are the knowledge base resources: \n';
    const concatResource = (id: string, _type: ResourceType, title: string, content: string) => {
      return `<ContextItem citationIndex='[[citation:${index++}]]' type='resource' entityId='${id}' title='${title}'>${content}</ContextItem>`;
    };

    const resourceStr = resources
      .map((r) =>
        concatResource(
          r.resource?.resourceId,
          r.resource?.resourceType,
          r.resource?.title,
          r.resource?.content,
        ),
      )
      .join('\n');

    contextStr += `\n\n<KnowledgeBaseResources>\n${resourceStr}\n</KnowledgeBaseResources>\n\n`;
  }

  if (webSearchSources.length > 0) {
    // contextStr += 'Following are the web search results: \n';
    const concatWebSearchSource = (url: string, title: string, content: string) => {
      return `<ContextItem citationIndex='[[citation:${index++}]]' type='webSearchSource' url='${url}' title='${title}'>${content}</WebSearchSource>`;
    };

    contextStr += webSearchSources
      .map((s) => concatWebSearchSource(s.url, s.title, s.pageContent))
      .join('\n');
    contextStr += '\n\n';
  }

  return { contextStr, nextIndex: index };
};

export const summarizeContext = (
  context: IContext,
  maxContextTokens: number,
  maxContentLength: number = MAX_NEED_RECALL_TOKEN,
): string => {
  const { contentList = [], resources = [], documents = [] } = context || {};
  const previewedContext: IContext = {
    resources: resources.map((r) => ({
      ...r,
      content: `${r.resource?.content?.slice(0, maxContentLength)}...`,
    })),
    documents: documents.map((n) => ({
      ...n,
      content: `${n.document?.content?.slice(0, maxContentLength)}...`,
    })),
    contentList: contentList.map((c) => ({
      ...c,
      content: `${c.content?.slice(0, maxContentLength)}...`,
    })),
  };
  const truncatedContext = truncateContext(previewedContext, maxContextTokens);

  const contextConcatRes = concatContextToStr(truncatedContext, 1);

  return contextConcatRes.contextStr || 'no available context';
};

export const summarizeChatHistory = (messages: BaseMessage[]): string => {
  const chatHistoryStr = concatChatHistoryToStr(truncateMessages(messages));
  return chatHistoryStr || 'no available chat history';
};

export function flattenContextToSources(context: Partial<IContext>): Source[] {
  const { webSearchSources = [], contentList = [], resources = [], documents = [] } = context || {};
  const sources: Source[] = [];

  // Web search sources
  for (const source of webSearchSources) {
    sources.push({
      url: source.url,
      title: source.title,
      pageContent: source.pageContent,
      metadata: {
        ...source.metadata,
        source: source.url,
        title: source.title,
        sourceType: 'webSearch', // Add source type for web search results
      },
    });
  }

  const _baseUrl = getClientOrigin();

  // User selected content
  for (const content of contentList) {
    const metadata = content.metadata as unknown as SkillContextContentItemMetadata;
    sources.push({
      url: metadata?.url,
      title: metadata?.title,
      pageContent: content.content,
      metadata: {
        ...metadata,
        source: metadata?.url,
        title: metadata?.title,
        entityId: metadata?.entityId,
        entityType: metadata?.domain,
        sourceType: 'library', // Add source type for knowledge base content
      },
    });
  }

  // Knowledge base documents
  for (const document of documents) {
    sources.push({
      url: '', // TODO: fix this
      title: document.document?.title,
      pageContent: document.document?.content || '',
      metadata: {
        title: document.document?.title,
        entityId: document.document?.docId,
        entityType: 'document',
        source: '', // TODO: fix this
        sourceType: 'library', // Add source type for knowledge base documents
      },
    });
  }

  // Knowledge base resources
  for (const resource of resources) {
    sources.push({
      url: resource?.resource?.data?.url, // TODO: fix this
      title: resource.resource?.title,
      pageContent: resource.resource?.content || '',
      metadata: {
        title: resource.resource?.title,
        entityId: resource.resource?.resourceId,
        entityType: 'resource',
        source: resource?.resource?.data?.url, // TODO: fix this
        sourceType: 'library', // Add source type for knowledge base resources
      },
    });
  }

  return sources;
}
