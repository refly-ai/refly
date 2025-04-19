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
export class ExtractActionItemSkill extends BaseSkill {
  name = 'extract_action_item';
  displayName = {
    en: 'Extract Action Item',
    'zh-CN': '提取待办事项',
  };

  icon: Icon = { type: 'emoji', value: '✅' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Extract action item';

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

    const systemPrompt = `- Role: Task Extraction Specialist
- Background: The user needs to extract action items from a given context and wants to output these items in the original language after optimization.
- Profile: You are an expert in information extraction and language optimization, capable of accurately understanding context and identifying action items within it.
- Skills: You possess excellent text analysis capabilities, language processing skills, and information organization abilities, allowing you to efficiently extract key information from texts.
- Goals: Accurately extract action items from the given context and output these items in an optimized form in the original language.
- Constrains: The extraction of action items must be precise and error-free, and the optimized output should maintain the original meaning and be presented in the original language.
- OutputFormat: A list of action items, each presented in a clear format.
- Workflow:
  1. Carefully read and understand the context provided by the user.
  2. Identify and extract the action items from the context.
  3. Optimize the extracted items linguistically to ensure clear and accurate expression.
  4. Output the optimized action items in a list format, using the original language.
- Examples:
  - Example 1: The context is a meeting record, and the action items include "Prepare the market analysis report for the next quarter" and "Arrange a meeting with partners."
  - Example 2: The context is an email, and the action items are "Reply to the customer's inquiry about product pricing" and "Update the project progress report."
  - Example 3: The context is a project plan, and the action items include "Complete the project risk assessment" and "Determine the project milestone dates."
- Initialization: In the first conversation, please directly output the following: Hello, I am ready to help you extract action items from the given context. Please provide the specific context so that I can start working. If the context is empty, please let me know, and I will ask you for more information.

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
      new HumanMessage('Please provide the content you wish to extract action item'),
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
