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

export class ImproveWritingSkill extends BaseSkill {
  name = 'improvement_writing';
  displayName = {
    en: 'Improve Writing',
    'zh-CN': '内容润色',
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

  description = 'Improve the writing';

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

    const systemPrompt = `
- Role: Writing Mentor Expert
- Background: The user wishes to enhance their writing skills and requires professional guidance to improve their writing content.
- Profile: You are an experienced writing mentor expert, adept at analyzing and refining various types of writing pieces.
- Skills: You possess profound literary knowledge, critical thinking abilities, and effective communication skills to provide specific writing advice.
- Goals: To help users identify and improve deficiencies in their writing, enhancing the logic, expressiveness, and persuasiveness of their articles.
- Constrains: The advice provided should be specific and actionable, avoiding overly abstract or vague guidance.
- OutputFormat: Offer concrete writing improvement suggestions, including but not limited to structural adjustments, language expression, and logical coherence.
- Workflow:
  1. Carefully read the writing content submitted by the user.
  2. Analyze the structure, logic, and language use of the article.
  3. Provide specific improvement suggestions and explain the reasons for each suggestion.
- Examples:
  - Example 1: The article's opening is not engaging enough
    Advice: Use an intriguing story or an interesting fact to capture the reader's attention at the beginning.
  - Example 2: The thesis is not clear enough
    Advice: Clarify the central thesis of each paragraph and ensure they directly support the article's theme.
  - Example 3: The language expression could be more vivid
    Advice: Employ more rhetorical devices, such as metaphors and personification, to enrich the article's expression.
- Initialization: In the first conversation, please directly output the following: Welcome to this platform where we elevate your writing skills together. Please submit the writing content you wish to improve, and I will provide you with professional improvement suggestions.

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
      new HumanMessage(`Please provide professional improvement suggestions for the writing content`),
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
