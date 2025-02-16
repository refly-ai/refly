import { GraphState } from '../types';
import { BaseSkill, SkillRunnableConfig } from '../../base';
import { checkHasContext, countToken, countMessagesTokens } from './token';
import { isEmptyMessage, truncateMessages } from './truncator';
import { analyzeQueryAndContext, preprocessQuery } from './query-rewrite/index';
import { safeStringifyJSON } from '@refly-packages/utils';
import { checkIsSupportedModel } from './model';

interface QueryProcessorOptions {
  config: SkillRunnableConfig;
  ctxThis: BaseSkill;
  state: GraphState;
}

interface QueryProcessorResult {
  optimizedQuery: string;
  query: string;
  usedChatHistory: any[];
  hasContext: boolean;
  remainingTokens: number;
  mentionedContext: any;
}

export async function processQuery(options: QueryProcessorOptions): Promise<QueryProcessorResult> {
  const { config, ctxThis, state } = options;
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
  let mentionedContext: any;

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

  // Only do advanced query processing for supported models
  if (checkIsSupportedModel(modelInfo)) {
    // Define query rewrite conditions
    const LONG_QUERY_TOKENS_THRESHOLD = 500;
    const needRewriteQuery =
      queryTokens < LONG_QUERY_TOKENS_THRESHOLD && (hasContext || chatHistoryTokens > 0);
    ctxThis.engine.logger.log(`needRewriteQuery: ${needRewriteQuery}`);

    if (needRewriteQuery) {
      const analyzedRes = await analyzeQueryAndContext(query, {
        config,
        ctxThis,
        state,
        tplConfig,
      });
      optimizedQuery = analyzedRes.optimizedQuery;
      mentionedContext = analyzedRes.mentionedContext;
    }
  }

  ctxThis.engine.logger.log(`optimizedQuery: ${optimizedQuery}`);
  ctxThis.engine.logger.log(`mentionedContext: ${safeStringifyJSON(mentionedContext)}`);

  return {
    optimizedQuery,
    query,
    usedChatHistory,
    hasContext,
    remainingTokens,
    mentionedContext,
  };
}
