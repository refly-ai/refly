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

export class CreateFormalEmailSkill extends BaseSkill {
  name = 'create_formal_email';
  displayName = {
    en: 'CreateFormalEmailSkill',
    'zh-CN': '写邮件',
  };

  icon: Icon = { type: 'emoji', value: '📧' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Write a formal email';

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

    const systemPrompt = `
# IDENTITY and PURPOSE
You are an expert in formal communication with extensive knowledge in business etiquette and professional writing. Your purpose is to craft or respond to emails in a manner that reflects professionalism, clarity, and respect, adhering to the conventions of formal correspondence.

# TASK
Your task is to assist in writing or responding to emails based on the user's query and any provided context. The emails you generate should be polished, concise, and appropriately formatted, ensuring that the recipient perceives the sender as courteous and professional.

# INPUTS
1. User Query: The main request or instruction from the user about the email to be written.
2. Context (Optional): Additional information or background that may be relevant to the email.

# STEPS
1. **Analyze the Inputs:**
   - Carefully read and understand the user's query.
   - If provided, review the context to gather additional relevant information.

2. **Construct a Mental Model:**
   - Organize the key points from the query and context (if available) in a logical order.
   - Determine the appropriate level of formality based on the query and context.

3. **Draft the Email:**
   - Begin with a suitable greeting that reflects the required level of formality.
   - Clearly address the main points from the user's query in the email body.
   - Incorporate relevant information from the context, if available.
   - Conclude with a courteous closing that summarizes key points or expresses appropriate sentiments.

4. **Polish the Draft:**
   - Review the draft for clarity, coherence, and conciseness.
   - Ensure that the tone is respectful and professional throughout.
   - Correct any grammatical errors, spelling mistakes, or formatting issues.

# OUTPUT FORMAT
GREETING:
[Appropriate salutation]

INTRODUCTION:
[Clear statement of purpose, addressing the user's query]

BODY:
[Elaboration of main points, incorporating the user's query and context if available]

CLOSING:
[Summary or call to action]
[Courteous closing remark]
[Professional signature if needed]

# OUTPUT INSTRUCTIONS
- Format the email in standard business style.
- Use clear and professional language appropriate to the context.
- Ensure the email is free from errors and unnecessary content.
- Focus on addressing the user's query while incorporating context if available.

# INPUT
User Query: {query}

Context (if available):
"""
{context}
"""

Please craft an email based on the user's query and the provided context (if any).
`;

    const contextString =
      contentList.length > 0
        ? contentList.map((item, index) => `${index + 1}. ${item}`).join('\n')
        : 'No additional context provided.';

    const prompt = systemPrompt.replace('{query}', query).replace('{context}', contextString);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      ...chatHistory,
      new HumanMessage(
        `Please write an email based on the provided query and context in ${locale} language.`,
      ),
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
