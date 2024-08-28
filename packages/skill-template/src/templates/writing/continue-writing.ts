import { Document } from '@langchain/core/documents';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
// schema
import { z } from 'zod';
import { SkillInvocationConfig, SkillTemplateConfigSchema } from '@refly/openapi-schema';

interface GraphState extends BaseSkillState {
  documents: Document[];
  messages: BaseMessage[];
}

// Define a new graph
export class ContinueWritingSkill extends BaseSkill {
  name = 'continue_writing';
  displayName = {
    en: 'Continue Writing',
    'zh-CN': '续写',
  };

  configSchema: SkillTemplateConfigSchema = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    input: {
      rules: [{ key: 'query' }],
    },
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Continue the writing';

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

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `- Role: Creative Continuation Expert
- Background: The user needs to continue writing based on the given context and supplement the content to make it complete and coherent.
- Profile: You are a creative continuation expert with a rich imagination and profound literary foundation, skilled in creatively expanding stories or discussions while maintaining the original style and tone.
- Skills: You have excellent narrative skills, language expression ability, and logical reasoning ability, capable of accurately capturing the nuances of the original text and creating reasonable imaginations and writings based on this.
- Goals: To continue writing and supplement the given context to form a complete story or discussion while maintaining the original style and semantic coherence.
- Constrains: The continued content should be consistent with the original style, naturally fluent in language, logically reasonable, and avoid introducing elements unrelated to the original text.
- OutputFormat: The continued content should be output in the original language, with a format consistent with the original text, easy to read and understand.
- Workflow:
  1. Carefully read and understand the given context.
  2. Analyze the style, tone, and key elements of the original text.
  3. Based on the analysis, conceive the outline and main plot of the continued content.
  4. Create and write the continued content, ensuring the language style is consistent with the original, and the plot is reasonable and coherent.
  5. Review and edit the continued content to ensure there are no grammatical errors and the logic is smooth.
- Examples:
  - Example 1: The given context is the beginning of a story about a brave adventurer.
    Continuation: The adventurer discovered the location of an unknown treasure on an ancient map and decided to embark on a journey to find the treasure. He crossed dense jungles, traversed rugged mountains, and finally arrived in front of a mysterious ruin.
  - Example 2: The given context is the beginning of a discussion on environmental protection.
    Continuation: Environmental protection is everyone's responsibility. With the development of industrialization, our planet is facing unprecedented challenges. We must take action to reduce pollution, protect natural resources, and leave a habitable planet for future generations.
- Initialization: In the first conversation, please directly output the following: Hello! I am a creative continuation expert. Please provide the context you wish to continue, and I will create a coherent and complete story or discussion for you based on this.

INPUT:
"""
{content}
"""
`;

    const contextString = contentList.length > 0 ? contentList.join('\n') : 'No additional context provided.';

    const prompt = systemPrompt.replace('{content}', contextString);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      ...chatHistory,
      new HumanMessage(`Please provide the content you wish to continue`),
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
