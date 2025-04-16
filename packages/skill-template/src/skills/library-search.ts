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

import { buildFinalRequestMessages } from '../scheduler/utils/message';

// prompts
import { prepareContext } from '../scheduler/utils/context';
import { truncateSource } from '../scheduler/utils/truncator';
import * as librarySearch from '../scheduler/module/librarySearch';
import { processQuery } from '../scheduler/utils/queryProcessor';
import { extractAndCrawlUrls } from '../scheduler/utils/extract-weblink';
import { processContextUrls } from '../utils/url-processing';

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
    const { messages = [], images = [] } = state;
    const { locale = 'en', currentSkill, project } = config.configurable;

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

    // Use shared query processor
    const {
      optimizedQuery,
      rewrittenQueries,
      query,
      usedChatHistory,
      remainingTokens,
      mentionedContext,
    } = await processQuery({
      config,
      ctxThis: this,
      state,
    });

    // Extract URLs from the query and crawl them with optimized concurrent processing
    const { sources: queryUrlSources, analysis } = await extractAndCrawlUrls(query, config, this, {
      concurrencyLimit: 5, // Increase concurrent URL crawling limit
      batchSize: 8, // Increase batch size for URL processing
    });

    this.engine.logger.log(`URL extraction analysis: ${safeStringifyJSON(analysis)}`);
    this.engine.logger.log(`Extracted query URL sources count: ${queryUrlSources.length}`);

    // Process URLs from frontend context if available
    const contextUrls = config.configurable?.urls || [];
    const contextUrlSources = await processContextUrls(contextUrls, config, this);

    if (contextUrlSources.length > 0) {
      this.engine.logger.log(`Added ${contextUrlSources.length} URL sources from context`);
    }

    // Combine URL sources from context and query extraction
    const urlSources = [...contextUrlSources, ...(queryUrlSources || [])];
    this.engine.logger.log(`Total combined URL sources: ${urlSources.length}`);

    // Set current step
    config.metadata.step = { name: 'librarySearch' };

    // Prepare context with library search focus
    const { contextStr, sources } = await prepareContext(
      {
        query: optimizedQuery,
        rewrittenQueries,
        mentionedContext,
        maxTokens: remainingTokens,
        enableMentionedContext: true,
        urlSources, // Pass URL sources to the prepareContext function
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
      needPrepareContext: true,
      context: contextStr,
      images,
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
      modelInfo: config?.configurable?.modelInfo,
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
