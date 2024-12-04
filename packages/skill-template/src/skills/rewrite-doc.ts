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
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition, Source } from '@refly-packages/openapi-schema';
import { CanvasIntentType } from '@refly-packages/common-types';
// types
import { GraphState, IContext } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { analyzeQueryAndContext, preprocessQuery } from '../scheduler/utils/queryRewrite';
import { truncateMessages } from '../scheduler/utils/truncator';
import { countMessagesTokens, countToken, ModelContextLimitMap, checkHasContext } from '../scheduler/utils/token';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';

// prompts
import * as rewriteCanvas from '../scheduler/module/rewriteCanvas';

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
  });

  graphState: StateGraphArgs<GraphState>['channels'] = {
    ...baseStateGraphArgs,
    messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    },
  };

  commonPreprocess = async (state: GraphState, config: SkillRunnableConfig, module: SkillPromptModule) => {
    const { messages = [], query: originalQuery } = state;
    const {
      locale = 'en',
      chatHistory = [],
      modelName,
      resources,
      documents,
      contentList,
      projects,
    } = config.configurable;

    const { tplConfig } = config?.configurable || {};
    const enableWebSearch = tplConfig?.enableWebSearch?.value as boolean;
    const enableKnowledgeBaseSearch = tplConfig?.enableKnowledgeBaseSearch?.value as boolean;

    let optimizedQuery = '';
    let mentionedContext: IContext;
    let context: string = '';
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
      projects: projects,
    });
    this.engine.logger.log(`checkHasContext: ${hasContext}`);

    const maxTokens = ModelContextLimitMap[modelName];
    const queryTokens = countToken(query);
    const chatHistoryTokens = countMessagesTokens(usedChatHistory);
    const remainingTokens = maxTokens - queryTokens - chatHistoryTokens;
    this.engine.logger.log(
      `maxTokens: ${maxTokens}, queryTokens: ${queryTokens}, chatHistoryTokens: ${chatHistoryTokens}, remainingTokens: ${remainingTokens}`,
    );

    // 新增：定义长查询的阈值（可以根据实际需求调整）
    const LONG_QUERY_TOKENS_THRESHOLD = 100; // 约等于50-75个英文单词或25-35个中文字

    // 优化 needRewriteQuery 判断逻辑
    const needRewriteQuery =
      queryTokens < LONG_QUERY_TOKENS_THRESHOLD && // 只有短查询才需要重写
      (hasContext || chatHistoryTokens > 0); // 保持原有的上下文相关判断

    const needPrepareContext = (hasContext && remainingTokens > 0) || enableWebSearch || enableKnowledgeBaseSearch;
    this.engine.logger.log(`needRewriteQuery: ${needRewriteQuery}, needPrepareContext: ${needPrepareContext}`);

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
          enableLowerPriorityContext: hasContext,
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
        this.emitEvent(
          {
            event: 'structured_data',
            content: JSON.stringify(sources),
            structuredDataKey: 'sources',
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
      originalQuery: query,
      rewrittenQuery: optimizedQuery,
    });

    this.engine.logger.log(`requestMessages: ${safeStringifyJSON(requestMessages)}`);

    return { requestMessages };
  };

  callRewriteCanvas = async (state: GraphState, config: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    const { messages = [], query: originalQuery } = state;

    const { chatHistory = [], currentSkill, documents } = config.configurable;

    this.emitEvent({ event: 'log', content: `Start to rewrite canvas...` }, config);

    const currentDoc = documents?.find((canvas) => canvas?.metadata?.isCurrentContext);

    // send intent matcher event
    this.emitEvent(
      {
        event: 'structured_data',
        structuredDataKey: 'intentMatcher',
        content: JSON.stringify({
          type: CanvasIntentType.RewriteDocument,
          docId: currentDoc?.docId || '',
        }),
      },
      config,
    );

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

    this.engine.logger.log(`responseMessage: ${safeStringifyJSON(responseMessage)}`);

    this.emitEvent({ event: 'log', content: `Rewrite canvas successfully!` }, config);

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
