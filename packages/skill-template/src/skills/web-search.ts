import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly-packages/openapi-schema';
import { GraphState } from '../scheduler/types';
import { ModelContextLimitMap, safeStringifyJSON } from '@refly-packages/utils';

// utils
import { buildFinalRequestMessages } from '../scheduler/utils/message';
import { prepareWebSearchContext } from '../scheduler/utils/context';

// prompts
import * as webSearch from '../scheduler/module/webSearch/index';
import { concatMergedContextToStr, flattenMergedContextToSources } from '../scheduler/utils/summarizer';
import { preprocessQuery } from '../scheduler/utils/queryRewrite';
import { countMessagesTokens } from '../scheduler/utils/token';
import { truncateMessages } from '../scheduler/utils/truncator';
import { countToken } from '../scheduler/utils/token';

export class WebSearch extends BaseSkill {
  name = 'webSearch';

  icon: Icon = { type: 'emoji', value: '🌐' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'enableDeepReasonWebSearch',
        inputMode: 'switch',
        defaultValue: false,
        labelDict: {
          en: 'Enable Deep Search',
          'zh-CN': '启用深度搜索',
        },
        descriptionDict: {
          en: 'Enable deep search for more comprehensive results',
          'zh-CN': '启用深度搜索以获取更全面的结果',
        },
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Search the web and provide answers based on search results';

  schema = z.object({
    query: z.string().optional().describe('The search query'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  callWebSearch = async (state: GraphState, config: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    this.emitEvent({ event: 'log', content: `Start web search...` }, config);

    const { messages = [], query: originalQuery } = state;
    const { locale = 'en', chatHistory = [], modelName, currentSkill } = config.configurable;

    // Set current step
    config.metadata.step = { name: 'webSearch' };

    // Preprocess query and ensure it's not too long
    const query = preprocessQuery(originalQuery, {
      config,
      ctxThis: this,
      state,
      tplConfig: config.configurable.tplConfig,
    });

    // Preprocess chat history, ensure it's not too long
    const usedChatHistory = truncateMessages(chatHistory);

    // Calculate token limits
    const maxTokens = ModelContextLimitMap[modelName];
    const queryTokens = countToken(query);
    const chatHistoryTokens = countMessagesTokens(usedChatHistory);
    const remainingTokens = maxTokens - queryTokens - chatHistoryTokens;

    this.engine.logger.log(
      `maxTokens: ${maxTokens}, queryTokens: ${queryTokens}, chatHistoryTokens: ${chatHistoryTokens}, remainingTokens: ${remainingTokens}`,
    );

    // Perform web search with context preparation
    const webSearchContext = await prepareWebSearchContext(
      { query },
      { config, ctxThis: this, state, tplConfig: config.configurable.tplConfig },
    );

    const mergedContext = {
      mentionedContext: null,
      lowerPriorityContext: null,
      webSearchSources: webSearchContext?.processedWebSearchContext?.webSearchSources ?? [],
    };

    const contextStr = concatMergedContextToStr(mergedContext);
    const sources = flattenMergedContextToSources(mergedContext);

    this.engine.logger.log(
      `- contextStr: ${contextStr}
       - sources: ${safeStringifyJSON(sources)}`,
    );

    this.emitEvent(
      {
        event: 'structured_data',
        content: JSON.stringify(sources),
        structuredDataKey: 'sources',
      },
      config,
    );

    // Set current step for answer generation
    config.metadata.step = { name: 'answerGeneration' };

    // Build messages for the model
    const module = {
      buildSystemPrompt: webSearch.buildWebSearchSystemPrompt,
      buildContextUserPrompt: webSearch.buildWebSearchContextUserPrompt,
      buildUserPrompt: webSearch.buildWebSearchUserPrompt,
    };

    this.emitEvent({ event: 'log', content: `Prepared context successfully!` }, config);
    this.engine.logger.log(`Prepared context successfully! ${safeStringifyJSON(webSearchContext)}`);

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext: true,
      context: contextStr,
      originalQuery: query,
      rewrittenQuery: query,
    });

    this.engine.logger.log(`Request messages: ${safeStringifyJSON(requestMessages)}`);

    // Generate answer using the model
    const model = this.engine.chatModel({ temperature: 0.1 });
    const responseMessage = await model.invoke(requestMessages, {
      ...config,
      metadata: {
        ...config.metadata,
        ...currentSkill,
      },
    });

    this.engine.logger.log(`Response message: ${safeStringifyJSON(responseMessage)}`);

    return { messages: [responseMessage] };
  };

  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<BaseSkillState>({
      channels: this.graphState,
    }).addNode('webSearch', this.callWebSearch);

    workflow.addEdge(START, 'webSearch');
    workflow.addEdge('webSearch', END);

    return workflow.compile();
  }
}
