import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import {
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
} from '@refly-packages/openapi-schema';
import { GraphState } from '../scheduler/types';
import { safeStringifyJSON } from '@refly-packages/utils';

// utils
import { buildFinalRequestMessages } from '../scheduler/utils/message';
import { prepareContext } from '../scheduler/utils/context';
// prompts
import * as webSearch from '../scheduler/module/webSearch/index';
import { truncateSource } from '../scheduler/utils/truncator';
import { processQuery } from '../scheduler/utils/queryProcessor';

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
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  callWebSearch = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { messages = [], images = [] } = state;
    const { locale = 'en', currentSkill } = config.configurable;

    // Set current step
    config.metadata.step = { name: 'webSearch' };

    // Force enable web search and disable knowledge base search
    config.configurable.tplConfig = {
      ...config.configurable.tplConfig,
      enableWebSearch: { value: true, label: 'Web Search', displayValue: 'true' },
      enableKnowledgeBaseSearch: {
        value: false,
        label: 'Knowledge Base Search',
        displayValue: 'false',
      },
    };

    // Use shared query processor
    const {
      optimizedQuery,
      query,
      usedChatHistory,
      remainingTokens,
      mentionedContext,
      rewrittenQueries,
    } = await processQuery({
      config,
      ctxThis: this,
      state,
    });

    // Prepare context with web search focus
    const { contextStr, sources } = await prepareContext(
      {
        query: optimizedQuery,
        mentionedContext,
        maxTokens: remainingTokens,
        enableMentionedContext: true,
        rewrittenQueries,
      },
      {
        config,
        ctxThis: this,
        state,
        tplConfig: config.configurable.tplConfig,
      },
    );

    // Set current step for answer generation
    config.metadata.step = { name: 'answerQuestion' };

    // Build messages for the model
    const module = {
      buildSystemPrompt: webSearch.buildWebSearchSystemPrompt,
      buildContextUserPrompt: webSearch.buildWebSearchContextUserPrompt,
      buildUserPrompt: webSearch.buildWebSearchUserPrompt,
    };

    this.engine.logger.log('Prepared context successfully!');

    if (sources?.length > 0) {
      // Split sources into smaller chunks based on size and emit them separately
      const truncatedSources = truncateSource(sources);
      await this.emitLargeDataEvent(
        {
          data: truncatedSources,
          buildEventData: (chunk, { isPartial, chunkIndex, totalChunks }) => ({
            structuredData: {
              // Build your event data here
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

    // Now proceed with building request messages after all chunks are sent
    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext: true,
      context: contextStr,
      images,
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
    });

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
