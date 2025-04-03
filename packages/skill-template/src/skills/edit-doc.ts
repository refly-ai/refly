import { BaseMessage } from '@langchain/core/messages';
import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';

// schema
import { z } from 'zod';
// types
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { CanvasEditConfig, safeStringifyJSON } from '@refly-packages/utils';
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
import * as editDocument from '../scheduler/module/editDocument';

// types
import { HighlightSelection, SelectedRange } from '../scheduler/module/editDocument/types';

import { InPlaceEditType } from '@refly-packages/utils';
import { DocumentNotFoundError } from '@refly-packages/errors';
import { DEFAULT_MODEL_CONTEXT_LIMIT } from '../scheduler/utils/constants';
import { checkModelContextLenSupport } from '../scheduler/utils/model';

export class EditDoc extends BaseSkill {
  name = 'editDoc';

  displayName = {
    en: 'Edit Document',
    'zh-CN': '编辑文档',
  };

  icon: Icon = { type: 'emoji', value: '🖊️' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Edit the document';

  schema = z.object({
    query: z.string().optional().describe('The search query'),
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
    const isModelContextLenSupport = checkModelContextLenSupport(modelInfo);

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

    const needPrepareContext = hasContext && remainingTokens > 0;
    this.engine.logger.log(
      `needRewriteQuery: ${needRewriteQuery}, needPrepareContext: ${needPrepareContext}`,
    );

    if (needRewriteQuery) {
      config.metadata.step = { name: 'analyzeContext' };
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
      config.metadata.step = { name: 'prepareContext' };
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
      modelInfo: config?.configurable?.modelInfo,
    });

    return { requestMessages };
  };

  callEditDoc = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill, documents, tplConfig } = config.configurable;

    const currentDoc = documents?.find((doc) => doc?.metadata?.isCurrentContext || doc?.isCurrent);
    const canvasEditConfig = tplConfig?.canvasEditConfig?.value as CanvasEditConfig;

    if (!currentDoc?.document) {
      throw new DocumentNotFoundError('No current document found for editing');
    }

    // Filter out documents with isCurrent before proceeding
    if (config?.configurable?.documents) {
      config.configurable.documents =
        config.configurable.documents.filter(
          (doc) => !(doc?.metadata?.isCurrentContext || doc?.isCurrent),
        ) || [];
    }

    // Get selected range and edit type from metadata
    const selectedRange = canvasEditConfig.selectedRange as SelectedRange;
    const inPlaceEditType = canvasEditConfig.inPlaceEditType as InPlaceEditType;

    // Extract content context if selection exists
    // const selectedContent = selectedRange
    //   ? editCanvas.extractContentAroundSelection(currentCanvas.canvas.content || '', selectedRange)
    //   : undefined;
    const highlightSelection = canvasEditConfig?.selection as HighlightSelection;

    const model = this.engine.chatModel({
      temperature: 0.1,
    });

    // Get module based on edit type
    const module: SkillPromptModule = editDocument.getEditDocumentModule(inPlaceEditType, {
      document: currentDoc.document,
      selectedContent: highlightSelection,
    });

    // Prepare prompts using module functions
    const { requestMessages } = await this.commonPreprocess(state, config, module);

    config.metadata.step = { name: 'editDoc' };

    try {
      const responseMessage = await model.invoke(requestMessages, {
        ...config,
        metadata: {
          ...config.metadata,
          ...currentSkill,
          docId: currentDoc.docId,
          selectedRange,
          inPlaceEditType,
        },
      });

      return {
        messages: [responseMessage],
      };
    } catch (error) {
      this.emitEvent(
        {
          event: 'error',
          content: `Document edit failed: ${error.message}`,
        },
        config,
      );
      throw error;
    }
  };

  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    }).addNode('editDoc', this.callEditDoc);

    workflow.addEdge(START, 'editDoc');
    workflow.addEdge('editDoc', END);

    return workflow.compile();
  }
}
