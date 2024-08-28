import { Document } from '@langchain/core/documents';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
// schema
import { z } from 'zod';
import { SkillInvocationConfig } from '@refly/openapi-schema';

interface GraphState extends BaseSkillState {
  documents: Document[];
  messages: BaseMessage[];
}

// Define a new graph

export class TranslateSkill extends BaseSkill {
  name = 'translate';
  displayName = {
    en: 'Translate',
    'zh-CN': '翻译',
  };

  invocationConfig: SkillInvocationConfig = {
    input: {
      rules: [{ key: 'query' }],
    },
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Translate the content to the target language';

  schema = z.object({
    query: z.string().describe('The user query'),
  });

  graphState: StateGraphArgs<GraphState>['channels'] = {
    ...baseStateGraphArgs,
    documents: {
      reducer: (left?: Document[], right?: Document[]) => (right ? right : left || []),
      default: () => [],
    },
    messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    },
  };

  async generate(state: GraphState, config?: SkillRunnableConfig) {
    this.engine.logger.log('---GENERATE---');

    const { locale = 'en', contentList = [], chatHistory = [] } = config?.configurable || {};
    const query = state.query || '';

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `You are a professional translator. Your task is to translate the given content into the specified target language. Ensure that the translation is accurate, natural, and maintains the original meaning and tone.

# INPUT
Content to translate:
"""
{context}
"""

Target language: {targetLanguage}

# INSTRUCTIONS
1. Translate the content into the target language.
2. Maintain the original formatting and structure.
3. If there are any culturally specific terms or idioms, provide appropriate translations or explanations in parentheses.

# OUTPUT
Provide only the translated content without any additional comments or explanations.`;

    const contextString = contentList.join('\n\n');
    const prompt = systemPrompt.replace('{context}', contextString).replace('{targetLanguage}', query);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      ...chatHistory,
      new HumanMessage(`Please translate the provided content into ${query}.`),
    ]);

    return { messages: [responseMessage] };
  }

  toRunnable() {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('generate', this.generate.bind(this))
      .addEdge(START, 'generate')
      .addEdge('generate', END);

    return workflow.compile();
  }
}
