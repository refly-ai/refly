import { BaseMessage } from '@langchain/core/messages';
import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';

// schema
import { z } from 'zod';
// types
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { CanvasEditConfig, safeStringifyJSON } from '@refly-packages/utils';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition, Source } from '@refly-packages/openapi-schema';
// types
import { GraphState, IContext } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { analyzeQueryAndContext, preprocessQuery } from '../scheduler/utils/queryRewrite';
import { truncateMessages } from '../scheduler/utils/truncator';
import { countMessagesTokens, countToken, ModelContextLimitMap, checkHasContext } from '../scheduler/utils/token';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';

// prompts
import * as editDocument from '../scheduler/module/editDocument';

// types
import { HighlightSelection, SelectedRange } from '../scheduler/module/editDocument/types';

import { InPlaceEditType } from '@refly-packages/utils';
import { DocumentNotFoundError } from '@refly-packages/errors';

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

      this.emitEvent(
        {
          event: 'structured_data',
          content: JSON.stringify(sources),
          structuredDataKey: 'sources',
        },
        config,
      );
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

  // TODO: 将实际的 canvas 的内容发送给模型，拼接为 prompt 处理
  /**
   * Update canvas：更新的形态
   * 1. 口头模糊指明（可能涉及处理多个）：直接口头指明模糊更新的内容（需要模型扫描并给出待操作的模块和对应的 startIndex 和 endIndex），则只需要优化这些内容，其他保持原样，并且发送给前端流式写入
   * 2. 前端明确选中（目前只支持一个）：明确具备选中的 startIndex 和 endIndex（使用的是 tiptap editor），则只需要优化这块内容，其他保持原样，并且发送给前端流式写入
   */
  callEditDoc = async (state: GraphState, config: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    const { messages = [], query: originalQuery } = state;

    const { currentSkill, documents, tplConfig } = config.configurable;

    const currentDoc = documents?.find((doc) => doc?.metadata?.isCurrentContext);
    const canvasEditConfig = tplConfig?.canvasEditConfig?.value as CanvasEditConfig;

    if (!currentDoc?.document) {
      throw new DocumentNotFoundError('No current document found for editing');
    }

    this.emitEvent(
      {
        event: 'log',
        content: `Starting document edit operation for document: ${currentDoc.document.title}`,
      },
      config,
    );

    // Get selected range from metadata
    const selectedRange = canvasEditConfig.selectedRange as SelectedRange;
    const inPlaceEditType = canvasEditConfig.inPlaceEditType as InPlaceEditType;

    // Extract content context if selection exists
    // const selectedContent = selectedRange
    //   ? editCanvas.extractContentAroundSelection(currentCanvas.canvas.content || '', selectedRange)
    //   : undefined;
    const highlightSelection = canvasEditConfig?.selection as HighlightSelection;

    const model = this.engine.chatModel({
      temperature: 0.1,
      maxTokens: 4096,
    });

    // Get module based on edit type
    const module: SkillPromptModule = editDocument.getEditDocumentModule(inPlaceEditType, {
      document: currentDoc.document,
      selectedContent: highlightSelection,
    });

    // Prepare prompts using module functions
    const { requestMessages } = await this.commonPreprocess(state, config, module);

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

      // Extract edit sections from response, passing selectedContent if it exists
      // const editSections = editCanvas.extractEditSections(responseMessage.content as string, selectedContent);

      // Extract thinking process for logging/debugging
      // const thinking = editCanvas.extractThinking(responseMessage.content as string);

      // Emit edit sections
      // this.emitEvent(
      //   {
      //     event: 'structured_data',
      //     structuredDataKey: 'editSections',
      //     content: JSON.stringify({
      //       sections: editSections,
      //       thinking,
      //       mode: selectedContent ? 'selection' : 'verbal',
      //     }),
      //   },
      //   config,
      // );

      this.emitEvent(
        {
          event: 'log',
          content: 'Document edit completed successfully',
        },
        config,
      );

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
