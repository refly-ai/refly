import { SkillRunnableConfig } from '../../base';
import { checkHasContext, countToken, countMessagesTokens } from './token';
import { isEmptyMessage, truncateMessages } from './truncator';
import { QueryProcessorResult } from '../types';
import { DEFAULT_MODEL_CONTEXT_LIMIT } from './constants';

export async function processQuery(
  query: string,
  config: SkillRunnableConfig,
): Promise<QueryProcessorResult> {
  const { modelConfigMap, chatHistory: rawChatHistory = [], context } = config.configurable;
  const modelInfo = modelConfigMap.queryAnalysis;

  // Process chat history
  const chatHistory = rawChatHistory.filter((message) => !isEmptyMessage(message));
  const usedChatHistory = truncateMessages(chatHistory, 20, 4000, 30000);

  // Check context
  const hasContext = checkHasContext(context);

  // Calculate tokens
  const maxTokens = modelInfo.contextLimit || DEFAULT_MODEL_CONTEXT_LIMIT;
  const queryTokens = countToken(query);
  const chatHistoryTokens = countMessagesTokens(usedChatHistory);
  const remainingTokens = maxTokens - queryTokens - chatHistoryTokens;

  const mentionedContext = {};

  return {
    optimizedQuery: query,
    query,
    usedChatHistory,
    hasContext,
    remainingTokens,
    mentionedContext,
  };
}
