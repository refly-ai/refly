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

export class BasicSummaryWithResourceSkill extends BaseSkill {
  name = 'basic_summary_with_resource';
  displayName = {
    en: 'Basic Summary with Resource',
    'zh-CN': '基于选中资源的总结',
  };

  configSchema: SkillTemplateConfigSchema = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    input: {
      rules: [{ key: 'query' }],
    },
    context: {
      rules: [{ key: 'resourceIds' }],
    },
  };

  description = 'Give a summary of the selected resource';

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

    const { documents } = state;
    const { user } = config;
    const { locale = 'en', contentList = [] } = config?.configurable || {};

    const { resourceIds = [] } = config?.configurable || {};
    const lastResourceId = resourceIds[resourceIds.length - 1];
    const lastResource = await this.engine.service.getResourceDetail(user, {
      resourceId: lastResourceId,
    });

    // 1. build context text
    const contextToCitationText = documents.reduce((total, cur) => {
      (total += `\n\n下面是网页 [${cur?.metadata?.title}](${cur?.metadata?.source}) 的内容\n\n`),
        (total += `\n===\n${cur?.pageContent}\n===\n\n`);

      return total;
    }, '');

    // 1.1 contentList
    const contentListText = lastResource?.data?.content;
    // 1.2 handle resourceIds one by one

    // 1.3 handle noteIds one by one

    const llm = this.engine.chatModel({
      temperature: 0.9,
      maxTokens: 1024,
    });

    // 2. pass context text to llm
    const systemPrompt = `# IDENTITY and PURPOSE

You are an expert content summarizer. You take content in and output a Markdown formatted summary using the format below.

Take a deep breath and think step by step about how to best accomplish this goal using the following steps.

# OUTPUT SECTIONS

- Combine all of your understanding of the content into a single, 20-word sentence in a section called ONE SENTENCE SUMMARY:.

- Output the 10 most important points of the content as a list with no more than 15 words per point into a section called MAIN POINTS:.

- Output a list of the 5 best takeaways from the content in a section called TAKEAWAYS:.

# OUTPUT INSTRUCTIONS

- Create the output using the formatting above.
- You only output human readable Markdown.
- Output numbered lists, not bullets.
- Do not output warnings or notes—just the requested sections.
- Do not repeat items in the output sections.
- Do not start items with the same opening words.

# INPUT:
"""
{input}
"""
`;

    const contextString = contentList.length > 0 ? contentListText : '';

    const prompt = systemPrompt.replace(`{input}`, contextString);
    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      new HumanMessage(`Please generate a summary based on the input in ${locale} language:`),
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
