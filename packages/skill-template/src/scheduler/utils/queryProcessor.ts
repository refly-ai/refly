import { BaseSkill, SkillRunnableConfig } from '../../base';
import { checkHasContext, countToken, countMessagesTokens } from './token';
import { isEmptyMessage, truncateMessages } from './truncator';
import { analyzeQueryAndContext, preprocessQuery } from './query-rewrite/index';
import { QueryProcessorResult } from '../types';
import { DEFAULT_MODEL_CONTEXT_LIMIT } from './constants';

interface QueryProcessorOptions {
  config: SkillRunnableConfig;
  ctxThis: BaseSkill;
  shouldSkipAnalysis?: boolean;
}

export async function processQuery(
  originalQuery: string,
  options: QueryProcessorOptions,
): Promise<QueryProcessorResult> {
  const { config, ctxThis, shouldSkipAnalysis = false } = options;
  const {
    modelConfigMap,
    chatHistory: rawChatHistory = [],
    resources,
    documents,
    contentList,
  } = config.configurable;
  const modelInfo = modelConfigMap.queryAnalysis;

  let optimizedQuery = '';
  let rewrittenQueries: string[] = [];

  // Preprocess query
  const query = preprocessQuery(originalQuery, config);
  optimizedQuery = query;

  // Process chat history
  const chatHistory = rawChatHistory.filter((message) => !isEmptyMessage(message));
  const usedChatHistory = truncateMessages(chatHistory, 20, 4000, 30000);

  // Check context
  const hasContext = checkHasContext({
    contentList,
    resources,
    documents,
  });

  // Calculate tokens
  const maxTokens = modelInfo.contextLimit || DEFAULT_MODEL_CONTEXT_LIMIT;
  const queryTokens = countToken(query);
  const chatHistoryTokens = countMessagesTokens(usedChatHistory);
  const remainingTokens = maxTokens - queryTokens - chatHistoryTokens;

  // Only skip analysis if explicitly set to true and there's no context and chat history
  const canSkipAnalysis =
    shouldSkipAnalysis && !hasContext && (!usedChatHistory || usedChatHistory.length === 0);

  let mentionedContext = {};
  if (!canSkipAnalysis) {
    const analyzedRes = await analyzeQueryAndContext(query, {
      config,
      ctxThis,
    });
    optimizedQuery = analyzedRes.analysis.summary;
    mentionedContext = analyzedRes.mentionedContext;
    rewrittenQueries = analyzedRes.rewrittenQueries;
  }

  return {
    optimizedQuery,
    query,
    usedChatHistory,
    hasContext,
    remainingTokens,
    mentionedContext,
    rewrittenQueries,
  };
}
