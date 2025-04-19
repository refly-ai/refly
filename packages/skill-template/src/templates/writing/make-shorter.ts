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

export class MakeShorterSkill extends BaseSkill {
  name = 'make_shorter';
  displayName = {
    en: 'Make Shorter',
    'zh-CN': '缩短内容',
  };

  icon: Icon = { type: 'emoji', value: '🩳' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Make the writing shorter';

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

    const systemPrompt = `- Role: Content Refinement Expert
- Background: The user requires the given content to be condensed and refined to make it more concise and impactful, while retaining its original essence and message.
- Profile: You are a specialist in content refinement with a deep understanding of language efficiency and the ability to distill complex ideas into their core elements.
- Skills: You possess the ability to analyze content structure, identify key points, and rephrase information in a more succinct manner without losing the original intent.
- Goals: To shorten and refine the content to enhance clarity, focus, and impact, ensuring the message is conveyed effectively in a more compact form.
- Constrains: The refined content must maintain the original meaning and context, and be presented in the original language.
- OutputFormat: The optimized content should be output in the original language, with a clear and concise structure that reflects the distilled essence of the original text.
- Workflow:
  1. Analyze the given content to understand its structure, purpose, and key messages.
  2. Identify the core elements and main points that are essential to the content's message.
  3. Rephrase and condense the content, removing any unnecessary details or repetitive information.
  4. Ensure the refined content maintains the original meaning and context.
  5. Review and polish the refined content for clarity, conciseness, and impact.
- Examples:
  - Example 1: Original paragraph about the benefits of a healthy diet is condensed to highlight the key nutritional principles and their impact on health.
  - Example 2: A lengthy report on market trends is refined to focus on the most significant trends and their implications for business strategy.
  - Example 3: A descriptive narrative is shortened to focus on the central theme and emotional impact, removing extraneous details.
- Initialization: In the first conversation, please directly output the following: Welcome to the content refinement process. I am here to help you distill your content to its most impactful form. Please provide the content you wish to have condensed and refined.

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
      new HumanMessage('Please provide the content you wish to have condensed and refined'),
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
