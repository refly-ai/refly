import {
  SkillContextContentItem,
  SkillContextResourceItem,
  SkillContextDocumentItem,
  SearchDomain,
  Entity,
} from '@refly/openapi-schema';
import { BaseSkill, SkillRunnableConfig } from '../../base';
import { IContext, SkillContextContentItemMetadata } from '../types';
import { countToken } from './token';
import {
  MAX_NEED_RECALL_CONTENT_TOKEN,
  MAX_NEED_RECALL_TOKEN,
  SHORT_CONTENT_THRESHOLD,
} from './constants';
import { DocumentInterface, Document } from '@langchain/core/documents';
import { ContentNodeType, NodeMeta } from '../../engine';
import { truncateTextWithToken } from './truncator';
import {
  MAX_RAG_RELEVANT_CONTENT_RATIO,
  MAX_SHORT_CONTENT_RATIO,
  MAX_RAG_RELEVANT_DOCUMENTS_RATIO,
  MAX_SHORT_DOCUMENTS_RATIO,
  MAX_RAG_RELEVANT_RESOURCES_RATIO,
  MAX_SHORT_RESOURCES_RATIO,
  MAX_URL_SOURCES_TOKENS,
} from './constants';
import { Source } from '@refly/openapi-schema';

// TODO:替换成实际的 Chunk 定义，然后进行拼接，拼接时包含元数据和分隔符
export function assembleChunks(chunks: DocumentInterface[] = []): string {
  // if chunks has metadata.start, sort by start
  if (chunks?.[0]?.metadata?.start) {
    chunks.sort((a, b) => a.metadata.start - b.metadata.start);
  }

  return chunks.map((chunk) => chunk.pageContent).join('\n [...] \n');
}

export async function sortContentBySimilarity(
  query: string,
  contentList: SkillContextContentItem[],
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<SkillContextContentItem[]> {
  // 1. construct documents
  const documents: Document<NodeMeta>[] = contentList.map((item) => {
    return {
      pageContent: truncateTextWithToken(item.content, MAX_NEED_RECALL_CONTENT_TOKEN),
      metadata: {
        ...item.metadata,
        title: item.metadata?.title as string,
        nodeType: item.metadata?.entityType as ContentNodeType,
      },
    };
  });

  // 2. index documents
  const res = await ctx.ctxThis.engine.service.inMemorySearchWithIndexing(
    ctx.config.configurable.user,
    {
      content: documents,
      query,
      k: documents.length,
      filter: undefined,
    },
  );
  const sortedContent = res.data;

  // 4. return sorted content
  return sortedContent.map((item) => ({
    content: item.pageContent,
    metadata: {
      ...item.metadata,
    },
  }));
}

export async function sortDocumentsBySimilarity(
  query: string,
  comingDocuments: SkillContextDocumentItem[],
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<SkillContextDocumentItem[]> {
  // 1. construct documents
  const documents: Document<NodeMeta>[] = comingDocuments.map((item) => {
    return {
      pageContent: truncateTextWithToken(item.document?.content || '', MAX_NEED_RECALL_TOKEN),
      metadata: {
        ...item.metadata,
        title: item.document?.title as string,
        nodeType: 'document' as ContentNodeType,
        docId: item.document?.docId,
      },
    };
  });

  // 2. index documents
  const res = await ctx.ctxThis.engine.service.inMemorySearchWithIndexing(
    ctx.config.configurable.user,
    {
      content: documents,
      query,
      k: documents.length,
      filter: undefined,
    },
  );
  const sortedDocuments = res.data;

  // 4. return sorted documents
  return sortedDocuments
    .map((item) =>
      comingDocuments.find((document) => document.document?.docId === item.metadata.docId),
    )
    .filter((document): document is SkillContextDocumentItem => document !== undefined);
}

export async function sortResourcesBySimilarity(
  query: string,
  resources: SkillContextResourceItem[],
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<SkillContextResourceItem[]> {
  // 1. construct documents
  const documents: Document<NodeMeta>[] = resources.map((item) => {
    return {
      pageContent: truncateTextWithToken(item.resource?.content || '', MAX_NEED_RECALL_TOKEN),
      metadata: {
        ...item.metadata,
        title: item.resource?.title as string,
        nodeType: 'resource' as ContentNodeType,
        resourceId: item.resource?.resourceId,
      },
    };
  });

  // 2. index documents
  const res = await ctx.ctxThis.engine.service.inMemorySearchWithIndexing(
    ctx.config.configurable.user,
    {
      content: documents,
      query,
      k: documents.length,
      filter: undefined,
    },
  );
  const sortedResources = res.data;

  // 4. return sorted resources
  return sortedResources
    .map((item) =>
      resources.find((resource) => resource.resource?.resourceId === item.metadata.resourceId),
    )
    .filter((resource): resource is SkillContextResourceItem => resource !== undefined);
}

export async function processSelectedContentWithSimilarity(
  query: string,
  contentList: SkillContextContentItem[],
  maxTokens: number,
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<SkillContextContentItem[]> {
  const MAX_RAG_RELEVANT_CONTENT_MAX_TOKENS = Math.floor(
    maxTokens * MAX_RAG_RELEVANT_CONTENT_RATIO,
  );
  const _MAX_SHORT_CONTENT_MAX_TOKENS = Math.floor(maxTokens * MAX_SHORT_CONTENT_RATIO);

  if (contentList.length === 0) {
    return [];
  }

  // 1. calculate similarity and sort
  const sortedContent: SkillContextContentItem[] = contentList;

  const result: SkillContextContentItem[] = [];
  let usedTokens = 0;

  // 2. 按相关度顺序处理 content
  for (const content of sortedContent) {
    const contentTokens = countToken(content.content);

    if (contentTokens > MAX_NEED_RECALL_CONTENT_TOKEN) {
      // 2.1 大内容，直接走召回
      const contentMeta = content?.metadata as any as SkillContextContentItemMetadata;
      const relevantChunks = await inMemoryGetRelevantChunks(
        query,
        content.content,
        {
          entityId: contentMeta?.entityId,
          title: contentMeta?.title,
          entityType: contentMeta?.domain,
        },
        ctx,
      );
      const relevantContent = assembleChunks(relevantChunks);
      result.push({ ...content, content: relevantContent });
      usedTokens += countToken(relevantContent);
    } else if (usedTokens + contentTokens <= MAX_RAG_RELEVANT_CONTENT_MAX_TOKENS) {
      // 2.2 小内容，直接添加
      result.push(content);
      usedTokens += contentTokens;
    } else {
      // 2.3 达到 MAX_RAG_RELEVANT_CONTENT_MAX_TOKENS，处理剩余内容
      break;
    }

    if (usedTokens >= MAX_RAG_RELEVANT_CONTENT_MAX_TOKENS) break;
  }

  // 3. 处理剩余的 content
  for (let i = result.length; i < sortedContent.length; i++) {
    const remainingContent = sortedContent[i];
    const contentTokens = countToken(remainingContent.content);

    // 所有的短内容直接添加
    if (contentTokens < SHORT_CONTENT_THRESHOLD) {
      result.push(remainingContent);
      usedTokens += contentTokens;
    } else {
      // 剩下的长内容走召回
      const remainingTokens = maxTokens - usedTokens;
      const contentMeta = remainingContent?.metadata as any as SkillContextContentItemMetadata;
      let relevantChunks = await inMemoryGetRelevantChunks(
        query,
        remainingContent.content,
        {
          entityId: contentMeta?.entityId,
          title: contentMeta?.title,
          entityType: contentMeta?.domain,
        },
        ctx,
      );
      relevantChunks = truncateChunks(relevantChunks, remainingTokens);
      const relevantContent = assembleChunks(relevantChunks);
      result.push({ ...remainingContent, content: relevantContent });
      usedTokens += countToken(relevantContent);
    }

    if (usedTokens >= maxTokens) break;
  }

  return result;
}

export async function processDocumentsWithSimilarity(
  query: string,
  comingDocuments: SkillContextDocumentItem[],
  maxTokens: number,
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<SkillContextDocumentItem[]> {
  const MAX_RAG_RELEVANT_DOCUMENTS_MAX_TOKENS = Math.floor(
    maxTokens * MAX_RAG_RELEVANT_DOCUMENTS_RATIO,
  );
  const _MAX_SHORT_DOCUMENTS_MAX_TOKENS = Math.floor(maxTokens * MAX_SHORT_DOCUMENTS_RATIO);

  if (comingDocuments.length === 0) {
    return [];
  }

  // 1. calculate similarity and sort
  let sortedDocuments: SkillContextDocumentItem[] = [];
  if (comingDocuments.length > 1) {
    sortedDocuments = await sortDocumentsBySimilarity(query, comingDocuments, ctx);
  } else {
    sortedDocuments = comingDocuments;
  }

  const result: SkillContextDocumentItem[] = [];
  let usedTokens = 0;

  // 2. 按相关度顺序处理 document
  for (const document of sortedDocuments) {
    const documentTokens = countToken(document?.document?.content || '');

    if (
      documentTokens > MAX_NEED_RECALL_TOKEN ||
      (typeof document?.metadata?.useWholeContent === 'boolean' &&
        !document.metadata?.useWholeContent)
    ) {
      // 1.1 大内容，直接走召回
      let relevantChunks = await knowledgeBaseSearchGetRelevantChunks(
        query,
        {
          entities: [
            {
              entityId: document?.document?.docId,
              entityType: 'document',
            },
          ],
          domains: ['document'],
          limit: 10,
        },
        ctx,
      );

      // If knowledge base search returns empty results, fallback to in-memory search
      if (!relevantChunks || relevantChunks.length === 0) {
        relevantChunks = await inMemoryGetRelevantChunks(
          query,
          document?.document?.content || '',
          {
            entityId: document?.document?.docId,
            title: document?.document?.title || '',
            entityType: 'document',
          },
          ctx,
        );
      }

      const relevantContent = assembleChunks(relevantChunks);
      result.push({ ...document, document: { ...document.document, content: relevantContent } });
      usedTokens += countToken(relevantContent);
    } else if (usedTokens + documentTokens <= MAX_RAG_RELEVANT_DOCUMENTS_MAX_TOKENS) {
      // 1.2 小内容，直接添加
      result.push(document);
      usedTokens += documentTokens;
    } else {
      // 1.3 达到 MAX_RAG_RELEVANT_DOCUMENTS_MAX_TOKENS，处理剩余内容
      break;
    }

    if (usedTokens >= MAX_RAG_RELEVANT_DOCUMENTS_MAX_TOKENS) break;
  }

  // 3. 处理剩余的 document
  for (let i = result.length; i < sortedDocuments.length; i++) {
    const remainingDocument = sortedDocuments[i];
    const documentTokens = countToken(remainingDocument?.document?.content || '');

    // 所有的短内容直接添加
    if (documentTokens < SHORT_CONTENT_THRESHOLD) {
      result.push(remainingDocument);
      usedTokens += documentTokens;
    } else {
      // 剩下的长内容走召回
      const remainingTokens = maxTokens - usedTokens;
      let relevantChunks = await knowledgeBaseSearchGetRelevantChunks(
        query,
        {
          entities: [
            {
              entityId: remainingDocument?.document?.docId,
              entityType: 'document',
            },
          ],
          domains: ['document'],
          limit: 10,
        },
        ctx,
      );

      // If knowledge base search returns empty results, fallback to in-memory search
      if (!relevantChunks || relevantChunks.length === 0) {
        relevantChunks = await inMemoryGetRelevantChunks(
          query,
          remainingDocument?.document?.content || '',
          {
            entityId: remainingDocument?.document?.docId,
            title: remainingDocument?.document?.title || '',
            entityType: 'document',
          },
          ctx,
        );
      }

      relevantChunks = truncateChunks(relevantChunks, remainingTokens);
      const relevantContent = assembleChunks(relevantChunks);
      result.push({
        ...remainingDocument,
        document: { ...remainingDocument.document, content: relevantContent },
      });
      usedTokens += countToken(relevantContent);
    }
  }

  return result;
}

export async function processResourcesWithSimilarity(
  query: string,
  resources: SkillContextResourceItem[],
  maxTokens: number,
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<SkillContextResourceItem[]> {
  const MAX_RAG_RELEVANT_RESOURCES_MAX_TOKENS = Math.floor(
    maxTokens * MAX_RAG_RELEVANT_RESOURCES_RATIO,
  );
  const _MAX_SHORT_RESOURCES_MAX_TOKENS = Math.floor(maxTokens * MAX_SHORT_RESOURCES_RATIO);

  if (resources.length === 0) {
    return [];
  }

  // 1. calculate similarity and sort
  let sortedResources: SkillContextResourceItem[] = [];
  if (resources.length > 1) {
    sortedResources = await sortResourcesBySimilarity(query, resources, ctx);
  } else {
    sortedResources = resources;
  }

  const result: SkillContextResourceItem[] = [];
  let usedTokens = 0;

  // 2. 按相关度顺序处理 resources
  for (const resource of sortedResources) {
    const resourceTokens = countToken(resource?.resource?.content || '');

    if (resourceTokens > MAX_NEED_RECALL_TOKEN || !resource.metadata?.useWholeContent) {
      // 2.1 大内容，直接走召回
      let relevantChunks = await knowledgeBaseSearchGetRelevantChunks(
        query,
        {
          entities: [
            {
              entityId: resource?.resource?.resourceId,
              entityType: 'resource',
            },
          ],
          domains: ['resource'],
          limit: 10,
        },
        ctx,
      );

      // If knowledge base search returns empty results, fallback to in-memory search
      if (!relevantChunks || relevantChunks.length === 0) {
        relevantChunks = await inMemoryGetRelevantChunks(
          query,
          resource?.resource?.content || '',
          {
            entityId: resource?.resource?.resourceId,
            title: resource?.resource?.title || '',
            entityType: 'resource',
          },
          ctx,
        );
      }

      const relevantContent = assembleChunks(relevantChunks);
      result.push({ ...resource, resource: { ...resource.resource, content: relevantContent } });
      usedTokens += countToken(relevantContent);
    } else if (usedTokens + resourceTokens <= MAX_RAG_RELEVANT_RESOURCES_MAX_TOKENS) {
      // 2.2 小内容，直接添加
      result.push(resource);
      usedTokens += resourceTokens;
    } else {
      // 2.3 达到 MAX_RAG_RELEVANT_RESOURCES_MAX_TOKENS，处理剩余内容
      break;
    }

    if (usedTokens >= MAX_RAG_RELEVANT_RESOURCES_MAX_TOKENS) break;
  }

  // 3. 处理剩余的 resources，目前考虑所有资源，等实际运行看是否存在超出的
  // for (let i = result.length; i < sortedResources.length && usedTokens < maxTokens; i++) {
  for (let i = result.length; i < sortedResources.length; i++) {
    const remainingResource = sortedResources[i];
    const resourceTokens = countToken(remainingResource?.resource?.content || '');

    // 所有的短内容直接添加
    if (resourceTokens < SHORT_CONTENT_THRESHOLD) {
      result.push(remainingResource);
      usedTokens += resourceTokens;
    } else {
      // 长内容走召回
      const remainingTokens = maxTokens - usedTokens;
      let relevantChunks = await knowledgeBaseSearchGetRelevantChunks(
        query,
        {
          entities: [
            {
              entityId: remainingResource?.resource?.resourceId,
              entityType: 'resource',
            },
          ],
          domains: ['resource'],
          limit: 10,
        },
        ctx,
      );

      // If knowledge base search returns empty results, fallback to in-memory search
      if (!relevantChunks || relevantChunks.length === 0) {
        relevantChunks = await inMemoryGetRelevantChunks(
          query,
          remainingResource?.resource?.content || '',
          {
            entityId: remainingResource?.resource?.resourceId,
            title: remainingResource?.resource?.title || '',
            entityType: 'resource',
          },
          ctx,
        );
      }

      relevantChunks = truncateChunks(relevantChunks, remainingTokens);
      const relevantContent = assembleChunks(relevantChunks);
      result.push({
        ...remainingResource,
        resource: { ...remainingResource.resource, content: relevantContent },
      });
      usedTokens += countToken(relevantContent);
    }
  }

  return result;
}

export async function processMentionedContextWithSimilarity(
  query: string,
  mentionedContext: IContext,
  maxTokens: number,
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<IContext> {
  const MAX_CONTENT_RAG_RELEVANT_RATIO = 0.4;
  const MAX_RESOURCE_RAG_RELEVANT_RATIO = 0.3;
  const MAX_DOCUMENT_RAG_RELEVANT_RATIO = 0.3;

  const MAX_CONTENT_RAG_RELEVANT_MAX_TOKENS = Math.floor(
    maxTokens * MAX_CONTENT_RAG_RELEVANT_RATIO,
  );
  const MAX_RESOURCE_RAG_RELEVANT_MAX_TOKENS = Math.floor(
    maxTokens * MAX_RESOURCE_RAG_RELEVANT_RATIO,
  );
  const MAX_DOCUMENT_RAG_RELEVANT_MAX_TOKENS = Math.floor(
    maxTokens * MAX_DOCUMENT_RAG_RELEVANT_RATIO,
  );

  // 处理 contentList
  const processedContentList = await processSelectedContentWithSimilarity(
    query,
    mentionedContext.contentList,
    MAX_CONTENT_RAG_RELEVANT_MAX_TOKENS,
    ctx,
  );

  // 处理 resources
  const processedResources = await processResourcesWithSimilarity(
    query,
    mentionedContext.resources,
    MAX_RESOURCE_RAG_RELEVANT_MAX_TOKENS,
    ctx,
  );

  // 处理 documents
  const processedDocuments = await processDocumentsWithSimilarity(
    query,
    mentionedContext.documents,
    MAX_DOCUMENT_RAG_RELEVANT_MAX_TOKENS,
    ctx,
  );

  // 返回处理后的上下文
  return {
    ...mentionedContext,
    contentList: processedContentList,
    resources: processedResources,
    documents: processedDocuments,
  };
}

export async function knowledgeBaseSearchGetRelevantChunks(
  query: string,
  metadata: { entities: Entity[]; domains: SearchDomain[]; limit: number },
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<DocumentInterface[]> {
  try {
    // 1. search relevant chunks
    const res = await ctx.ctxThis.engine.service.librarySearch(
      ctx.config.configurable.user,
      {
        query,
        entities: metadata.entities,
        mode: 'vector',
        limit: metadata.limit,
        domains: metadata.domains,
      },
      { enableReranker: false },
    );
    const relevantChunks = res?.data?.map((item) => ({
      id: item.id,
      pageContent: item?.snippets?.map((s) => s.text).join('\n\n') || '',
      metadata: {
        ...item.metadata,
        title: item.title,
        domain: item.domain,
      },
    }));

    return relevantChunks || [];
  } catch (error) {
    // If search fails, log error and return empty array as fallback
    ctx.ctxThis.engine.logger.error(`Error in knowledgeBaseSearchGetRelevantChunks: ${error}`);
    return [];
  }
}

// TODO: 召回有问题，需要优化
export async function inMemoryGetRelevantChunks(
  query: string,
  content: string,
  metadata: { entityId: string; title: string; entityType: ContentNodeType },
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<DocumentInterface[]> {
  try {
    // 1. 获取 relevantChunks
    const doc: Document<NodeMeta> = {
      pageContent: content,
      metadata: {
        nodeType: metadata.entityType,
        entityType: metadata.entityType,
        title: metadata.title,
        entityId: metadata.entityId,
        tenantId: ctx.config.configurable.user.uid,
      },
    };
    const res = await ctx.ctxThis.engine.service.inMemorySearchWithIndexing(
      ctx.config.configurable.user,
      {
        content: doc,
        query,
        k: 10,
        filter: undefined,
        needChunk: true,
        additionalMetadata: {},
      },
    );
    const relevantChunks = res.data as DocumentInterface[];

    return relevantChunks;
  } catch (error) {
    // If vector processing fails, return truncated content as fallback
    ctx.ctxThis.engine.logger.error(`Error in inMemoryGetRelevantChunks: ${error}`);

    // Provide truncated content as fallback
    const truncatedContent = truncateTextWithToken(content, MAX_NEED_RECALL_TOKEN);
    return [
      {
        pageContent: truncatedContent,
        metadata: {
          nodeType: metadata.entityType,
          entityType: metadata.entityType,
          title: metadata.title,
          entityId: metadata.entityId,
        },
      } as DocumentInterface,
    ];
  }
}

export function truncateChunks(
  chunks: DocumentInterface[],
  maxTokens: number,
): DocumentInterface[] {
  const result: DocumentInterface[] = [];
  let usedTokens = 0;

  for (const chunk of chunks) {
    const chunkTokens = countToken(chunk.pageContent);
    if (usedTokens + chunkTokens <= maxTokens) {
      result.push(chunk as DocumentInterface);
      usedTokens += chunkTokens;
    } else {
      break;
    }
  }

  return result;
}

export async function processUrlSourcesWithSimilarity(
  query: string,
  urlSources: Source[],
  maxTokens: number,
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<Source[]> {
  // set the appropriate maximum token ratio, similar to the processing of contentList
  const MAX_RAG_RELEVANT_URLS_RATIO = 0.7; // 70% of tokens used for high-related URL content
  const MAX_RAG_RELEVANT_URLS_MAX_TOKENS = Math.floor(maxTokens * MAX_RAG_RELEVANT_URLS_RATIO);

  if (urlSources.length === 0) {
    return [];
  }

  const result: Source[] = [];
  let usedTokens = 0;
  const sortedSources = urlSources;

  // 2. process URL sources in order of relevance
  for (const source of sortedSources) {
    const sourceTokens = countToken(source.pageContent || '');

    if (sourceTokens > MAX_NEED_RECALL_TOKEN) {
      // 2.1 large content, use inMemoryGetRelevantChunks for recall
      const relevantChunks = await inMemoryGetRelevantChunks(
        query,
        source?.pageContent?.slice(0, MAX_URL_SOURCES_TOKENS) || '',
        {
          entityId: source.url || '',
          title: source.title || '',
          entityType: 'urlSource' as ContentNodeType,
        },
        ctx,
      );
      const relevantContent = assembleChunks(relevantChunks);
      result.push({
        ...source,
        pageContent: relevantContent,
      });
      usedTokens += countToken(relevantContent);
    } else if (usedTokens + sourceTokens <= MAX_RAG_RELEVANT_URLS_MAX_TOKENS) {
      // 2.2 small content, add directly
      result.push(source);
      usedTokens += sourceTokens;
    } else {
      // 2.3 reach MAX_RAG_RELEVANT_URLS_MAX_TOKENS, process the remaining content
      break;
    }

    if (usedTokens >= MAX_RAG_RELEVANT_URLS_MAX_TOKENS) break;
  }

  // 3. process the remaining URL sources
  for (let i = result.length; i < sortedSources.length; i++) {
    const remainingSource = sortedSources[i];
    const sourceTokens = countToken(remainingSource.pageContent || '');

    // all short content added directly
    if (sourceTokens < SHORT_CONTENT_THRESHOLD) {
      result.push(remainingSource);
      usedTokens += sourceTokens;
    } else {
      // remaining long content use inMemoryGetRelevantChunks for recall
      const remainingTokens = maxTokens - usedTokens;
      let relevantChunks = await inMemoryGetRelevantChunks(
        query,
        remainingSource?.pageContent?.slice(0, MAX_URL_SOURCES_TOKENS) || '',
        {
          entityId: remainingSource.url || '',
          title: remainingSource.title || '',
          entityType: 'urlSource' as ContentNodeType,
        },
        ctx,
      );
      relevantChunks = truncateChunks(relevantChunks, remainingTokens);
      const relevantContent = assembleChunks(relevantChunks);
      result.push({
        ...remainingSource,
        pageContent: relevantContent,
      });
      usedTokens += countToken(relevantContent);
    }

    if (usedTokens >= maxTokens) break;
  }

  ctx.ctxThis.engine.logger.info(`Processed URL sources: ${result.length} of ${urlSources.length}`);
  return result;
}
