import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
// types
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON } from '@refly/utils';
import { Artifact, Icon, SkillTemplateConfigDefinition } from '@refly/openapi-schema';
// types
import { GraphState } from '../scheduler/types';
// utils
import { truncateMessages, truncateSource } from '../scheduler/utils/truncator';
import { countToken } from '../scheduler/utils/token';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';

// prompts
import { generateDocPromptModule } from '../scheduler/module/generateDocument';
import { extractStructuredData } from '../scheduler/utils/extractor';
import { BaseMessage, HumanMessage } from '@langchain/core/dist/messages';
import { truncateTextWithToken } from '../scheduler/utils/truncator';
import { getTitlePrompt } from '../scheduler/module/generateDocument/prompt';

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
    const { query, messages = [], images = [] } = state;
    const { locale = 'en', modelConfigMap, project, preprocessResult } = config.configurable;
    const { optimizedQuery, rewrittenQueries, context, sources, usedChatHistory } =
      preprocessResult;
    const modelInfo = modelConfigMap.chat;

    // Extract customInstructions from project if available
    const customInstructions = project?.customInstructions;

    this.engine.logger.log(`context: ${safeStringifyJSON(context)}`);

    if (sources.length > 0) {
      this.emitEvent({ structuredData: { sources: truncateSource(sources) } }, config);
    }

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      context,
      images,
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
      modelInfo,
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
    const { locale = 'en', uiLocale = 'en', modelConfigMap } = config.configurable;
    const modelInfo = modelConfigMap.titleGeneration;

    const model = this.engine.chatModel({ temperature: 0.1 }, 'titleGeneration');

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

    const titlePrompt = `${getTitlePrompt(locale, uiLocale)}

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
        modelInfo,
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

    const module = generateDocPromptModule;

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
    const doc = await this.engine.service.createDocument(user, {
      title: documentTitle || optimizedQuery,
      initialContent: '',
    });

    // Set current step
    config.metadata.step = { name: 'generateDocument' };

    const artifact: Artifact = {
      type: 'document',
      entityId: doc?.docId || '',
      title: doc?.title || '',
    };
    this.emitEvent(
      {
        event: 'artifact',
        artifact,
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
