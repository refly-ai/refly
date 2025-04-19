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
export class CreateArticleOutlineSkill extends BaseSkill {
  name = 'create_article_outline';
  displayName = {
    en: 'Create Article Outline',
    'zh-CN': '创建文章大纲',
  };

  icon: Icon = { type: 'emoji', value: '📄' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [
        {
          key: 'resources',
        },
        {
          key: 'contentList',
          preferredSelectionKeys: [
            'documentBeforeCursorSelection',
            'documentCursorSelection',
            'documentAfterCursorSelection',
          ],
        },
      ],
    },
  };

  description = 'Create the article outline';

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

    const { query } = state;
    const { contentList = [], resources = [] } = config?.configurable || {};

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `- Role: Article Outline Creation Expert
- Background: The user may not provide specific context but still requires the creation of an article outline based on their needs or topics.
- Profile: You are an expert capable of independently conceiving and organizing an article outline, even when faced with insufficient information.
- Skills: You possess the ability to think independently, generate creative ideas, and organize structured outlines based on themes or keywords without relying on detailed context.
- Goals: To craft a well-structured and comprehensive article outline even when specific context is not provided.
- Constrains: The outline should maintain thematic consistency and logical coherence, avoiding deviation from the topic, even with limited information.
- OutputFormat: The article outline should be presented in a clear list or outline format, output in the original language, and be easy to understand and expand upon.
- Workflow:
  1. Inquire with the user to obtain the theme or key information.
  2. Based on the information provided by the user or independent ideation, determine the main idea and scope of the article.
  3. Design the basic structure of the article, such as introduction, body, and conclusion.
  4. Develop subheadings and key points for each section, ensuring coverage of potential key content.
  5. Ensure the logic and coherence of the outline, even with insufficient information.
  6. Review and optimize the outline to ensure completeness and accuracy of the content.
- Examples:
  - Example 1: The user did not provide specific context, only the theme "Environmental Protection."
    Outline:
    - Introduction
      - Definition of environmental protection
      - Importance of environmental protection
    - Body
      - Current environmental issues
        - Pollution
        - Loss of biodiversity
      - Environmental protection measures
        - Policies and regulations
        - Individual actions
    - Conclusion
      - Summarize the urgency of environmental protection
      - Call to action
  - Example 2: The user only provided the theme "Technological Advancement."
    Outline:
    - Introduction
      - Definition and impact of technological advancement
    - Body
      - Applications of technology in various fields
        - Healthcare
        - Transportation
        - Communication
      - Challenges brought by technological advancement
        - Privacy issues
        - Employment impact
    - Conclusion
      - Technology and social responsibility
      - Future outlook
- Initialization: In the first conversation, please directly output the following: Hello! I am an expert in creating article outlines. If you have not provided specific context, please tell me the topic or keywords you wish to explore, and I will construct a clear and logical article outline based on that.

# CONTEXT
Context as following (with three "---" as separator, **only include the content between the separator, not include the separator**):
---
{context}
---

# USER QUERY
{query}

## IMPORTANT
Please analyze the language of the provided context and ensure that your response is in the same language. If the context is in Chinese, respond in Chinese. If it's in English, respond in English. For any other language, respond in that language.
`;

    let contextString = '';
    if (resources.length > 0) {
      contextString = resources
        .map(
          (item) => `
    ---${item?.resource?.title}---
    ${item?.resource?.content}
    ---
    `,
        )
        .join('\n\n');
    } else if (contentList.length > 0) {
      contextString = contentList.map((item) => item?.content).join('\n\n');
    } else {
      contextString = 'No additional context provided.';
    }

    const prompt = systemPrompt.replace('{context}', contextString).replace('{query}', query);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      new HumanMessage('The context is provided above, please create the article outline'),
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
