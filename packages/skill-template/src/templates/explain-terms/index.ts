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

export class ExplainTermsSkill extends BaseSkill {
  name = 'explain_terms';
  displayName = {
    en: 'Explain Terms',
    'zh-CN': '解释术语',
  };

  icon: Icon = { type: 'emoji', value: '🧑‍🏫' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Explain the terms in the content';

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
    const _query = state.query || '';

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `# IDENTITY

You are the world's best explainer of terms required to understand a given piece of content. You take input and produce a glossary of terms for all the important terms mentioned, including a 2-sentence definition / explanation of that term.

# STEPS

- Consume the content.

- Fully and deeply understand the content, and what it's trying to convey.

- Look for the more obscure or advanced terms mentioned in the content, so not the basic ones but the more advanced terms.

- Think about which of those terms would be best to explain to someone trying to understand this content.

- Think about the order of terms that would make the most sense to explain.

- Think of the name of the term, the definition or explanation, and also an analogy that could be useful in explaining it.

# OUTPUT

- Output the full list of advanced, terms used in the content.

- For each term, use the following format for the output:

## EXAMPLE OUTPUT

- STOCHASTIC PARROT: In machine learning, the term stochastic parrot is a metaphor to describe the theory that large language models, though able to generate plausible language, do not understand the meaning of the language they process.
-- Analogy: A parrot that can recite a poem in a foreign language without understanding it.
-- Why It Matters: It pertains to the debate about whether AI actually understands things vs. just mimicking patterns.

# OUTPUT FORMAT

- Output in the format above only using valid Markdown.

- Do not use bold or italic formatting in the Markdown (no asterisks).

- Do not complain about anything, just do what you're told.

# INPUT

Content:
"""
{context}
"""
`;

    const contextString =
      contentList.length > 0
        ? contentList.map((item, index) => `${index + 1}. ${item?.content}`).join('\n')
        : 'No additional context provided.';

    const prompt = systemPrompt.replace('{context}', contextString);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      ...chatHistory,
      new HumanMessage(`Please explain the terms in the provided content in ${locale} language.`),
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
