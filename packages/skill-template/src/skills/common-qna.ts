import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON } from '@refly-packages/utils';
import {
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Source,
} from '@refly-packages/openapi-schema';
import { createSkillTemplateInventory } from '../inventory';

// types
import { GraphState } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { truncateSource } from '../scheduler/utils/truncator';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';
import { processQuery } from '../scheduler/utils/queryProcessor';

// prompts
import * as commonQnA from '../scheduler/module/commonQnA';
import { checkModelContextLenSupport } from '../scheduler/utils/model';

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
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  // Default skills to be scheduled (they are actually templates!).
  skills: BaseSkill[] = createSkillTemplateInventory(this.engine);

  isValidSkillName = (name: string) => {
    return this.skills.some((skill) => skill.name === name);
  };

  commonPreprocess = async (
    state: GraphState,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
  ) => {
    const { messages = [], images = [] } = state;
    const { locale = 'en', modelInfo } = config.configurable;

    // Use shared query processor
    const {
      optimizedQuery,
      query,
      usedChatHistory,
      hasContext,
      remainingTokens,
      mentionedContext,
    } = await processQuery({
      config,
      ctxThis: this,
      state,
    });

    let context = '';
    let sources: Source[] = [];

    const needPrepareContext = hasContext && remainingTokens > 0;
    const isModelContextLenSupport = checkModelContextLenSupport(modelInfo);

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
        },
        {
          config,
          ctxThis: this,
          state,
          tplConfig: config?.configurable?.tplConfig || {},
        },
      );

      context = preparedRes.contextStr;
      sources = preparedRes.sources;
      this.engine.logger.log(`context: ${safeStringifyJSON(context)}`);
      this.engine.logger.log(`sources: ${safeStringifyJSON(sources)}`);
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
      rewrittenQuery: optimizedQuery,
    });

    return { requestMessages, sources };
  };

  callCommonQnA = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill } = config.configurable;

    // common preprocess
    const module = {
      buildSystemPrompt: commonQnA.buildCommonQnASystemPrompt,
      buildContextUserPrompt: commonQnA.buildCommonQnAContextUserPrompt,
      buildUserPrompt: commonQnA.buildCommonQnAUserPrompt,
    };
    const { requestMessages, sources } = await this.commonPreprocess(state, config, module);

    // set current step
    config.metadata.step = { name: 'answerQuestion' };

    if (sources.length > 0) {
      this.emitEvent({ structuredData: { sources: truncateSource(sources) } }, config);
    }

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
    }).addNode('commonQnA', this.callCommonQnA);

    workflow.addEdge(START, 'commonQnA');
    workflow.addEdge('commonQnA', END);

    return workflow.compile();
  }
}
