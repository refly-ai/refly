import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
// types
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON } from '@refly-packages/utils';
import {
  Artifact,
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Source,
} from '@refly-packages/openapi-schema';
// types
import { GraphState } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { truncateMessages, truncateSource } from '../scheduler/utils/truncator';
import { countToken } from '../scheduler/utils/token';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';
import { processQuery } from '../scheduler/utils/queryProcessor';
import { extractAndCrawlUrls } from '../scheduler/utils/extract-weblink';
import { processContextUrls } from '../utils/url-processing';

// prompts
import * as generateDocument from '../scheduler/module/generateDocument';
import { extractStructuredData } from '../scheduler/utils/extractor';
import { BaseMessage, HumanMessage } from '@langchain/core/dist/messages';
import { truncateTextWithToken } from '../scheduler/utils/truncator';
import { checkModelContextLenSupport } from '../scheduler/utils/model';

// Add title schema with reason
const titleSchema = z.object({
  title: z.string().describe('The document title based on user query and context'),
  description: z.string().optional().describe('A brief description of the document content'),
  reason: z.string().describe('The reasoning process for generating this title'),
});

export class GenerateDoc extends BaseSkill {
  name = 'generateDoc';

  icon: Icon = { type: 'emoji', value: '📝' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Generate a document according to the user query';

  schema = z.object({
    query: z.string().optional().describe('The search query'),
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  commonPreprocess = async (
    state: GraphState,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
  ) => {
    config.metadata.step = { name: 'analyzeQuery' };
    const { messages = [], images = [] } = state;
    const { locale = 'en', modelInfo, project } = config.configurable;

    // Extract customInstructions from project if available
    const customInstructions = project?.customInstructions;

    // Process projectId based knowledge base search
    const projectId = project?.projectId;
    const enableKnowledgeBaseSearch = !!projectId;

    // Update tplConfig with knowledge base search setting
    config.configurable.tplConfig = {
      ...config.configurable.tplConfig,
      enableKnowledgeBaseSearch: {
        value: enableKnowledgeBaseSearch,
        label: 'Knowledge Base Search',
        displayValue: enableKnowledgeBaseSearch ? 'true' : 'false',
      },
    };

    // Use shared query processor
    const {
      optimizedQuery,
      query,
      usedChatHistory,
      hasContext,
      remainingTokens,
      mentionedContext,
      rewrittenQueries,
    } = await processQuery({
      config,
      ctxThis: this,
      state,
    });

    // Extract URLs from the query and crawl them with optimized concurrent processing
    const { sources: queryUrlSources, analysis } = await extractAndCrawlUrls(query, config, this, {
      concurrencyLimit: 5,
      batchSize: 8,
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

    let context = '';
    let sources: Source[] = [];

    // Consider URL sources for context preparation
    const hasUrlSources = urlSources.length > 0;
    const needPrepareContext =
      (hasContext || hasUrlSources || enableKnowledgeBaseSearch) && remainingTokens > 0;
    const isModelContextLenSupport = checkModelContextLenSupport(modelInfo);

    this.engine.logger.log(`optimizedQuery: ${optimizedQuery}`);
    this.engine.logger.log(`mentionedContext: ${safeStringifyJSON(mentionedContext)}`);
    this.engine.logger.log(`hasUrlSources: ${hasUrlSources}`);

    if (needPrepareContext) {
      config.metadata.step = { name: 'analyzeContext' };
      const preparedRes = await prepareContext(
        {
          query: optimizedQuery,
          mentionedContext,
          maxTokens: remainingTokens,
          enableMentionedContext: hasContext,
          rewrittenQueries,
          urlSources, // Pass combined URL sources to prepareContext
        },
        {
          config,
          ctxThis: this,
          state,
          tplConfig: {
            ...(config?.configurable?.tplConfig || {}),
            enableKnowledgeBaseSearch: {
              value: enableKnowledgeBaseSearch,
              label: 'Knowledge Base Search',
              displayValue: enableKnowledgeBaseSearch ? 'true' : 'false',
            },
          },
        },
      );

      context = preparedRes.contextStr;
      sources = preparedRes.sources;

      this.engine.logger.log(`context: ${safeStringifyJSON(context)}`);

      if (sources.length > 0) {
        this.emitEvent({ structuredData: { sources: truncateSource(sources) } }, config);
      }
    }

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext: needPrepareContext && isModelContextLenSupport,
      context,
      images,
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
      modelInfo: config?.configurable?.modelInfo,
      customInstructions,
    });

    return { optimizedQuery, requestMessages, context, sources, usedChatHistory, rewrittenQueries };
  };

  // Add new method to generate title
  generateTitle = async (
    state: GraphState,
    config: SkillRunnableConfig,
    { context, chatHistory }: { context: string; chatHistory: BaseMessage[] },
  ): Promise<string> => {
    const { query = '' } = state;
    const { locale = 'en', uiLocale = 'en' } = config.configurable;

    const model = this.engine.chatModel({ temperature: 0.1 }, true);

    // Prepare context snippet if available
    let contextSnippet = '';
    if (context) {
      const maxContextTokens = 300; // Target for ~200-400 tokens
      const tokens = countToken(context);
      if (tokens > maxContextTokens) {
        // Take first part of context up to token limit
        contextSnippet = truncateTextWithToken(context, maxContextTokens);
      } else {
        contextSnippet = context;
      }
    }

    // Prepare recent chat history
    const recentHistory = truncateMessages(chatHistory); // Limit chat history tokens

    const titlePrompt = `${generateDocument.getTitlePrompt(locale, uiLocale)}

USER QUERY:
${query}

${
  contextSnippet
    ? `RELEVANT CONTEXT:
${contextSnippet}`
    : ''
}

${
  recentHistory.length > 0
    ? `RECENT CHAT HISTORY:
${recentHistory.map((msg) => `${(msg as HumanMessage)?.getType?.()}: ${msg.content}`).join('\n')}`
    : ''
}`;

    try {
      const result = await extractStructuredData(
        model,
        titleSchema,
        titlePrompt,
        config,
        3, // Max retries
        config?.configurable?.modelInfo,
      );

      // Log the reasoning process
      this.engine.logger.log(`Title generation reason: ${result.reason}`);

      // Emit structured data for UI
      this.emitEvent(
        {
          structuredData: {
            titleGeneration: {
              title: result.title,
              description: result.description,
              reason: result.reason,
            },
          },
        },
        config,
      );

      return result.title;
    } catch (error) {
      this.engine.logger.error(`Failed to generate title: ${error}`);
      return '';
    }
  };

  callGenerateDoc = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill, user } = config.configurable;

    const model = this.engine.chatModel({ temperature: 0.1 });

    const module = {
      buildSystemPrompt: (locale: string, needPrepareContext: boolean) =>
        generateDocument.buildGenerateDocumentSystemPrompt(locale, needPrepareContext),
      buildUserPrompt: generateDocument.buildGenerateDocumentUserPrompt,
      buildContextUserPrompt: generateDocument.buildGenerateDocumentContextUserPrompt,
    };

    const { optimizedQuery, requestMessages, context, sources, usedChatHistory } =
      await this.commonPreprocess(state, config, module);

    // Generate title first
    config.metadata.step = { name: 'generateTitle' };

    const documentTitle = await this.generateTitle(state, config, {
      context,
      chatHistory: usedChatHistory,
    });
    if (documentTitle) {
      this.emitEvent(
        { log: { key: 'generateTitle', descriptionArgs: { title: documentTitle } } },
        config,
      );
    } else {
      this.emitEvent({ log: { key: 'generateTitleFailed' } }, config);
    }

    // Create document with generated title
    const res = await this.engine.service.createDocument(user, {
      title: documentTitle || optimizedQuery,
      initialContent: '',
    });

    // Set current step
    config.metadata.step = { name: 'generateDocument' };

    const artifact: Artifact = {
      type: 'document',
      entityId: res.data?.docId || '',
      title: res.data?.title || '',
    };
    this.emitEvent(
      {
        event: 'artifact',
        artifact: { ...artifact, status: 'generating' },
      },
      config,
    );

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

    const responseMessage = await model.invoke(requestMessages, {
      ...config,
      metadata: {
        ...config.metadata,
        ...currentSkill,
        artifact,
      },
    });

    this.emitEvent(
      {
        event: 'artifact',
        artifact: { ...artifact, status: 'finish' },
      },
      config,
    );

    return { messages: [responseMessage] };
  };

  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('generateDocument', this.callGenerateDoc)
      .addEdge(START, 'generateDocument')
      .addEdge('generateDocument', END);

    return workflow.compile();
  }
}
