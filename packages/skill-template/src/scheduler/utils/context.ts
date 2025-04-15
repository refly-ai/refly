import { GraphState, IContext } from '../types';
import { countContextTokens, countSourcesTokens, checkHasContext } from './token';
import {
  processSelectedContentWithSimilarity,
  processDocumentsWithSimilarity,
  processResourcesWithSimilarity,
  processMentionedContextWithSimilarity,
} from './semanticSearch';
import { BaseSkill, SkillRunnableConfig } from '../../base';
import { truncateContext } from './truncator';
import { flattenMergedContextToSources, concatMergedContextToStr } from './summarizer';
import { SkillTemplateConfig, Source } from '@refly-packages/openapi-schema';
import { uniqBy } from 'lodash';
import { MAX_CONTEXT_RATIO, MAX_URL_SOURCES_RATIO } from './constants';
import { safeStringifyJSON } from '@refly-packages/utils';
import { callMultiLingualWebSearch } from '../module/multiLingualSearch';
import { callMultiLingualLibrarySearch } from '../module/multiLingualLibrarySearch';
import { checkIsSupportedModel, checkModelContextLenSupport } from './model';
import { SkillContextContentItemMetadata } from '../types';
import { processUrlSourcesWithSimilarity } from './semanticSearch';

export async function prepareContext(
  {
    query,
    mentionedContext,
    maxTokens,
    enableMentionedContext,
    rewrittenQueries,
    urlSources = [],
  }: {
    query: string;
    mentionedContext: IContext;
    maxTokens: number;
    enableMentionedContext: boolean;
    rewrittenQueries?: string[];
    urlSources?: Source[];
  },
  ctx: {
    config: SkillRunnableConfig;
    ctxThis: BaseSkill;
    state: GraphState;
    tplConfig: SkillTemplateConfig;
  },
): Promise<{ contextStr: string; sources: Source[] }> {
  try {
    const enableWebSearch = ctx.tplConfig?.enableWebSearch?.value;
    const enableKnowledgeBaseSearch = ctx.tplConfig?.enableKnowledgeBaseSearch?.value;
    ctx.ctxThis.engine.logger.log(`Enable Web Search: ${enableWebSearch}`);
    ctx.ctxThis.engine.logger.log(`Enable Knowledge Base Search: ${enableKnowledgeBaseSearch}`);
    ctx.ctxThis.engine.logger.log(`URL Sources Count: ${urlSources?.length || 0}`);

    const maxContextTokens = Math.floor(maxTokens * MAX_CONTEXT_RATIO);

    // Process URL sources with similarity search
    const MAX_URL_SOURCES_TOKENS = Math.floor(maxContextTokens * MAX_URL_SOURCES_RATIO);

    let processedUrlSources: Source[] = [];
    if (urlSources?.length > 0) {
      processedUrlSources = await processUrlSourcesWithSimilarity(
        query,
        urlSources,
        MAX_URL_SOURCES_TOKENS,
        ctx,
      );
    }

    // Calculate tokens used by processed URL sources
    const urlSourcesTokens = countSourcesTokens(processedUrlSources);
    let remainingTokens = maxContextTokens - urlSourcesTokens;
    ctx.ctxThis.engine.logger.log(`URL Sources Tokens: ${urlSourcesTokens}`);

    const { modelInfo } = ctx.config.configurable;
    const isSupportedModel = checkIsSupportedModel(modelInfo);

    // 1. web search context
    let processedWebSearchContext: IContext = {
      contentList: [],
      resources: [],
      documents: [],
      webSearchSources: [],
    };
    if (enableWebSearch) {
      const preparedRes = await prepareWebSearchContext(
        {
          query,
          rewrittenQueries,
          enableQueryRewrite: isSupportedModel,
        },
        ctx,
      );
      processedWebSearchContext = preparedRes.processedWebSearchContext;
    }
    const webSearchContextTokens = countSourcesTokens(processedWebSearchContext.webSearchSources);
    remainingTokens -= webSearchContextTokens;
    ctx.ctxThis.engine.logger.log(`Web Search Context Tokens: ${webSearchContextTokens}`);
    ctx.ctxThis.engine.logger.log(`Remaining Tokens after web search: ${remainingTokens}`);

    // 2. library search context
    let processedLibrarySearchContext: IContext = {
      contentList: [],
      resources: [],
      documents: [],
      librarySearchSources: [],
    };
    if (enableKnowledgeBaseSearch) {
      const librarySearchRes = await performLibrarySearchContext(
        {
          query,
          rewrittenQueries,
          enableQueryRewrite: true,
          enableSearchWholeSpace: true,
        },
        ctx,
      );
      processedLibrarySearchContext = librarySearchRes.processedLibrarySearchContext;
      // Adjust remaining tokens based on library search results
      const librarySearchContextTokens = countSourcesTokens(
        processedLibrarySearchContext.librarySearchSources,
      );
      remainingTokens -= librarySearchContextTokens;
      ctx.ctxThis.engine.logger.log(`Library Search Context Tokens: ${librarySearchContextTokens}`);
      ctx.ctxThis.engine.logger.log(`Remaining Tokens after library search: ${remainingTokens}`);
    }

    // 3. mentioned context
    let processedMentionedContext: IContext = {
      contentList: [],
      resources: [],
      documents: [],
    };
    if (enableMentionedContext && isSupportedModel) {
      const mentionContextRes = await prepareMentionedContext(
        {
          query,
          mentionedContext,
          maxMentionedContextTokens: remainingTokens,
        },
        ctx,
      );

      processedMentionedContext = mentionContextRes.processedMentionedContext;
      remainingTokens -= mentionContextRes.mentionedContextTokens || 0;
      ctx.ctxThis.engine.logger.log(
        `Mentioned Context Tokens: ${mentionContextRes.mentionedContextTokens || 0}`,
      );
      ctx.ctxThis.engine.logger.log(`Remaining Tokens after mentioned context: ${remainingTokens}`);
    }

    // 4. relevant context from user-provided content (if there are tokens remaining)
    let relevantContext: IContext = {
      contentList: [],
      resources: [],
      documents: [],
    };
    if (
      remainingTokens > 0 &&
      (ctx.config.configurable.contentList?.length > 0 ||
        ctx.config.configurable.resources?.length > 0 ||
        ctx.config.configurable.documents?.length > 0)
    ) {
      const { contentList = [], resources = [], documents = [] } = ctx.config.configurable;

      // Remove overlapping items with mentioned context
      const filteredContext = removeOverlappingContextItems(processedMentionedContext, {
        contentList,
        resources,
        documents,
      });

      // Get relevant context directly
      relevantContext = await prepareRelevantContext(
        {
          query,
          context: filteredContext,
        },
        ctx,
      );

      // Calculate tokens before truncation
      const relevantContextTokensBeforeTruncation = countContextTokens(relevantContext);
      ctx.ctxThis.engine.logger.log(
        `Relevant Context Tokens Before Truncation: ${relevantContextTokensBeforeTruncation}`,
      );

      // Truncate to fit within token limits
      if (relevantContextTokensBeforeTruncation > remainingTokens) {
        relevantContext = truncateContext(relevantContext, remainingTokens);
        const relevantContextTokensAfterTruncation = countContextTokens(relevantContext);
        ctx.ctxThis.engine.logger.log(
          `Relevant Context Tokens After Truncation: ${relevantContextTokensAfterTruncation}`,
        );
        remainingTokens -= relevantContextTokensAfterTruncation;
      } else {
        remainingTokens -= relevantContextTokensBeforeTruncation;
      }

      ctx.ctxThis.engine.logger.log(`Remaining Tokens after relevant context: ${remainingTokens}`);
    }

    ctx.ctxThis.engine.logger.log(
      `Prepared Relevant Context: ${safeStringifyJSON(relevantContext)}`,
    );

    // Merge all contexts with proper deduplication
    const deduplicatedRelevantContext = deduplicateContexts(relevantContext);
    const mergedContext = {
      urlSources: processedUrlSources,
      mentionedContext: processedMentionedContext,
      relevantContext: deduplicatedRelevantContext,
      webSearchSources: processedWebSearchContext.webSearchSources,
      librarySearchSources: removeOverlappingLibrarySearchSources(
        processedLibrarySearchContext.librarySearchSources,
        processedMentionedContext,
        deduplicatedRelevantContext,
        ctx.ctxThis.engine.logger,
      ),
    };

    ctx.ctxThis.engine.logger.log(`Merged Context: ${safeStringifyJSON(mergedContext)}`);

    const hasMentionedContext = checkHasContext(processedMentionedContext);
    const hasRelevantContext = checkHasContext(relevantContext);

    // Limit search sources count when we have other context
    const LIMIT_SEARCH_SOURCES_COUNT = 10;
    if (hasMentionedContext || hasRelevantContext) {
      mergedContext.webSearchSources = mergedContext.webSearchSources.slice(
        0,
        LIMIT_SEARCH_SOURCES_COUNT,
      );
      mergedContext.librarySearchSources = mergedContext.librarySearchSources.slice(
        0,
        LIMIT_SEARCH_SOURCES_COUNT,
      );
    }

    // Generate final context string and sources
    const contextStr = concatMergedContextToStr(mergedContext);
    const sources = flattenMergedContextToSources(mergedContext);

    return { contextStr, sources };
  } catch (error) {
    // If any unexpected error occurs at the top level, log and return empty results
    ctx.ctxThis.engine.logger.error(`Unexpected error in prepareContext: ${error}`);
    return { contextStr: '', sources: [] };
  }
}

export async function prepareWebSearchContext(
  {
    query,
    rewrittenQueries,
    enableQueryRewrite = true,
    enableTranslateQuery = false,
    enableTranslateResult = false,
  }: {
    query: string;
    rewrittenQueries?: string[];
    enableQueryRewrite?: boolean;
    enableTranslateQuery?: boolean;
    enableTranslateResult?: boolean;
  },
  ctx: {
    config: SkillRunnableConfig;
    ctxThis: BaseSkill;
    state: GraphState;
    tplConfig: SkillTemplateConfig;
  },
): Promise<{
  processedWebSearchContext: IContext;
}> {
  ctx.ctxThis.engine.logger.log('Prepare Web Search Context...');

  // two searchMode
  const enableDeepReasonWebSearch =
    (ctx.tplConfig?.enableDeepReasonWebSearch?.value as boolean) || false;
  const { locale = 'en' } = ctx?.config?.configurable || {};

  let searchLimit = 10;
  const enableRerank = true;
  const searchLocaleList: string[] = ['en'];
  let rerankRelevanceThreshold = 0.2;

  if (enableDeepReasonWebSearch) {
    searchLimit = 20;
    enableTranslateQuery = true;
    rerankRelevanceThreshold = 0.4;
  }

  const processedWebSearchContext: IContext = {
    contentList: [],
    resources: [],
    documents: [],
    webSearchSources: [],
  };

  // Call multiLingualWebSearch instead of webSearch
  const searchResult = await callMultiLingualWebSearch(
    {
      rewrittenQueries,
      searchLimit,
      searchLocaleList,
      resultDisplayLocale: locale || 'auto',
      enableRerank,
      enableTranslateQuery,
      enableTranslateResult,
      rerankRelevanceThreshold,
      translateConcurrencyLimit: 10,
      webSearchConcurrencyLimit: 3,
      batchSize: 5,
      enableDeepReasonWebSearch,
      enableQueryRewrite,
    },
    {
      config: ctx.config,
      ctxThis: ctx.ctxThis,
      state: { ...ctx.state, query },
    },
  );

  // Take only first 10 sources
  const isModelContextLenSupport = checkModelContextLenSupport(
    ctx?.config?.configurable?.modelInfo,
  );
  let webSearchSources = searchResult.sources || [];
  if (!isModelContextLenSupport) {
    webSearchSources = webSearchSources.slice(0, 10);
  }

  processedWebSearchContext.webSearchSources = webSearchSources;

  ctx.ctxThis.engine.logger.log(
    `Prepared Web Search Context successfully! ${safeStringifyJSON(processedWebSearchContext)}`,
  );

  return {
    processedWebSearchContext,
  };
}

export async function prepareMentionedContext(
  {
    query,
    mentionedContext,
    maxMentionedContextTokens,
  }: {
    query: string;
    mentionedContext: IContext;
    maxMentionedContextTokens: number;
  },
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill; state: GraphState },
): Promise<{
  mentionedContextTokens: number;
  processedMentionedContext: IContext;
}> {
  ctx.ctxThis.engine.logger.log('Prepare Mentioned Context...');

  let processedMentionedContext: IContext = {
    contentList: [],
    resources: [],
    documents: [],
    ...mentionedContext,
  };

  const allMentionedContextTokens = countContextTokens(mentionedContext);
  ctx.ctxThis.engine.logger.log(`All Mentioned Context Tokens: ${allMentionedContextTokens}`);

  if (allMentionedContextTokens === 0) {
    return {
      mentionedContextTokens: 0,
      processedMentionedContext: mentionedContext,
    };
  }
  // if mentioned context is not empty, we need to mutate the metadata of the mentioned context
  const { contentList = [], resources = [], documents = [] } = ctx.config.configurable;
  const context: IContext = {
    contentList,
    resources,
    documents,
  };

  ctx.ctxThis.engine.logger.log('Mutate Context Metadata...');
  mutateContextMetadata(mentionedContext, context);

  let mentionedContextTokens = allMentionedContextTokens;

  if (allMentionedContextTokens > maxMentionedContextTokens) {
    ctx.ctxThis.engine.logger.log('Process Mentioned Context With Similarity...');
    processedMentionedContext = await processMentionedContextWithSimilarity(
      query,
      mentionedContext,
      maxMentionedContextTokens,
      ctx,
    );
    mentionedContextTokens = countContextTokens(processedMentionedContext);

    if (mentionedContextTokens > maxMentionedContextTokens) {
      processedMentionedContext = truncateContext(
        processedMentionedContext,
        maxMentionedContextTokens,
      );
      mentionedContextTokens = countContextTokens(processedMentionedContext);
    }
  }

  ctx.ctxThis.engine.logger.log(
    `Prepared Mentioned Context successfully! ${safeStringifyJSON(processedMentionedContext)}`,
  );

  return {
    mentionedContextTokens,
    processedMentionedContext,
  };
}

export async function prepareRelevantContext(
  {
    query,
    context,
  }: {
    query: string;
    context: IContext;
  },
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill; state: GraphState },
): Promise<IContext> {
  const { contentList = [], resources = [], documents = [] } = context;
  const relevantContexts: IContext = {
    contentList: [],
    resources: [],
    documents: [],
  };

  ctx.ctxThis.engine.logger.log(`Prepare Relevant Context..., ${safeStringifyJSON(context)}`);

  // 1. selected content context
  relevantContexts.contentList =
    contentList.length > 0
      ? await processSelectedContentWithSimilarity(
          query,
          contentList,
          Number.POSITIVE_INFINITY,
          ctx,
        )
      : [];

  // 2. documents context
  relevantContexts.documents =
    documents.length > 0
      ? await processDocumentsWithSimilarity(query, documents, Number.POSITIVE_INFINITY, ctx)
      : [];

  // 3. resources context
  relevantContexts.resources =
    resources.length > 0
      ? await processResourcesWithSimilarity(query, resources, Number.POSITIVE_INFINITY, ctx)
      : [];

  ctx.ctxThis.engine.logger.log(
    `Prepared Relevant Context successfully! ${safeStringifyJSON(relevantContexts)}`,
  );

  return relevantContexts;
}

export function deduplicateContexts(context: IContext): IContext {
  return {
    contentList: uniqBy(context.contentList || [], 'content'),
    resources: uniqBy(context.resources || [], (item) => item.resource?.content),
    documents: uniqBy(context.documents || [], (item) => item.document?.content),
    webSearchSources: uniqBy(context.webSearchSources || [], (item) => item?.pageContent),
    librarySearchSources: uniqBy(context.librarySearchSources || [], (item) => item?.pageContent),
  };
}

export function removeOverlappingContextItems(
  context: IContext,
  originalContext: IContext,
): IContext {
  const deduplicatedContext: IContext = {
    contentList: [],
    resources: [],
    documents: [],
  };

  // Helper function to check if an item exists in the context
  const itemExistsInContext = (item: any, contextArray: any[], idField: string) => {
    return contextArray.some((contextItem) => contextItem[idField] === item[idField]);
  };

  // Deduplicate contentList
  deduplicatedContext.contentList = (originalContext?.contentList || []).filter(
    (item) => !itemExistsInContext(item, context?.contentList || [], 'metadata.entityId'),
  );

  // Deduplicate resources
  deduplicatedContext.resources = (originalContext?.resources || []).filter(
    (item) =>
      !itemExistsInContext(
        item.resource,
        (context?.resources || []).map((r) => r.resource),
        'resourceId',
      ),
  );

  // Deduplicate documents
  deduplicatedContext.documents = (originalContext?.documents || []).filter(
    (item) =>
      !itemExistsInContext(
        item.document,
        (context?.documents || []).map((n) => n.document),
        'docId',
      ),
  );

  return deduplicatedContext;
}

export const mutateContextMetadata = (
  mentionedContext: IContext,
  originalContext: IContext,
): IContext => {
  // Process documents
  for (const mentionedDocument of mentionedContext.documents) {
    const index = originalContext.documents.findIndex(
      (n) => n.document.docId === mentionedDocument.document.docId,
    );
    if (index !== -1) {
      originalContext.documents[index] = {
        ...originalContext.documents[index],
        metadata: {
          ...originalContext.documents[index].metadata,
          useWholeContent: mentionedDocument.metadata?.useWholeContent,
        },
      };
    }
  }

  // Process resources
  for (const mentionedResource of mentionedContext.resources) {
    const index = originalContext.resources.findIndex(
      (r) => r.resource.resourceId === mentionedResource.resource.resourceId,
    );
    if (index !== -1) {
      originalContext.resources[index] = {
        ...originalContext.resources[index],
        metadata: {
          ...originalContext.resources[index].metadata,
          useWholeContent: mentionedResource.metadata?.useWholeContent,
        },
      };
    }
  }

  // Process contentList
  for (const mentionedContent of mentionedContext.contentList) {
    const index = originalContext.contentList.findIndex(
      (c) => c.metadata.entityId === mentionedContent.metadata.entityId,
    );
    if (index !== -1) {
      originalContext.contentList[index] = {
        ...originalContext.contentList[index],
        metadata: {
          ...originalContext.contentList[index].metadata,
          useWholeContent: mentionedContent.metadata?.useWholeContent,
        },
      };
    }
  }

  return originalContext;
};

export async function performLibrarySearchContext(
  {
    query,
    rewrittenQueries,
    enableQueryRewrite = true,
    enableTranslateQuery = false,
    enableTranslateResult = false,
    enableSearchWholeSpace = false,
  }: {
    query: string;
    rewrittenQueries?: string[];
    enableQueryRewrite?: boolean;
    enableTranslateQuery?: boolean;
    enableTranslateResult?: boolean;
    enableSearchWholeSpace?: boolean;
  },
  ctx: {
    config: SkillRunnableConfig;
    ctxThis: BaseSkill;
    state: GraphState;
    tplConfig: SkillTemplateConfig;
  },
): Promise<{
  processedLibrarySearchContext: IContext;
}> {
  ctx.ctxThis.engine.logger.log('Prepare Library Search Context...');

  // Configure search parameters
  const enableDeepSearch = (ctx.tplConfig?.enableDeepSearch?.value as boolean) || false;
  const { locale = 'en' } = ctx?.config?.configurable || {};

  let searchLimit = 10;
  const enableRerank = true;
  const searchLocaleList: string[] = ['en'];
  let rerankRelevanceThreshold = 0.2;

  if (enableDeepSearch) {
    searchLimit = 20;
    enableTranslateQuery = true;
    rerankRelevanceThreshold = 0.4;
  }

  const processedLibrarySearchContext: IContext = {
    contentList: [],
    resources: [],
    documents: [],
    librarySearchSources: [],
  };

  // Call multiLingualLibrarySearch
  const searchResult = await callMultiLingualLibrarySearch(
    {
      rewrittenQueries,
      searchLimit,
      searchLocaleList,
      resultDisplayLocale: locale || 'auto',
      enableRerank,
      enableTranslateQuery,
      enableTranslateResult,
      rerankRelevanceThreshold,
      translateConcurrencyLimit: 10,
      libraryConcurrencyLimit: 3,
      batchSize: 5,
      enableDeepSearch,
      enableQueryRewrite,
      enableSearchWholeSpace,
    },
    {
      config: ctx.config,
      ctxThis: ctx.ctxThis,
      state: { ...ctx.state, query },
    },
  );

  // Take only first 10 sources for models with limited context length
  const isModelContextLenSupport = checkModelContextLenSupport(
    ctx?.config?.configurable?.modelInfo,
  );
  let librarySearchSources = searchResult.sources || [];
  if (!isModelContextLenSupport) {
    librarySearchSources = librarySearchSources.slice(0, 10);
  }

  // Store the sources in the context
  processedLibrarySearchContext.librarySearchSources = librarySearchSources;

  // Process sources into documents and resources based on their metadata
  const uniqueResourceIds = new Set<string>();
  const uniqueDocIds = new Set<string>();

  for (const source of librarySearchSources) {
    const metadata = source.metadata || {};
    const entityType = metadata.entityType;
    const entityId = metadata.entityId;

    if (entityType === 'resource' && entityId && !uniqueResourceIds.has(entityId)) {
      uniqueResourceIds.add(entityId);
      processedLibrarySearchContext.resources.push({
        resource: {
          resourceId: entityId,
          content: source.pageContent || '',
          title: source.title || '',
          resourceType: 'text',
          data: {
            url: source.url || '',
          },
        },
      });
    } else if (entityType === 'document' && entityId && !uniqueDocIds.has(entityId)) {
      uniqueDocIds.add(entityId);
      processedLibrarySearchContext.documents.push({
        document: {
          docId: entityId,
          content: source.pageContent || '',
          title: source.title || '',
        },
      });
    }
  }

  ctx.ctxThis.engine.logger.log(
    `Prepared Library Search Context successfully! ${safeStringifyJSON(processedLibrarySearchContext)}`,
  );

  return {
    processedLibrarySearchContext,
  };
}

/**
 * Removes library search sources that overlap with mentioned or relevant context
 * Library search has the lowest priority, so we should deduplicate it against other contexts
 */
export function removeOverlappingLibrarySearchSources(
  librarySearchSources: Source[],
  mentionedContext: IContext | null,
  relevantContext: IContext | null,
  logger?: any,
): Source[] {
  if (!librarySearchSources?.length) {
    return [];
  }

  if (!mentionedContext && !relevantContext) {
    return librarySearchSources;
  }

  // Extract all entity IDs from mentioned and relevant context
  const existingEntityIds = new Set<string>();

  // Helper function to collect entity IDs from context
  const collectEntityIds = (context: IContext | null) => {
    if (!context) return;

    // Collect from resources
    for (const item of context.resources || []) {
      if (item.resource?.resourceId) {
        existingEntityIds.add(`resource-${item.resource.resourceId}`);
      }
    }

    // Collect from documents
    for (const item of context.documents || []) {
      if (item.document?.docId) {
        existingEntityIds.add(`document-${item.document.docId}`);
      }
    }

    // Collect from contentList
    for (const item of context.contentList || []) {
      const metadata = item.metadata as any as SkillContextContentItemMetadata;
      if (metadata?.entityId && metadata?.domain) {
        existingEntityIds.add(`${metadata.domain}-${metadata.entityId}`);
      }
    }
  };

  // Collect entity IDs from both contexts
  collectEntityIds(mentionedContext);
  collectEntityIds(relevantContext);

  // Filter out library search sources that match by entity ID or have identical content
  const uniqueLibrarySearchSources = librarySearchSources.filter((source) => {
    const metadata = source.metadata || {};
    const entityType = metadata.entityType;
    const entityId = metadata.entityId;

    // Check if this source has a matching entity ID in mentioned or relevant context
    if (entityType && entityId) {
      const key = `${entityType}-${entityId}`;
      if (existingEntityIds.has(key)) {
        return false; // Skip this source as it already exists in higher priority context
      }
    }

    // Check for duplicate content in mentioned context
    if (mentionedContext) {
      // Check in resources
      if (
        mentionedContext.resources?.some(
          (resource) => resource.resource?.content === source.pageContent,
        )
      ) {
        return false;
      }

      // Check in documents
      if (
        mentionedContext.documents?.some(
          (document) => document.document?.content === source.pageContent,
        )
      ) {
        return false;
      }

      // Check in contentList
      if (mentionedContext.contentList?.some((content) => content.content === source.pageContent)) {
        return false;
      }
    }

    // Check for duplicate content in relevant context
    if (relevantContext) {
      // Check in resources
      if (
        relevantContext.resources?.some(
          (resource) => resource.resource?.content === source.pageContent,
        )
      ) {
        return false;
      }

      // Check in documents
      if (
        relevantContext.documents?.some(
          (document) => document.document?.content === source.pageContent,
        )
      ) {
        return false;
      }

      // Check in contentList
      if (relevantContext.contentList?.some((content) => content.content === source.pageContent)) {
        return false;
      }
    }

    return true;
  });

  // Log how many items were removed
  const removedCount = librarySearchSources.length - uniqueLibrarySearchSources.length;
  if (removedCount > 0 && logger) {
    logger.log(
      `Removed ${removedCount} duplicate library search sources that already exist in mentioned or relevant context`,
    );
  }

  return uniqueLibrarySearchSources;
}
