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
import { GraphState, IContext } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { analyzeQueryAndContext, preprocessQuery } from '../scheduler/utils/queryRewrite';
import { truncateMessages } from '../scheduler/utils/truncator';
import { countMessagesTokens, countToken, ModelContextLimitMap, checkHasContext } from '../scheduler/utils/token';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';

// prompts
import * as generateDocument from '../scheduler/module/generateDocument';
import { extractStructuredData } from '../scheduler/utils/extractor';
import { BaseMessage, HumanMessage } from '@langchain/core/dist/messages';
import { truncateText } from '../scheduler/utils/truncator';

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
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
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

    return { requestMessages, context, usedChatHistory };
  };

  // Add new method to generate title
  generateTitle = async (
    state: GraphState,
    config: SkillRunnableConfig,
    { context, chatHistory }: { context: string; chatHistory: BaseMessage[] },
  ): Promise<string> => {
    const { query = '' } = state;
    const { locale = 'en', uiLocale = 'en' } = config.configurable;

    const model = this.engine.chatModel({ temperature: 0.1 });

    // Prepare context snippet if available
    let contextSnippet = '';
    if (context) {
      const maxContextTokens = 300; // Target for ~200-400 tokens
      const tokens = countToken(context);
      if (tokens > maxContextTokens) {
        // Take first part of context up to token limit
        contextSnippet = truncateText(context, maxContextTokens);
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
      );

      // Log the reasoning process
      this.engine.logger.log(`Title generation reason: ${result.reason}`);

      // Emit structured data for UI
      this.emitEvent(
        {
          event: 'structured_data',
          content: JSON.stringify({
            title: result.title,
            description: result.description,
            reason: result.reason,
          }),
          structuredDataKey: 'titleGeneration',
        },
        config,
      );

      return result.title;
    } catch (error) {
      this.engine.logger.error(`Failed to generate title: ${error}`);
      return locale === 'zh-CN' ? '新文档' : 'New Document';
    }
  };

  callGenerateDoc = async (state: GraphState, config: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    this.emitEvent({ event: 'log', content: `Start to call generate document...` }, config);

    const { currentSkill, uiLocale = 'en' } = config?.configurable || {};
    const { user } = config.configurable;

    const model = this.engine.chatModel({ temperature: 0.1 });

    const module = {
      buildSystemPrompt: generateDocument.buildGenerateDocumentSystemPrompt,
      buildUserPrompt: generateDocument.buildGenerateDocumentUserPrompt,
      buildContextUserPrompt: generateDocument.buildGenerateDocumentContextUserPrompt,
    };
    const { requestMessages, context, usedChatHistory } = await this.commonPreprocess(state, config, module);

    // Generate title first
    config.metadata.step = { name: 'generateTitle' };

    const documentTitle = await this.generateTitle(state, config, {
      context,
      chatHistory: usedChatHistory,
    });

    // Create document with generated title
    const res = await this.engine.service.createDocument(user, {
      title: documentTitle,
      initialContent: '',
    });

    // set current step
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

    this.emitEvent({ event: 'log', content: `Start to generate document...` }, config);

    const responseMessage = await model.invoke(requestMessages, {
      ...config,
      metadata: {
        ...config.metadata,
        ...currentSkill,
        artifact,
      },
    });

    this.engine.logger.log(`responseMessage: ${safeStringifyJSON(responseMessage)}`);
    this.emitEvent({ event: 'log', content: `Generated document successfully!` }, config);

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
