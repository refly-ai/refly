import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';
import { GraphState } from '../scheduler/types';
import { buildFinalRequestMessages } from '../scheduler/utils/message';

// prompts
import { truncateSource } from '../scheduler/utils/truncator';
import * as librarySearch from '../scheduler/module/librarySearch';

export class LibrarySearch extends BaseSkill {
  name = 'librarySearch';

  icon: Icon = { type: 'emoji', value: '🔍' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Search the library and provide answers based on search results';

  schema = z.object({
    query: z.string().optional().describe('The search query'),
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  callLibrarySearch = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { query, messages = [], images = [] } = state;
    const {
      locale = 'en',
      currentSkill,
      project,
      modelConfigMap,
      preprocessResult,
    } = config.configurable;

    // Extract customInstructions from project if available
    const customInstructions = project?.customInstructions;

    // Process projectId based knowledge base search

    // Set current step
    config.metadata.step = { name: 'analyzeQuery' };

    // Force enable knowledge base search and disable web search
    config.configurable.tplConfig = {
      ...config.configurable.tplConfig,
      enableWebSearch: { value: false, label: 'Web Search', displayValue: 'false' },
      enableKnowledgeBaseSearch: {
        value: true,
        label: 'Knowledge Base Search',
        displayValue: 'true',
      },
      enableSearchWholeSpace: { value: true, label: 'Search Whole Space', displayValue: 'true' },
    };

    const {
      optimizedQuery,
      context: contextStr,
      sources,
      usedChatHistory,
      rewrittenQueries,
    } = preprocessResult;

    // Set current step for answer generation
    config.metadata.step = { name: 'answerQuestion' };

    // Build messages for the model
    const module = {
      buildSystemPrompt: (locale: string, needPrepareContext: boolean) =>
        librarySearch.buildLibrarySearchSystemPrompt(locale, needPrepareContext),
      buildContextUserPrompt: librarySearch.buildLibrarySearchContextUserPrompt,
      buildUserPrompt: librarySearch.buildLibrarySearchUserPrompt,
    };

    if (sources.length > 0) {
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

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      context: contextStr,
      images,
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
      modelInfo: modelConfigMap.chat,
      customInstructions,
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

    return { messages: [responseMessage] };
  };

  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<BaseSkillState>({
      channels: this.graphState,
    }).addNode('librarySearch', this.callLibrarySearch);

    workflow.addEdge(START, 'librarySearch');
    workflow.addEdge('librarySearch', END);

    return workflow.compile();
  }
}
