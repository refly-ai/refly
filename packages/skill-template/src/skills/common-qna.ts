import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON } from '@refly-packages/utils';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition, Source } from '@refly-packages/openapi-schema';
import { createSkillTemplateInventory } from '../inventory';

// types
import { GraphState, IContext } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { analyzeQueryAndContext, preprocessQuery } from '../scheduler/utils/queryRewrite';
import { truncateMessages } from '../scheduler/utils/truncator';
import { countMessagesTokens, countToken, ModelContextLimitMap, checkHasContext } from '../scheduler/utils/token';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';

// prompts
import * as commonQnA from '../scheduler/module/commonQnA';

export class CommonQnA extends BaseSkill {
  name = 'commonQnA';

  icon: Icon = { type: 'emoji', value: '💬' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Answer common questions';

  schema = z.object({
    query: z.string().optional().describe('The question to be answered'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  // Default skills to be scheduled (they are actually templates!).
  skills: BaseSkill[] = createSkillTemplateInventory(this.engine);

  isValidSkillName = (name: string) => {
    return this.skills.some((skill) => skill.name === name);
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

    const needPrepareContext = hasContext && remainingTokens > 0;
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
      config.metadata.step = { name: 'analyzeContext' };

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
      this.engine.logger.log(`sources: ${safeStringifyJSON(sources)}`);

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

  callCommonQnA = async (state: GraphState, config: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    this.emitEvent({ event: 'log', content: `Start to call common qna...` }, config);

    const { currentSkill } = config.configurable;

    // common preprocess
    const module = {
      buildSystemPrompt: commonQnA.buildCommonQnASystemPrompt,
      buildContextUserPrompt: commonQnA.buildCommonQnAContextUserPrompt,
      buildUserPrompt: commonQnA.buildCommonQnAUserPrompt,
    };
    const { requestMessages } = await this.commonPreprocess(state, config, module);

    this.emitEvent({ event: 'log', content: `Start to generate an answer...` }, config);

    // set current step
    config.metadata.step = { name: 'answerQuestion' };

    const model = this.engine.chatModel({ temperature: 0.1 });
    const responseMessage = await model.invoke(requestMessages, {
      ...config,
      metadata: {
        ...config.metadata,
        ...currentSkill,
      },
    });

    this.engine.logger.log(`responseMessage: ${safeStringifyJSON(responseMessage)}`);

    this.emitEvent({ event: 'log', content: `Generated an answer successfully!` }, config);

    return { messages: [responseMessage] };
  };

  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<BaseSkillState>({
      channels: this.graphState,
    }).addNode('commonQnA', this.callCommonQnA);

    workflow.addEdge(START, 'commonQnA');
    workflow.addEdge('commonQnA', END);

    return workflow.compile();
  }
}
