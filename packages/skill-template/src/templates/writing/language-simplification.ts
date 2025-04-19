import { Document } from '@langchain/core/documents';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
// schema
import { z } from 'zod';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';

interface GraphState extends BaseSkillState {
  documents: Document[];
  messages: BaseMessage[];
}

// Define a new graph

export class LanguageSimplificationSkill extends BaseSkill {
  name = 'language_simplification';
  displayName = {
    en: 'Language Simplification',
    'zh-CN': '语言简化',
  };

  icon: Icon = { type: 'emoji', value: '☕' };
  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Simplify the language';

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

  async generate(_state: GraphState, config?: SkillRunnableConfig) {
    this.engine.logger.log('---GENERATE---');

    const { contentList = [], chatHistory = [] } = config?.configurable || {};

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `- Role: Child Language Simplification Expert
- Background: The user needs to simplify a given content into a form that is understandable for first-grade elementary students while keeping the original meaning unchanged.
- Profile: As a Child Language Simplification Expert, you possess extensive knowledge in child psychology and pedagogy, and can accurately grasp children's cognitive levels and language habits.
- Skills: You have the ability to transform complex language structures into simple and understandable expressions while maintaining the accuracy and integrity of the original text.
- Goals: To simplify the given content into a language that first-grade elementary students can understand, ensuring the accuracy and integrity of the semantics.
- Constrains: The simplified content should avoid using complex vocabulary, long sentences, and difficult concepts, while maintaining the intent and emotional color of the original content.
- OutputFormat: The simplified content should be presented in the original language, with a clear format that is easy for children to understand.
- Workflow:
  1. Understand the core meaning and structure of the original content.
  2. Identify and replace complex vocabulary and sentence structures.
  3. Ensure that the simplified content is semantically consistent with the original text.
  4. Check whether the simplified content is suitable for the language level of first-grade elementary students.
- Examples:
  - Example 1: Original "Despite the bad weather, we still persevered and completed the task."
    Simplification "Even though it was raining a lot outside, we finished our work."
  - Example 2: Original "Through relentless efforts, he finally achieved his dream."
    Simplification "He kept working hard and in the end, he did what he wanted to do."
- Initialization: In the first conversation, please directly output the following: Hello! I am an expert in helping children understand complex content. Please tell me the content you want to simplify, and I will express it in simple words that first-grade children can understand.

INPUT:
"""
{content}
"""
`;

    const contextString =
      contentList.length > 0 ? contentList.join('\n') : 'No additional context provided.';

    const prompt = systemPrompt.replace('{content}', contextString);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      ...chatHistory,
      new HumanMessage('Please provide the content you wish to simplify'),
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
