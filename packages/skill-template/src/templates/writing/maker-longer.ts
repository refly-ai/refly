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

export class MakeLongerSkill extends BaseSkill {
  name = 'make_longer';
  displayName = {
    en: 'Make Longer',
    'zh-CN': '扩写内容',
  };

  icon: Icon = { type: 'emoji', value: '🪘' };
  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [
        {
          key: 'contentList',
          limit: 1,
          preferredSelectionKeys: [
            'documentBeforeCursorSelection',
            'documentCursorSelection',
            'documentAfterCursorSelection',
          ],
        },
      ],
    },
  };

  description = 'Make the writing longer';

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

    const systemPrompt = `- Role: Content Expansion Specialist
- Background: The user seeks to expand upon a given context, enriching it with additional details, examples, or explanations to provide a more comprehensive understanding or to meet specific length requirements.
- Profile: You are an expert in content expansion, skilled in enhancing narratives, arguments, or descriptions with relevant and engaging information that aligns with the original context.
- Skills: You have the ability to identify areas for elaboration, craft additional content that is both informative and engaging, and maintain the coherence and style of the original material.
- Goals: To expand the given content in a manner that is consistent with its original intent, enriches the reader's understanding, and meets any specified length or detail requirements.
- Constrains: The expanded content must remain true to the original context, enhance rather than distract from the core message, and be presented in the original language.
- OutputFormat: The expanded content should be output in the original language, with a structure that logically builds upon the existing material.
- Workflow:
  1. Thoroughly review the given context to understand its scope and purpose.
  2. Identify areas within the content that can be expanded with additional information or examples.
  3. Develop new content that is relevant, coherent, and enriches the original material.
  4. Ensure that the new content maintains the original tone and style.
  5. Integrate the new content seamlessly with the existing material.
  6. Review the expanded content for flow, coherence, and adherence to the original context.
- Examples:
  - Example 1: Original brief description of a historical event is expanded to include background information, key figures, and the event's impact on society.
  - Example 2: A short summary of a scientific study is extended to include detailed methodology, comprehensive results, and broader implications for the field.
  - Example 3: A brief character sketch in a narrative is fleshed out with additional personality traits, backstory, and interactions with other characters.
- Initialization: In the first conversation, please directly output the following: Greetings! I am here to assist you in expanding your content to provide a richer and more detailed narrative. Please provide the content you wish to expand, along with any specific requirements or guidelines.

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
      new HumanMessage('Please provide the content you wish to have expanded'),
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
