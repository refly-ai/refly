import { IContext, SelectedContentDomain, SkillContextContentItemMetadata } from '../types';
import { Source, ResourceType } from '@refly/openapi-schema';
import { truncateContext, truncateMessages } from './truncator';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { getClientOrigin } from '@refly/utils';
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
  urlSources?: Source[];
  mentionedContext: IContext | null;
  relevantContext: IContext | null;
  webSearchSources: Source[];
  librarySearchSources?: Source[];
}) => {
  const {
    urlSources = [],
    mentionedContext,
    relevantContext,
    webSearchSources,
    librarySearchSources = [],
  } = mergedContext || {};
  let contextStr = '';
  const currentIndex = 1; // Start index

  // Process URL sources first (highest priority)
  const urlSourcesConcatRes = concatContextToStr({ urlSources }, currentIndex);

  // Process mentioned context next
  const mentionedContextConcatRes = mentionedContext
    ? concatContextToStr(mentionedContext, urlSourcesConcatRes.nextIndex)
    : { contextStr: '', nextIndex: urlSourcesConcatRes.nextIndex };

  // Then process relevant context
  const relevantContextConcatRes = relevantContext
    ? concatContextToStr(relevantContext, mentionedContextConcatRes.nextIndex)
    : { contextStr: '', nextIndex: mentionedContextConcatRes.nextIndex };

  // Process web search sources
  const webSearchContexConcatRes = concatContextToStr(
    { webSearchSources },
    relevantContextConcatRes.nextIndex,
  );

  // Process library search sources
  const librarySearchContextConcatRes = concatContextToStr(
    { librarySearchSources },
    webSearchContexConcatRes.nextIndex,
  );

  // Add sections in priority order
  if (urlSourcesConcatRes.contextStr?.length > 0) {
    contextStr += `<UrlSources>\n${urlSourcesConcatRes.contextStr}\n</UrlSources>\n\n`;
  }

  if (mentionedContextConcatRes.contextStr?.length > 0) {
    contextStr += `<MentionedContext>\n${mentionedContextConcatRes.contextStr}\n</MentionedContext>\n\n`;
  }

  if (relevantContextConcatRes.contextStr?.length > 0) {
    contextStr += `<RelevantContext>\n${relevantContextConcatRes.contextStr}\n</RelevantContext>\n\n`;
  }

  if (webSearchContexConcatRes.contextStr?.length > 0) {
    contextStr += `<WebSearchContext>\n${webSearchContexConcatRes.contextStr}\n</WebSearchContext>\n\n`;
  }

  if (librarySearchContextConcatRes.contextStr?.length > 0) {
    contextStr += `<LibrarySearchContext>\n${librarySearchContextConcatRes.contextStr}\n</LibrarySearchContext>\n\n`;
  }

  return contextStr.trim();
};

export const flattenMergedContextToSources = (mergedContext: {
  urlSources?: Source[];
  mentionedContext: IContext | null;
  relevantContext: IContext | null;
  webSearchSources: Source[];
  librarySearchSources?: Source[];
}) => {
  const {
    urlSources = [],
    mentionedContext,
    relevantContext,
    webSearchSources = [],
    librarySearchSources = [],
  } = mergedContext || {};

  const sources = [
    // Prioritize URL sources (highest priority)
    ...flattenContextToSources({
      urlSources,
    }),
    // Then mentioned context
    ...(mentionedContext ? flattenContextToSources(mentionedContext) : []),
    // Then relevant context
    ...(relevantContext ? flattenContextToSources(relevantContext) : []),
    // Then web search sources
    ...flattenContextToSources({
      webSearchSources,
    }),
    // Finally library search sources
    ...flattenContextToSources({
      librarySearchSources,
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
  const {
    contentList = [],
    resources = [],
    documents = [],
    webSearchSources = [],
    librarySearchSources = [],
    urlSources = [],
  } = context || {};

  let contextStr = '';
  let index = startIndex; // Use passed in startIndex

  // Process URL sources first (highest priority)
  if (urlSources.length > 0) {
    const concatUrlSource = (url: string, title: string, content: string) => {
      return `<ContextItem citationIndex='[[citation:${index++}]]' type='urlSource' url='${url}' title='${title}'>${content}</ContextItem>`;
    };

    contextStr += urlSources.map((s) => concatUrlSource(s.url, s.title, s.pageContent)).join('\n');
    contextStr += '\n\n';
  }

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
      return `<ContextItem citationIndex='[[citation:${index++}]]' type='webSearchSource' url='${url}' title='${title}'>${content}</ContextItem>`;
    };

    contextStr += webSearchSources
      .map((s) => concatWebSearchSource(s.url, s.title, s.pageContent))
      .join('\n');
    contextStr += '\n\n';
  }

  if (librarySearchSources.length > 0) {
    // contextStr += 'Following are the library search results: \n';
    const concatLibrarySearchSource = (source: Source) => {
      const metadata = source.metadata || {};
      const entityId = metadata.entityId;
      const entityType = metadata.entityType;

      return `<ContextItem citationIndex='[[citation:${index++}]]' type='librarySearchSource' url='${source.url || ''}' title='${source.title || ''}' ${entityId ? `entityId='${entityId}'` : ''} ${entityType ? `entityType='${entityType}'` : ''}>${source.pageContent || ''}</ContextItem>`;
    };

    contextStr += librarySearchSources.map((s) => concatLibrarySearchSource(s)).join('\n');
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
  const {
    webSearchSources = [],
    librarySearchSources = [],
    urlSources = [],
    contentList = [],
    resources = [],
    documents = [],
  } = context || {};
  const sources: Source[] = [];

  // URL sources (highest priority)
  for (const source of urlSources) {
    sources.push({
      url: source.url,
      title: source.title,
      pageContent: source.pageContent,
      metadata: {
        ...source.metadata,
        source: source.url,
        title: source.title,
        sourceType: 'webSearch', // Use 'webSearch' as source type for URL sources
      },
    });
  }

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

  // Library search sources
  for (const source of librarySearchSources) {
    sources.push({
      url: source.url,
      title: source.title,
      pageContent: source.pageContent,
      metadata: {
        ...source.metadata,
        source: source.url,
        title: source.title,
        sourceType: 'library', // Use 'library' as source type for library search results
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
