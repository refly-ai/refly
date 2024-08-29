import { Document } from '@langchain/core/documents';
import { WebPDFLoader } from '@langchain/community/document_loaders/web/pdf';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
// schema
import { z } from 'zod';
import { SkillInvocationConfig, SkillTemplateConfigSchema } from '@refly/openapi-schema';
import { TokenTextSplitter } from 'langchain/text_splitter';
import { loadSummarizationChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';
import isUrl from 'is-url';

interface GraphState extends BaseSkillState {
  documents: Document[];
  messages: BaseMessage[];
}

const READER_URL = 'https://r.jina.ai/';

// Define a new graph
/**
 *
 * @param url
 * @returns
 *
 * 1. 判断 url 是否是 arxiv 的 url（同样适用于其他网页）
 * 2. 判断是否在库里存在，不存在入库
 * 3. 判断需求是 summary、还是 common question，还是知识库独特的内容
 * 4. 根据需求，调用不同的工具
 * 5. 总结同时支持总结 + 追问，支持发 url 在主站使用，或者在插件里面感知使用
 */
async function fetchPDF(url) {
  const response = await fetch(url);
  const pdfBlob = await response.blob();
  return pdfBlob;
}

export class WebsiteSummarySkill extends BaseSkill {
  name = 'website_summary';
  displayName = {
    en: 'Website Summary',
    'zh-CN': '网站总结',
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

  description = 'Give a summary of the website content';

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

  async passThroughGenerate(state: GraphState, config?: SkillRunnableConfig) {
    this.engine.logger.log('---GENERATE---');

    const { query = '' } = state;
    const { locale = 'en', urls = [] } = config?.configurable || {};

    const url = query || urls[urls.length - 1];

    const llm = this.engine.chatModel({
      temperature: 0.1,
    });

    const systemPrompt = `Please directly notify user the url: **${url}** is not an arxiv url in ${locale} language`;
    const response = await llm.invoke([new SystemMessage(systemPrompt)]);

    return { messages: [new AIMessage(response)] };
  }

  // check whether the resource is already in the knowledge base
  async checkUrl(state: GraphState, config?: SkillRunnableConfig) {
    this.engine.logger.log('---GENERATE---');

    const { query = '' } = state;
    const { urls = [] } = config?.configurable || {};

    // check if the url is valid
    const url = query || urls[urls.length - 1];
    const isDetailUrl = url.includes('abs') || url.includes('pdf');
    if (!url || !url.startsWith('https://arxiv.org') || !isDetailUrl) {
      return 'passThroughGenerate';
    }

    return 'generate';
  }

  async generate(state: GraphState, config?: SkillRunnableConfig) {
    this.engine.logger.log('---GENERATE---');

    const { query = '' } = state;
    const { locale = 'en', contentList = [], resourceIds = [], noteIds = [], urls = [] } = config?.configurable || {};

    const url = query || urls[urls.length - 1];

    // check if the url is https://arxiv.org/abs/2406.18532 or pdf version: https://arxiv.org/pdf/2406.18532

    this.emitEvent({ event: 'log', content: '获取网页内容中' }, config);

    const response = await fetch(READER_URL + url, {
      method: 'GET',
      headers: {
        // Authorization: this.config.get('rag.jinaToken')
        //   ? `Bearer ${this.config.get('rag.jinaToken')}`
        //   : undefined,
        Accept: 'application/json',
      },
    });
    if (response.status !== 200) {
      this.emitEvent({ event: 'log', content: '获取网页内容失败' }, config);
      throw new Error(`call remote reader failed: ${response.status} ${response.statusText} ${response.text}`);
    }

    const data = (await response.json()) as { data: { title: string; content: string; url: string }; code: number };
    if (!data) {
      this.emitEvent({ event: 'log', content: '获取网页内容失败' }, config);
      throw new Error(`invalid data from remote reader: ${response.text}`);
    }

    this.emitEvent({ event: 'log', content: '获取 pdf 内容成功' }, config);

    // add to resource for knowledge qa
    if (data?.data?.content?.length > 0) {
      const { user } = config;

      // add to resource for knowledge qa
      try {
        this.emitEvent({ event: 'log', content: '保存到知识库中...' }, config);
        await this.engine.service.createResource(user, {
          resourceType: 'text',
          content: data?.data?.content,
          data: {
            url,
            title: data?.data?.title,
          },
          title: data?.data?.title,
        });
        this.emitEvent({ event: 'log', content: '保存到知识库成功' }, config);
      } catch (error) {
        this.emitEvent({ event: 'log', content: '保存到知识库失败' }, config);
        this.engine.logger.error('create resource failed', error);
      }
    }

    const llm = this.engine.chatModel({
      temperature: 0.5,
    });

    const mapPrompt = new PromptTemplate({
      template: `请用 ${locale} 语言简要总结以下文本的主要内容：
    
    {text}
    
    总结：`,
      inputVariables: ['text'],
    });
    const combinePrompt = new PromptTemplate({
      template: `You are a Comprehensive Webpage Summary Expert. Your task is to provide a detailed summary of the given webpage content.

Guidelines:
1. Summarize the main ideas and supporting details of the webpage.
2. Present core viewpoints in a list format with bold one-sentence summaries and explanations.
3. Ensure the summary is thorough yet concise and accessible.
4. Output the summary in the ${locale} language.
5. Keep technical terms and proper nouns in their original language.

Input text to summarize:
{text}

Please provide:
1. A comprehensive summary
2. A list of core viewpoints

Remember to use ${locale} for the summary and explanations, but keep technical terms and proper nouns in their original language.`,
      inputVariables: ['text'],
    });

    const model = this.engine.chatModel({ temperature: 0.1, maxTokens: 100 });

    const runnable = model.withStructuredOutput(
      z
        .object({
          summary: z.string(),
        })
        .describe(`Generate the summary based on these requirements and offer suggestions for the next steps.`),
    );

    const combineChain = new LLMChain({ llm, prompt: combinePrompt });

    this.emitEvent({ event: 'log', content: '语义处理 pdf 中...' }, config);
    const splitter = new TokenTextSplitter({
      chunkSize: 10000,
      chunkOverlap: 250,
    });
    const splittedDocs = await splitter.createDocuments([data?.data?.content]);

    this.emitEvent({ event: 'log', content: '总结中...' }, config);
    const intermediateResults = await Promise.all(
      splittedDocs.map(async (doc) => {
        const prompt = await mapPrompt.format({ text: doc.pageContent });
        const summaryModelRes = await runnable.invoke([new HumanMessage(prompt)]);
        return summaryModelRes?.summary || '';
      }),
    );
    const combinedText = intermediateResults.join('\n\n');

    // 执行 combine 步骤（流式输出）
    const summary = (await combineChain.stream({ text: combinedText })) as any as string;
    console.log('summary', summary);

    this.emitEvent({ event: 'log', content: '总结成功' }, config);

    return { messages: [new AIMessage({ content: summary })] };
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
