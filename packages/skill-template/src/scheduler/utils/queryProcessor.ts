import { GraphState } from '../types';
import { BaseSkill, SkillRunnableConfig } from '../../base';
import { checkHasContext, countToken, countMessagesTokens } from './token';
import { isEmptyMessage, truncateMessages } from './truncator';
import { analyzeQueryAndContext, preprocessQuery } from './query-rewrite/index';
import { safeStringifyJSON } from '@refly/utils';
import { QueryProcessorResult } from '../types';

interface QueryProcessorOptions {
  config: SkillRunnableConfig;
  ctxThis: BaseSkill;
  state: GraphState;
  // Whether to skip query analysis, defaults to false for backward compatibility
  shouldSkipAnalysis?: boolean;
}

export async function processQuery(options: QueryProcessorOptions): Promise<QueryProcessorResult> {
  const { config, ctxThis, state, shouldSkipAnalysis = false } = options;
  const { query: originalQuery } = state;
  const {
    modelInfo,
    chatHistory: rawChatHistory = [],
    resources,
    documents,
    contentList,
  } = config.configurable;
  const { tplConfig } = config?.configurable || {};

  let optimizedQuery = '';
  let rewrittenQueries: string[] = [];

  // Preprocess query
  const query = preprocessQuery(originalQuery, {
    config,
    ctxThis,
    state,
    tplConfig,
  });
  optimizedQuery = query;
  ctxThis.engine.logger.log(`preprocess query: ${query}`);

  // Process chat history
  const chatHistory = rawChatHistory.filter((message) => !isEmptyMessage(message));
  const usedChatHistory = truncateMessages(chatHistory, 20, 4000, 30000);

  // Check context
  const hasContext = checkHasContext({
    contentList,
    resources,
    documents,
  });
  ctxThis.engine.logger.log(`checkHasContext: ${hasContext}`);

  // Calculate tokens
  const maxTokens = modelInfo.contextLimit;
  const queryTokens = countToken(query);
  const chatHistoryTokens = countMessagesTokens(usedChatHistory);
  const remainingTokens = maxTokens - queryTokens - chatHistoryTokens;

  ctxThis.engine.logger.log(
    `maxTokens: ${maxTokens}, queryTokens: ${queryTokens}, chatHistoryTokens: ${chatHistoryTokens}, remainingTokens: ${remainingTokens}`,
  );

  // Only skip analysis if explicitly set to true and there's no context and chat history
  const canSkipAnalysis =
    shouldSkipAnalysis && !hasContext && (!usedChatHistory || usedChatHistory.length === 0);

  let mentionedContext = {};
  if (!canSkipAnalysis) {
    const analyzedRes = await analyzeQueryAndContext(query, {
      config,
      ctxThis,
      state,
      tplConfig,
    });
    optimizedQuery = analyzedRes.analysis.summary;
    mentionedContext = analyzedRes.mentionedContext;
    rewrittenQueries = analyzedRes.rewrittenQueries;

    ctxThis.engine.logger.log(`optimizedQuery: ${optimizedQuery}`);
    ctxThis.engine.logger.log(`mentionedContext: ${safeStringifyJSON(mentionedContext)}`);
    ctxThis.engine.logger.log(`rewrittenQueries: ${safeStringifyJSON(rewrittenQueries)}`);
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
