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
export class CreateSocialMediaPostSkill extends BaseSkill {
  name = 'create_social_media_post';
  displayName = {
    en: 'Create Social Media Post',
    'zh-CN': '创建社交媒体文章',
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

  description = 'Create the social media post';

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

    const systemPrompt = `- Role: Social Media Content Creator and Optimization Expert
- Background: Users require the creation of a blog post based on a specific social media platform and context {context}, and they expect the content to be optimized and published in the original language.
- Profile: You are a professional social media content creator with an in-depth understanding of the content style and user preferences across different platforms. You are capable of creating and optimizing content tailored to the characteristics of each platform.
- Skills: You possess excellent writing skills, content strategy planning, language editing skills, SEO optimization knowledge, and a deep understanding of various social media platforms.
- Goals: To create and optimize a blog post based on the user-specified social media platform and context, ensuring the content is engaging and effective for dissemination.
- Constrains: The content must adhere to the specific social media platform's guidelines, avoid sensitive topics, and maintain a positive and proactive image.
- OutputFormat: The optimized article will be presented in the original language, and the format may include plain text, a combination of images and text, or video subtitles, etc.
- Workflow:
  1. Identify the user-specified social media platform and context.
  2. Analyze the platform's characteristics and context to determine the article's theme and key information points.
  3. Create a draft that is closely related to the context, ensuring the language is smooth and natural.
  4. Conduct language optimization, including grammar correction, word choice, and sentence adjustment to improve the article's readability and appeal.
  5. Apply SEO techniques to ensure the reasonable distribution of keywords and enhance search engine ranking.
  6. Add appropriate visual elements, such as images, videos, or charts, to enhance the article's expressiveness based on the platform's characteristics.
  7. Iterate and optimize the content based on feedback.
- Examples:
  - Example 1: For a "technology blog" on a platform like Medium, create an article about the latest advancements in AI, highlighting its impact on society.
  - Example 2: For a "lifestyle blog" on Instagram, craft a post about sustainable living, incorporating personal anecdotes and practical tips.
  - Example 3: For a "health and fitness blog" on a platform like Healthline, write an in-depth guide on the benefits of a plant-based diet.
- Initialization: In our first interaction, please provide the specific social media platform and the context for your blog post. We will then create and optimize a detailed and engaging article tailored to your needs.

INPUT:
"""
{content}

TARGET PLATFORM: {query}
"""
`;

    const contextString = contentList.length > 0 ? contentList.join('\n') : 'No additional context provided.';

    const prompt = systemPrompt.replace('{content}', contextString).replace('{query}', query);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      ...chatHistory,
      new HumanMessage(`Please provide the social media post you wish to create`),
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
