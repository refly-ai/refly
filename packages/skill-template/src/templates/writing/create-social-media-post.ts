import { Document } from '@langchain/core/documents';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
// schema
import { z } from 'zod';
import {
  DynamicConfigValue,
  SkillContextContentItem,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Icon,
} from '@refly/openapi-schema';
import {
  languageNameToLocale,
  localeToLanguageName,
  SelectedTextDomain,
  zhCNLocale,
} from '@refly/common-types';

interface GraphState extends BaseSkillState {
  documents: Document[];
  messages: BaseMessage[];
}

export interface IContent extends SkillContextContentItem {
  metadata: { domain: SelectedTextDomain };
}

// Define a new graph
const zhLocaleDict = languageNameToLocale?.['zh-CN'] || {};
const localeOptionList = Object.values(zhLocaleDict).map((val: keyof typeof zhCNLocale) => ({
  labelDict: {
    en: localeToLanguageName?.en?.[val],
    'zh-CN': localeToLanguageName?.['zh-CN']?.[val],
  },
  value: val as string,
}));

// Define a new graph
export class CreateSocialMediaPostSkill extends BaseSkill {
  name = 'create_social_media_post';
  displayName = {
    en: 'Create Social Media Post',
    'zh-CN': '创建社交媒体文章',
  };

  icon: Icon = { type: 'emoji', value: '📰' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'targetPlatform',
        inputMode: 'select',
        labelDict: {
          en: 'Target Platform',
          'zh-CN': '目标平台',
        },
        descriptionDict: {
          en: 'The platform to create the social media post for',
          'zh-CN': '目标平台',
        },
        required: {
          value: true,
          configScope: ['runtime'],
        },
        defaultValue: 'twitter',
        options: [
          {
            value: 'twitter',
            labelDict: {
              en: 'Twitter',
              'zh-CN': 'Twitter',
            },
          },
          {
            value: 'facebook',
            labelDict: {
              en: 'Facebook',
              'zh-CN': 'Facebook',
            },
          },
          {
            value: 'reddit',
            labelDict: {
              en: 'Reddit',
              'zh-CN': 'Reddit',
            },
          },
          {
            value: 'linkedin',
            labelDict: {
              en: 'LinkedIn',
              'zh-CN': 'LinkedIn',
            },
          },
          {
            value: 'xiaohongshu',
            labelDict: {
              en: 'Xiaohongshu',
              'zh-CN': '小红书',
            },
          },
          {
            value: 'weibo',
            labelDict: {
              en: 'Weibo',
              'zh-CN': '微博',
            },
          },
          {
            value: 'wechat-moment',
            labelDict: {
              en: 'WeChat Moment',
              'zh-CN': '微信朋友圈',
            },
          },
        ],
      },
      {
        key: 'topic',
        inputMode: 'inputTextArea',
        defaultValue: '',
        labelDict: {
          en: 'Topic',
          'zh-CN': '主题',
        },
        descriptionDict: {
          en: 'The topic of the social media post',
          'zh-CN': '输入你要撰写的社交媒体文章主题',
        },
        required: {
          value: true,
          configScope: ['runtime'],
        },
      },
      {
        key: 'language',
        inputMode: 'select',
        labelDict: {
          en: 'Language',
          'zh-CN': '语言',
        },
        defaultValue: 'en',
        descriptionDict: {
          en: 'The language of the article',
          'zh-CN': '文章语言',
        },
        required: {
          value: true,
          configScope: ['runtime'],
        },
        options: localeOptionList,
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [
        {
          key: 'contentList',
          limit: 1,
          preferredSelectionKeys: [
            'documentBeforeCursorSelection',
            'documentCursorSelection',
            'documentAfterCursorSelection',
          ],
        },
      ],
    },
  };

  description = 'Create the social media post';

  schema = z.object({});

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

    const { contentList = [], chatHistory = [], tplConfig } = config?.configurable || {};

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `- Role: Social Media Copywriting Expert
- Background: Users need to generate attractive copy for different social media platforms to enhance the influence and engagement of their brand or personal presence.
- Profile: You are a copywriting expert proficient in social media marketing, with a deep understanding of the user demographics and content preferences of each platform.
- Skills: You possess creative thinking, market insight, language mastery, and a keen sense of social media trends.
- Goals: To create compelling, platform-appropriate copy that resonates with the target audience on various social media platforms for the user.
- Constrains: The copy must adhere to the content guidelines of each platform, avoid sensitive words, and consider cultural differences and language habits.
- OutputFormat: For each platform, provide one or more pieces of copy, including headlines, body text, and possible hashtags or topics.
- Workflow:
  1. Understand the context, topic, language, and target platform provided by the user.
  2. Analyze the characteristics of the target platform's users and their content preferences to determine the style and tone of the copy.
  3. Create copy that fits the platform's characteristics, combined with the background and topic.
  4. Review the copy to ensure it is free of sensitive content, in line with language habits, and culturally appropriate.
- Examples:
  - Example 1: Context - New product launch, Topic - Innovative technology, Language - English, Target Platform - Twitter
    Copy: "Discover the future with our groundbreaking tech! 🚀 #Innovation #TechRelease"
  - Example 2: Context - Advocating a healthy lifestyle, Topic - Healthy eating, Language - Chinese, Target Platform - Xiaohongshu
    Copy: "Healthy living starts with every bite. Are you eating healthily today? #HealthyEating #NutritionalBalance"
  - Example 3: Context - Corporate social responsibility, Topic - Environmental action, Language - Chinese, Target Platform - Weibo
    Copy: "A green Earth is our shared responsibility. Join our environmental action to make the world a better place! #EnvironmentalAction #GreenLiving"
- Initialization: In the first conversation, please directly output the following: Hello! I am your social media copywriting expert. Please tell me your context, topic, language, and target platform, and I will tailor-made attractive copy for you.

## CONTEXT
Context as following (with three "---" as separator, **only include the content between the separator, not include the separator**):
---
{context}
---

## REQUIREMENTS

TARGET PLATFORM: {targetPlatform}
TOPIC: {topic}
LANGUAGE: {language}
"""
`;

    const getContentListString = (contentList: IContent[]) => {
      let contentString = '';

      const cursorSelectionRelatedContent = contentList.filter((item) =>
        item?.metadata?.domain?.includes('Cursor'),
      );
      const otherContent = contentList.filter(
        (item) => !item?.metadata?.domain?.includes('Cursor'),
      );

      const cursorSelectionDomains = cursorSelectionRelatedContent.map(
        (item) => item?.metadata?.domain,
      );
      if (cursorSelectionDomains?.includes('documentBeforeCursorSelection')) {
        const documentBeforeCursorSelectionContent = cursorSelectionRelatedContent.find(
          (item) => item?.metadata?.domain === 'documentBeforeCursorSelection',
        );
        contentString += `---documentBeforeCursorSelection---
${documentBeforeCursorSelectionContent?.content}
`;
      }
      const cursorSelectionContent = cursorSelectionRelatedContent.find(
        (item) => item?.metadata?.domain === 'documentCursorSelection',
      );
      contentString += `---documentCursorSelection---
${cursorSelectionContent?.content}
`;

      if (cursorSelectionDomains?.includes('documentAfterCursorSelection')) {
        const documentAfterCursorSelectionContent = cursorSelectionRelatedContent.find(
          (item) => item?.metadata?.domain === 'documentAfterCursorSelection',
        );
        contentString += `---documentAfterCursorSelection---
${documentAfterCursorSelectionContent?.content}
`;
      }

      if (otherContent?.length > 0) {
        const otherContentString = otherContent.map((item) => item.content).join('\n');
        contentString += `---otherContent---
${otherContentString}
`;
      }

      return contentString;
    };

    const contextString = getContentListString(contentList as IContent[]);
    const { targetPlatform, topic, language } = (tplConfig || {}) as any as {
      targetPlatform: DynamicConfigValue;
      topic: DynamicConfigValue;
      language: DynamicConfigValue;
    };
    const prompt = systemPrompt
      .replace('{context}', contextString)
      .replace('{targetPlatform}', targetPlatform?.value as string)
      .replace('{topic}', topic?.value as string)
      .replace('{language}', language?.value as string);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      ...chatHistory,
      new HumanMessage(
        'The context and requirements are provided above, please write a social media post for the target platform',
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
