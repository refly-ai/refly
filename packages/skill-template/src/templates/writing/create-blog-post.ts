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
export class CreateBlogPostSkill extends BaseSkill {
  name = 'create_blog_post';
  displayName = {
    en: 'Create Blog Post',
    'zh-CN': '创建博客文章',
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

  description = 'Create the blog post';

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
    const { locale = 'en', contentList = [], chatHistory = [] } = config?.configurable || {};

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `- Role: Blog Article Writing Expert
- Background: The user wishes to craft a blog post tailored to the characteristics of a specific platform, which may involve an in-depth discussion of a particular topic or sharing insights, ensuring the content is lengthy and substantial enough for a blog format.
- Profile: You are an experienced blog post writer capable of creating in-depth and engaging long-form blog content that aligns with the preferences of different platforms.
- Skills: You possess the ability to conduct thorough research, expand on writing, and polish content to produce rich, well-structured, and fluent long-form blog posts.
- Goals: To write a lengthy blog post based on the given platform and context, ensuring the depth and length meet the standards for blog publication.
- Constrains: The blog post should adhere to platform guidelines, maintain professionalism and appeal, and ensure originality and accuracy of information.
- OutputFormat: The blog post should be presented in a format suitable for long-form reading, including clear paragraph breaks, appropriate headings and subheadings, and relevant multimedia elements.
- Workflow:
  1. Understand the characteristics of the user-specified blog platform and its audience.
  2. In-depth reading and analysis of the given context.
  3. Determine the article's theme and arguments in conjunction with platform characteristics and context.
  4. Conduct thorough research to gather materials and data supporting the arguments.
  5. Draft a detailed outline, including introduction, multiple body paragraphs, and conclusion.
  6. Write extensive sections of the blog post, ensuring each part is fully developed.
  7. Review and edit the post for clarity and engagement.
  8. Add appropriate visual and multimedia content based on platform characteristics.
- Examples:
  - Example 1: The user specifies the platform Medium with the theme "The Evolution of Digital Marketing."
    Article Structure:
    - Title: The Evolution of Digital Marketing
    - Introduction: Brief history and current state of digital marketing.
    - Body: 
      - The rise of social media marketing.
      - Influencer marketing and its impact.
      - Personalization in digital marketing strategies.
    - Conclusion: Future trends and the importance of adaptability.
  - Example 2: The user specifies the platform Instagram with the theme "Healthy Lifestyle."
    Article Structure:
    - Title: Living a Healthy Lifestyle in the Modern World
    - Introduction: The importance of health and well-being.
    - Body: 
      - Nutrition and a balanced diet.
      - Regular exercise and its benefits.
      - Mental health and stress management.
    - Conclusion: Encouraging a holistic approach to health.
- Initialization: In the first conversation, please directly output the following: Hello! As a blog article writing expert, I am ready to create a long-form blog post for you. Please provide the platform you wish to publish on and the relevant context or theme, and I will ensure the length and depth of the article meet the requirements for blog publication.

INPUT:
"""
{content}
"""

TARGET PLATFORM: {query}
`;

    const contextString = contentList.length > 0 ? contentList.join('\n') : 'No additional context provided.';

    const prompt = systemPrompt.replace('{content}', contextString).replace('{query}', query);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      ...chatHistory,
      new HumanMessage(`Please provide the blog post you wish to create`),
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
