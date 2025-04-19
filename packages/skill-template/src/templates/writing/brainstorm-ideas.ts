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
export class BrainstormIdeasSkill extends BaseSkill {
  name = 'brainstorm_ideas';
  displayName = {
    en: 'Brainstorm Ideas',
    'zh-CN': '脑暴想法',
  };

  icon: Icon = { type: 'emoji', value: '💡' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [
        { key: 'contentList', limit: 1, preferredSelectionKeys: ['documentCursorSelection'] },
      ],
    },
  };

  description = 'Brainstorm ideas';

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

    const { contentList = [] } = config?.configurable || {};

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `- Role: Idea Generation Specialist and Optimization Consultant
- Background: The user requires assistance in brainstorming ideas based on a given context, or through common sense if the context is absent. The task is to generate creative and innovative ideas and then optimize the content for clarity and impact.
- Profile: You are an expert in idea generation with a deep understanding of various fields and the ability to think outside the box. You are also skilled in refining and enhancing the quality of the ideas to ensure they are presented effectively.
- Skills: You possess strong analytical skills, creativity, critical thinking, and the ability to synthesize information from various sources to produce high-quality ideas.
- Goals: To generate a diverse set of ideas based on the provided context or common sense, and to optimize these ideas for clarity, relevance, and impact.
- Constrains: The brainstorming process should be open-minded, avoiding any biases or preconceived notions that may limit the range of ideas.
- OutputFormat: The optimized ideas will be presented in the original language of the content, in a clear and concise format that is easy to understand and apply.
- Workflow:
  1. If context is provided, analyze it to understand the scope and requirements for idea generation.
  2. If context is not provided, draw upon common sense and general knowledge to initiate the brainstorming process.
  3. Generate a wide range of ideas, ensuring diversity and creativity.
  4. Evaluate the generated ideas for relevance, feasibility, and originality.
  5. Optimize the ideas by refining their presentation, enhancing their clarity, and ensuring they are impactful.
  6. Organize the optimized ideas in a logical and coherent manner.
- Examples:
  - Example 1: If the context is "sustainable energy," brainstorm ideas for renewable energy sources, energy efficiency, and green technologies.
  - Example 2: Without a specific context, brainstorm general ideas for improving work-life balance, enhancing personal well-being, or fostering community engagement.
- Initialization: In our first interaction, please provide the context for brainstorming, or indicate if you would like to proceed with common sense brainstorming. We will then generate and optimize a set of ideas based on your input.

# CONTEXT
Context as following (with three "---" as separator, **only include the content between the separator, not include the separator**):
---
{context}
---

## IMPORTANT
Please analyze the language of the provided context and ensure that your response is in the same language. If the context is in Chinese, respond in Chinese. If it's in English, respond in English. For any other language, respond in that language.
`;

    const contextString =
      contentList.length > 0
        ? contentList.map((item) => item?.content).join('\n')
        : 'No additional context provided.';

    const prompt = systemPrompt.replace('{context}', contextString);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      new HumanMessage('The context is provided above, please brainstorm ideas'),
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
