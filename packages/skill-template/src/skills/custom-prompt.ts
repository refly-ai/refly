import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';
import { GraphState } from '../scheduler/types';
import { safeStringifyJSON } from '@refly/utils';

// utils
import { buildFinalRequestMessages } from '../scheduler/utils/message';
import { truncateSource } from '../scheduler/utils/truncator';
// prompts
import * as customPrompt from '../scheduler/module/customPrompt/index';

export class CustomPrompt extends BaseSkill {
  name = 'customPrompt';

  icon: Icon = { type: 'emoji', value: '✍️' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'customSystemPrompt',
        inputMode: 'textarea',
        defaultValue: '',
        labelDict: {
          en: 'Custom System Prompt',
          'zh-CN': '自定义系统提示词',
        },
        descriptionDict: {
          en: 'Define your own system prompt to control the assistant behavior',
          'zh-CN': '定义您自己的系统提示词以控制助手行为',
        },
      },
      {
        key: 'temperature',
        inputMode: 'number',
        defaultValue: 0.1,
        labelDict: {
          en: 'Temperature',
          'zh-CN': 'Temperature',
        },
        descriptionDict: {
          en: 'Controls randomness in the output (0.0-1.0)',
          'zh-CN': '控制输出的随机性 (0.0-1.0)',
        },
        inputProps: {
          min: 0,
          max: 1,
          step: 0.1,
          precision: 2,
        },
      },
      {
        key: 'topP',
        inputMode: 'number',
        defaultValue: 1,
        labelDict: {
          en: 'Top P',
          'zh-CN': 'Top P',
        },
        descriptionDict: {
          en: 'Controls diversity via nucleus sampling (0.0-1.0)',
          'zh-CN': '通过核采样控制多样性 (0.0-1.0)',
        },
        inputProps: {
          min: 0,
          max: 1,
          step: 0.1,
          precision: 2,
        },
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Use a custom system prompt to control assistant behavior';

  schema = z.object({
    query: z.string().optional().describe('The user query'),
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  callCustomPrompt = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { query, messages = [], images = [] } = state;
    const {
      currentSkill,
      tplConfig,
      locale = 'en',
      project,
      runtimeConfig,
      modelConfigMap,
      preprocessResult,
    } = config.configurable;
    const modelInfo = modelConfigMap.chat;

    // Set current step
    config.metadata.step = { name: 'analyzeQuery' };

    // Only enable knowledge base search if both projectId AND runtimeConfig.enabledKnowledgeBase are true
    const projectId = project?.projectId;
    const enableKnowledgeBaseSearch = !!projectId && !!runtimeConfig?.enabledKnowledgeBase;

    this.engine.logger.log(
      `ProjectId: ${projectId}, Enable KB Search: ${enableKnowledgeBaseSearch}`,
    );

    // Get custom system prompt and instructions
    let customSystemPrompt = (tplConfig?.customSystemPrompt?.value as string) || '';
    const customInstructions = project?.customInstructions;

    // Update tplConfig with knowledge base search setting
    config.configurable.tplConfig = {
      ...config.configurable.tplConfig,
      enableKnowledgeBaseSearch: {
        value: enableKnowledgeBaseSearch,
        label: 'Knowledge Base Search',
        displayValue: enableKnowledgeBaseSearch ? 'true' : 'false',
      },
    };

    // If customSystemPrompt is empty, look for it in chat history
    if (!customSystemPrompt && config.configurable.chatHistory?.length > 0) {
      // Iterate through chat history in reverse order (most recent first)
      for (let i = config.configurable.chatHistory.length - 1; i >= 0; i--) {
        const message = config.configurable.chatHistory[i];
        // Check if message has skillMeta and tplConfig with customSystemPrompt
        const skillMeta = message.additional_kwargs?.skillMeta as { name?: string } | undefined;
        const messageTplConfig = message.additional_kwargs?.tplConfig as
          | Record<string, any>
          | undefined;

        if (skillMeta?.name === 'customPrompt' && messageTplConfig?.customSystemPrompt?.value) {
          customSystemPrompt = messageTplConfig.customSystemPrompt.value as string;
          this.engine.logger.log('Found customSystemPrompt in chat history');
          break;
        }
      }
    }

    const {
      optimizedQuery,
      context: contextStr,
      sources,
      usedChatHistory,
      rewrittenQueries,
    } = preprocessResult;

    this.engine.logger.log('Prepared context successfully!');

    // Handle sources if available
    if (sources?.length > 0) {
      // Split sources into smaller chunks based on size and emit them separately
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

    config.metadata.step = { name: 'answerQuestion' };

    // Build messages for the model using the customPrompt module
    const module = {
      buildSystemPrompt: (locale: string, needPrepareContext: boolean) =>
        customPrompt.buildCustomPromptSystemPrompt(customSystemPrompt, locale, needPrepareContext),
      buildContextUserPrompt: customPrompt.buildCustomPromptContextUserPrompt,
      buildUserPrompt: customPrompt.buildCustomPromptUserPrompt,
    };

    // Build messages using the utility function
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
      modelInfo,
      customInstructions,
    });

    // Generate answer using the model
    const model = this.engine.chatModel({
      temperature: Number(tplConfig?.temperature?.value ?? 0.1),
      topP: Number(tplConfig?.topP?.value ?? 1),
    });
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
    }).addNode('customPrompt', this.callCustomPrompt);

    workflow.addEdge(START, 'customPrompt');
    workflow.addEdge('customPrompt', END);

    return workflow.compile();
  }
}
