import { BaseMessage } from '@langchain/core/messages';
import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';

// schema
import { z } from 'zod';
// types
import { SystemMessage } from '@langchain/core/messages';
import { HumanMessage } from '@langchain/core/messages';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON } from '@refly-packages/utils';
import {
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Source,
} from '@refly-packages/openapi-schema';
// types
import { GraphState, IContext } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { analyzeQueryAndContext, preprocessQuery } from '../scheduler/utils/query-rewrite';
import { truncateMessages, truncateSource } from '../scheduler/utils/truncator';
import { countMessagesTokens, countToken, checkHasContext } from '../scheduler/utils/token';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';

// prompts
import * as rewriteCanvas from '../scheduler/module/rewriteCanvas';
import { DEFAULT_MODEL_CONTEXT_LIMIT } from '../scheduler/utils/constants';

export class RewriteDoc extends BaseSkill {
  name = 'rewriteDoc';

  icon: Icon = { type: 'emoji', value: '🔄' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Rewrite the document';

  schema = z.object({
    query: z.string().optional().describe('The rewrite query'),
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<GraphState>['channels'] = {
    ...baseStateGraphArgs,
    messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    },
  };

  commonPreprocess = async (
    state: GraphState,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
  ) => {
    const { messages = [], query: originalQuery, images = [] } = state;
    const {
      locale = 'en',
      chatHistory = [],
      modelInfo,
      resources,
      documents,
      contentList,
    } = config.configurable;

    const { tplConfig } = config?.configurable || {};
    const enableWebSearch = tplConfig?.enableWebSearch?.value as boolean;
    const enableKnowledgeBaseSearch = tplConfig?.enableKnowledgeBaseSearch?.value as boolean;

    let optimizedQuery = '';
    let mentionedContext: IContext;
    let context = '';
    let sources: Source[] = [];
    // preprocess query, ensure query is not too long
    const query = preprocessQuery(originalQuery, {
      config: config,
      ctxThis: this,
      state: state,
      tplConfig,
    });
    optimizedQuery = query;
    this.engine.logger.log(`preprocess query: ${query}`);

    // preprocess chat history, ensure chat history is not too long
    const usedChatHistory = truncateMessages(chatHistory);

    // check if there is any context
    const hasContext = checkHasContext({
      contentList,
      resources,
      documents,
    });
    this.engine.logger.log(`checkHasContext: ${hasContext}`);

    const maxTokens = modelInfo.contextLimit || DEFAULT_MODEL_CONTEXT_LIMIT;
    const queryTokens = countToken(query);
    const chatHistoryTokens = countMessagesTokens(usedChatHistory);
    const remainingTokens = maxTokens - queryTokens - chatHistoryTokens;
    this.engine.logger.log(
      `maxTokens: ${maxTokens}, queryTokens: ${queryTokens}, chatHistoryTokens: ${chatHistoryTokens}, remainingTokens: ${remainingTokens}`,
    );

    const LONG_QUERY_TOKENS_THRESHOLD = 100; // About 50-75 English words or 25-35 Chinese characters

    // Optimize needRewriteQuery judgment logic
    const needRewriteQuery =
      queryTokens < LONG_QUERY_TOKENS_THRESHOLD && // Only rewrite short queries
      (hasContext || chatHistoryTokens > 0); // Keep original context-related judgment

    const needPrepareContext =
      (hasContext && remainingTokens > 0) || enableWebSearch || enableKnowledgeBaseSearch;
    this.engine.logger.log(
      `needRewriteQuery: ${needRewriteQuery}, needPrepareContext: ${needPrepareContext}`,
    );

    if (needRewriteQuery) {
      const analyedRes = await analyzeQueryAndContext(query, {
        config,
        ctxThis: this,
        state: state,
        tplConfig,
      });
      optimizedQuery = analyedRes.optimizedQuery;
      mentionedContext = analyedRes.mentionedContext;
    }

    this.engine.logger.log(`optimizedQuery: ${optimizedQuery}`);
    this.engine.logger.log(`mentionedContext: ${safeStringifyJSON(mentionedContext)}`);

    if (needPrepareContext) {
      const preparedRes = await prepareContext(
        {
          query: optimizedQuery,
          mentionedContext,
          maxTokens: remainingTokens,
          enableMentionedContext: hasContext,
        },
        {
          config: config,
          ctxThis: this,
          state: state,
          tplConfig,
        },
      );

      context = preparedRes.contextStr;
      sources = preparedRes.sources;
      this.engine.logger.log(`context: ${safeStringifyJSON(context)}`);

      if (sources.length > 0) {
        const truncatedSources = truncateSource(sources);
        await this.emitLargeDataEvent(
          {
            data: truncatedSources,
            buildEventData: (chunk, { isPartial, chunkIndex, totalChunks }) => ({
              structuredData: {
                sources: chunk,
                isPartial,
                chunkIndex,
                totalChunks,
              },
            }),
          },
          config,
        );
      }
    }

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext,
      context,
      images,
      originalQuery: query,
      optimizedQuery,
      modelInfo: config?.configurable?.modelInfo,
    });

    return { requestMessages };
  };

  callRewriteCanvas = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { query: originalQuery } = state;

    const { chatHistory = [], currentSkill, documents } = config.configurable;

    const currentDoc = documents?.find((canvas) => canvas?.metadata?.isCurrentContext);

    const model = this.engine.chatModel({ temperature: 0.1 });

    const rewriteCanvasUserPrompt = rewriteCanvas.rewriteCanvasUserPrompt(originalQuery);
    const rewriteCanvasContext = rewriteCanvas.rewriteDocumentContext(currentDoc?.document);

    const requestMessages = [
      new SystemMessage(rewriteCanvas.rewriteCanvasSystemPrompt),
      ...chatHistory,
      new HumanMessage(rewriteCanvasContext),
      new HumanMessage(rewriteCanvasUserPrompt),
    ];

    const responseMessage = await model.invoke(requestMessages, {
      ...config,
      metadata: {
        ...config.metadata,
        ...currentSkill,
      },
    });

    return { messages: [responseMessage] };
  };

  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    }).addNode('rewrite', this.callRewriteCanvas);

    workflow.addEdge(START, 'rewrite');
    workflow.addEdge('rewrite', END);

    return workflow.compile();
  }
}
