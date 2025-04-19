import { Document } from '@langchain/core/documents';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
// schema
import { z } from 'zod';
import { SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';

interface GraphState extends BaseSkillState {
  documents: Document[];
  messages: BaseMessage[];
}

// Define a new graph

export class BasicSummarySkill extends BaseSkill {
  name = 'basic_summary';
  displayName = {
    en: 'Basic Summary',
    'zh-CN': '基础总结',
  };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      relation: 'mutuallyExclusive',
      rules: [
        { key: 'resources', limit: 1 },
        { key: 'documents', limit: 1 },
        {
          key: 'contentList',
          limit: 1,
          preferredSelectionKeys: [
            'resourceSelection',
            'documentSelection',
            'extensionWeblinkSelection',
          ],
        },
      ],
    },
  };

  description = 'Give a summary of the given context';

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

  async generate(_: GraphState, config?: SkillRunnableConfig) {
    this.engine.logger.log('---GENERATE---');

    const {
      locale = 'en',
      documents: contextDocuments = [],
      resources = [],
      contentList = [],
    } = config?.configurable || {};

    let contentListText = '';
    if (resources?.length > 0) {
      contentListText = resources[0].resource?.content;
    } else if (contextDocuments?.length > 0) {
      contentListText = contextDocuments[0].document?.content;
    } else if (contentList?.length > 0) {
      contentListText = contentList
        .map((item, index) => `${index + 1}. ${item.content}`)
        .join('\n\n');
    }

    const llm = this.engine.chatModel({
      temperature: 0.9,
      maxTokens: 1024,
    });

    // 2. pass context text to llm
    const systemPrompt = `# Role
You are a web content digester who focuses on quickly understanding and organizing the main content of web pages to provide users with streamlined and accurate summaries.

## Skill
### Skill 1: Web page summary
- Extract the topic and main ideas of the web page.
- Provide a concise, summary description that allows users to quickly understand the theme and main points of the entire web page.

### Skill 2: Web page summary
- Generate concise summaries based on extracted information.

### Skill 3: Extracting key points from web pages
- Identify the main paragraphs and key points of the web page.
- List the main ideas of each important section, providing a clear list of bullet points.

## Constraints
- Only handle issues related to web content.
- Always provide an accurate summary of web content.
- When reporting the key points of each web page, strive to be concise and clear.
- The summaries, summaries, and key points generated should help users quickly understand the web page content.
- Responding in a language that the user can understand.
- Unable to handle articles exceeding a certain length.
- Using Markdown format for returns

## Examples

with locale: zh-CN (the content include in =====\n{summary}\n=====)
> please output content in given locale language, include title, summary and key points

### 总结
AgentKit 是一个直观的大型语言模型（LLM）提示框架，用于构建多功能智能体的思考过程，以解决复杂任务。

### 摘要
AgentKit 是一个直观的大型语言模型（LLM）提示框架，用于多功能智能体，通过从简单的自然语言提示中明确构建复杂的 “思考过程”。AgentKit 的设计目标是使用简单的自然语言提示来构建复杂的思考过程，以帮助用户解决复杂的任务。AgentKit 的特点是直观易用，可以帮助用户快速构建 LLM 智能体的思考过程。

### 要点
- AgentKit 是一个用于构建 LLM 智能体的思考过程的框架。
  - 支持使用简单的自然语言提示来构建复杂的思考过程。
  - 可以帮助用户解决复杂的任务。
- AgentKit 的设计目标是直观易用。
  - 提供了一个直观的界面，使用户可以快速构建 LLM 智能体的思考过程。
  - 可以帮助用户更好地理解 LLM 智能体的工作原理。
- AgentKit 适用于解决复杂任务。
  - 可以帮助用户构建 LLM 智能体的思考过程，以解决复杂的任务。
  - 可以帮助用户更好地理解 LLM 智能体的工作原理，以更好地解决复杂的任务。
...

## CONTEXT 

The content to be summarized is as follows:(with three "---" as separator, **only include the content between the separator, not include the separator**):

---

{context}

---
`;

    const contextString = contentListText || '';

    const prompt = systemPrompt.replace('{context}', contextString);
    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      new HumanMessage(`Please generate a summary based on the **CONTEXT** in ${locale} language:`),
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
