import { Source } from '@refly/openapi-schema';
import { SkillRunnableConfig } from '../../base';
import { processQuery } from './queryProcessor';
import { ContextBlock, prepareContext } from './context';
import { SkillEngine } from '../../engine';

export interface PreprocessResult {
  optimizedQuery: string;
  context: ContextBlock;
  sources?: Source[];
  usedChatHistory?: any[];
}

export const preprocess = async (
  query: string,
  config: SkillRunnableConfig,
  engine: SkillEngine,
): Promise<PreprocessResult> => {
  const context = config?.configurable?.context ?? undefined;

  // Use shared query processor
  const { optimizedQuery, usedChatHistory, hasContext, remainingTokens } = await processQuery(
    query,
    config,
  );

  const needPrepareContext = hasContext && remainingTokens > 0;

  const result: PreprocessResult = {
    optimizedQuery,
    context: { files: [], results: [] },
    sources: [],
    usedChatHistory,
  };

  console.log('needpreparecontext', needPrepareContext, JSON.stringify(context));
  if (needPrepareContext) {
    result.context = await prepareContext(context, {
      maxTokens: remainingTokens,
      engine,
    });
  }

  return result;
};
