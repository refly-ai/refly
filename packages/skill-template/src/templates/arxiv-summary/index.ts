import { Document } from '@langchain/core/documents';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
// schema
import { z } from 'zod';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';
import { TokenTextSplitter } from 'langchain/text_splitter';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

interface GraphState extends BaseSkillState {
  documents: Document[];
  messages: BaseMessage[];
}

const READER_URL = 'https://r.jina.ai/';

export class ArxivSummarySkill extends BaseSkill {
  name = 'arxiv_summary';
  displayName = {
    en: 'Arxiv Summary',
    'zh-CN': 'Arxiv 总结',
  };

  icon: Icon = { type: 'emoji', value: '📚' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Give a summary of the arxiv content';

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
    const url = query || urls[urls.length - 1]?.url;
    const isDetailUrl = url.includes('abs') || url.includes('pdf');
    if (!url || !url.startsWith('https://arxiv.org') || !isDetailUrl) {
      return 'passThroughGenerate';
    }

    return 'generate';
  }

  async generate(state: GraphState, config?: SkillRunnableConfig) {
    this.engine.logger.log('---GENERATE---');

    const { query = '' } = state;
    const { locale = 'en', urls = [] } = config?.configurable || {};

    const url = query || urls[urls.length - 1]?.url;

    // check if the url is https://arxiv.org/abs/2406.18532 or pdf version: https://arxiv.org/pdf/2406.18532
    const pdfUrl = url.includes('abs') ? url.replace('abs', 'pdf') : url;

    this.emitEvent({ event: 'log', content: '获取 pdf 内容中' }, config);

    const response = await fetch(READER_URL + pdfUrl, {
      method: 'GET',
      headers: {
        // Authorization: this.config.get('rag.jinaToken')
        //   ? `Bearer ${this.config.get('rag.jinaToken')}`
        //   : undefined,
        Accept: 'application/json',
      },
    });
    if (response.status !== 200) {
      this.emitEvent({ event: 'log', content: '获取 pdf 内容失败' }, config);
      throw new Error(
        `call remote reader failed: ${response.status} ${response.statusText} ${response.text}`,
      );
    }

    const data = (await response.json()) as {
      data: { title: string; content: string; url: string };
      code: number;
    };
    if (!data) {
      this.emitEvent({ event: 'log', content: '获取 pdf 内容失败' }, config);
      throw new Error(`invalid data from remote reader: ${response.text}`);
    }

    this.emitEvent({ event: 'log', content: '获取 pdf 内容成功' }, config);
    // add to resource for knowledge qa
    if (data?.data?.content?.length > 0) {
      const { user } = config.configurable;
      const websiteUrl = url.includes('abs') ? url : url.replace('pdf', 'abs');

      // add to resource for knowledge qa
      try {
        this.emitEvent({ event: 'log', content: '保存到知识库中...' }, config);
        await this.engine.service.createResource(user, {
          resourceType: 'text',
          content: data?.data?.content,
          data: {
            url: websiteUrl,
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
      template: `You are an AI assistant specializing in summarizing academic papers for first-year university students. Your goal is to provide a clear, concise, and easy-to-understand summary of research papers. Please use the following format to provide a summary in ${locale} language:

# {text}

## Key Points

### Research Question
[What is the main problem or question the paper addresses?]

### Background
[Briefly explain the context and importance of this research]

### Methodology
[Describe the main methods or approaches used in simple terms]

### Key Findings
[What are the most important results or discoveries?]

### Significance
[Explain why these findings are important and their potential impact]

## Simplified Explanation
[Imagine you're explaining this paper to a first-year student. Use analogies or everyday examples to make complex concepts more accessible if possible.]

## Key Terms
[List and briefly define 3-5 important technical terms or concepts from the paper. Keep these terms in their original language.]

Guidelines:
- Summarize in ${locale} language, but keep technical terms, proper nouns, and paper titles in their original language.
- Explain complex ideas in simple terms, avoiding jargon whenever possible.
- If numerical results are mentioned, present them clearly and explain their significance.
- Keep the summary between 300-400 words to ensure readability.

Remember, the goal is to help a first-year student quickly grasp the core ideas and importance of the paper.

Input text:
"""
{text}
"""

Please provide a summary that meets the above requirements with ${locale} language, include summary title`,
      inputVariables: ['text'],
    });

    const model = this.engine.chatModel({ temperature: 0.1, maxTokens: 100 });

    const runnable = model.withStructuredOutput(
      z
        .object({
          summary: z.string(),
        })
        .describe(
          'Generate the summary based on these requirements and offer suggestions for the next steps.',
        ),
    );

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

    const combineChain = new LLMChain({ llm, prompt: combinePrompt });

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
