import { Document } from '@langchain/core/documents';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';

import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
// schema
import { z } from 'zod';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';
// utils
import { languageNameToLocale, localeToLanguageName, zhCNLocale } from '@refly/common-types';

interface GraphState extends BaseSkillState {
  documents: Document[];
  messages: BaseMessage[];
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

export class TranslateSkill extends BaseSkill {
  name = 'translate';
  displayName = {
    en: 'Translate',
    'zh-CN': '翻译',
  };

  icon: Icon = { type: 'emoji', value: '🔄' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'targetLanguage',
        inputMode: 'select',
        labelDict: {
          en: 'Target Language',
          'zh-CN': '目标语言',
        },
        descriptionDict: {
          en: 'The language to translate to',
          'zh-CN': '翻译的目标语言',
        },
        options: localeOptionList,
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Translate the content to the target language';

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

    const { locale = 'en', contentList = [], tplConfig = {} } = config?.configurable || {};
    const query = state.query || '';
    const targetLanguage = (tplConfig?.targetLanguage?.value || locale) as string;

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `You are a professional translator. Your task is to translate the given content into the specified target language. Ensure that the translation is accurate, natural, and maintains the original meaning and tone.

# INPUT
Content to translate (with three "---" as separator, **only need to translate the content between the separator, not include the separator**):
---
{context}
---

Target language: {targetLanguage}

User query (may be empty): {query}

# INSTRUCTIONS
1. Translate the content into the target language.
2. Maintain the original formatting and structure.
3. If there are any culturally specific terms or idioms, provide appropriate translations or explanations in parentheses.
4. Consider the user's query as additional instructions for the translation task.
5. Directly output the translated content without any additional comments or explanations.

# OUTPUT
Provide only the translated content without any additional comments or explanations.`;

    const contextString = contentList?.map((item) => item?.content).join('\n\n');
    const prompt = systemPrompt
      .replace('{context}', contextString)
      .replace('{targetLanguage}', targetLanguage)
      .replace('{query}', query);

    const responseMessage = await llm.invoke([new HumanMessage(prompt)]);

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
