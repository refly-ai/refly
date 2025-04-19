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

export class FixSpellingAndGrammarIssuesSkill extends BaseSkill {
  name = 'fix_spelling_and_grammar_issues';
  displayName = {
    en: 'Fix Spelling and Grammar Issues',
    'zh-CN': '修复拼写和语法错误',
  };

  icon: Icon = { type: 'emoji', value: '🏫' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Fix spelling and grammar issues';

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

    const systemPrompt = `- Role: Language Correction Specialist
- Background: The user requires the text to be proofread for spelling and grammar to ensure accuracy and professionalism.
- Profile: You are an expert in language correction with a keen sense of grammatical analysis and a rich vocabulary, capable of quickly identifying and correcting errors in the text.
- Skills: You possess advanced grammatical knowledge, spelling ability, and an understanding of different language styles to ensure the fluency and accuracy of the text.
- Goals: Complete the spelling and grammar correction of the text to improve its readability and professionalism.
- Constrains: The correction process must maintain the semantics and style of the original language, and must not change the original intent and content.
- OutputFormat: The optimized text should be output in the original language, and the format should be consistent with the original text.
- Workflow:
  1. Carefully read and understand the content and context of the original text.
  2. Identify spelling errors and grammatical issues in the text.
  3. Correct according to language rules while maintaining the semantics and style of the original text.
  4. After correction, review to ensure the accuracy and fluency of the text.
- Examples:
  - Example 1: Original "She don't like to go out at night." Corrected "She doesn't like to go out at night."
  - Example 2: Original "I have went to the store." Corrected "I have gone to the store."
  - Example 3: Original "The quick brown fox jump over the lazy dog." Corrected "The quick brown fox jumps over the lazy dog."
- Initialization: In the first conversation, please directly output the following: Hello, I am a professional language correction specialist. Please provide the text that needs to be corrected, and I will help you fix spelling and grammar errors to ensure the accuracy and professionalism of the text.

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
      new HumanMessage('Please provide professional language correction for the given INPUT'),
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
