import { BaseMessage } from '@langchain/core/messages';
import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';

// schema
import { z } from 'zod';
// types
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { CanvasEditConfig } from '@refly/utils';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';
// types
import { GraphState } from '../scheduler/types';
// utils
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';

// prompts
import * as editDocument from '../scheduler/module/editDocument';

// types
import { HighlightSelection, SelectedRange } from '../scheduler/module/editDocument/types';

import { InPlaceEditType } from '@refly/utils';
import { DocumentNotFoundError } from '@refly/errors';

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
    const { query, messages = [], images = [] } = state;
    const { locale = 'en', modelConfigMap, preprocessResult } = config.configurable;
    const modelInfo = modelConfigMap.chat;

    const { optimizedQuery, context, usedChatHistory } = preprocessResult;

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      context,
      images,
      originalQuery: query,
      optimizedQuery,
      modelInfo,
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
