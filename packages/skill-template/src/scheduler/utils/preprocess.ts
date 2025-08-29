import { Source } from '@refly/openapi-schema';
import { BaseSkill, SkillRunnableConfig } from '../../base';
import { processQuery } from './queryProcessor';
import { extractAndCrawlUrls } from './extract-weblink';
import { processContextUrls } from '../../utils/url-processing';
import { prepareContext } from './context';

export interface PreprocessResult {
  optimizedQuery: string;
  rewrittenQueries: string[];
  context: string;
  sources?: Source[];
  usedChatHistory?: any[];
}

export const preprocess = async (
  query: string,
  config: SkillRunnableConfig,
  ctxThis: BaseSkill,
): Promise<PreprocessResult> => {
  const { project, runtimeConfig, urls = [], tplConfig } = config.configurable;

  // Only enable knowledge base search if both projectId AND runtimeConfig.enabledKnowledgeBase are true
  const projectId = project?.projectId;
  const enableKnowledgeBaseSearch = !!projectId && !!runtimeConfig?.enabledKnowledgeBase;

  // Use shared query processor
  const {
    optimizedQuery,
    usedChatHistory,
    hasContext,
    remainingTokens,
    mentionedContext,
    rewrittenQueries,
  } = await processQuery(query, { config, ctxThis });

  // Extract URLs from the query and crawl them with optimized concurrent processing
  const { sources: queryUrlSources } = await extractAndCrawlUrls(query, config, ctxThis, {
    concurrencyLimit: 5,
    batchSize: 8,
  });

  // Process URLs from frontend context if available
  const contextUrlSources = await processContextUrls(urls, config, ctxThis);

  // Combine URL sources from context and query extraction
  const urlSources = [...contextUrlSources, ...(queryUrlSources || [])];

  // Consider URL sources for context preparation
  const hasUrlSources = urlSources.length > 0;
  const needPrepareContext =
    (hasContext || hasUrlSources || enableKnowledgeBaseSearch) && remainingTokens > 0;

  const result = {
    optimizedQuery,
    rewrittenQueries,
    context: '',
    sources: [],
    usedChatHistory,
  };

  if (needPrepareContext) {
    const preparedRes = await prepareContext(
      {
        query: optimizedQuery,
        mentionedContext,
        maxTokens: remainingTokens,
        enableMentionedContext: hasContext,
        rewrittenQueries,
        urlSources, // Pass combined URL sources to prepareContext
      },
      {
        config,
        ctxThis,
        tplConfig,
      },
    );

    result.context = preparedRes.contextStr;
    result.sources = preparedRes.sources;

    return result;
  }

  return result;
};
