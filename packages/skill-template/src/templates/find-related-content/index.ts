import { z } from 'zod';
import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
import { ReflySearch } from '../../tools/refly-search';
import { truncateSource } from '../../scheduler/utils/truncator';
import {
  SearchResponse,
  Source,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  SearchDomain,
  Icon,
} from '@refly/openapi-schema';

interface GraphState extends BaseSkillState {
  messages: BaseMessage[];
  /**
   * Retrieved sources from the knowledge base.
   */
  sources: Source[];
}

export class FindRelatedContent extends BaseSkill {
  name = 'find_related_content';

  displayName = {
    en: 'Find Related Content',
    'zh-CN': '查找相关内容',
  };

  icon: Icon = { type: 'emoji', value: '🔍' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'domains',
        inputMode: 'multiSelect',
        labelDict: {
          en: 'Search Domains',
          'zh-CN': '搜索范围',
        },
        descriptionDict: {
          en: 'The domains to search related content',
          'zh-CN': '搜索相关内容的范围',
        },
        required: {
          value: true,
          configScope: ['runtime'],
        },
        defaultValue: ['resource'],
        options: [
          {
            value: 'resource',
            labelDict: {
              en: 'Resource',
              'zh-CN': '资源',
            },
          },
          {
            value: 'document',
            labelDict: {
              en: 'Document',
              'zh-CN': '文档',
            },
          },
        ],
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [
        { key: 'resources', limit: 1 },
        { key: 'documents', limit: 1 },
        { key: 'contentList', limit: 1 },
      ],
      relation: 'mutuallyExclusive',
    },
  };

  description = 'Find related content from the knowledge base.';

  schema = z.object({
    query: z.string().describe('The search query'),
  });

  graphState: StateGraphArgs<GraphState>['channels'] = {
    ...baseStateGraphArgs,
    messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    },
    sources: {
      reducer: (left?: Source[], right?: Source[]) => (right ? right : left || []) as Source[],
      default: () => [],
    },
  };

  /**
   * Retrieve relevant sources from the knowledge base.
   * @param state - The current state of the agent, including all messages.
   * @param config - The configuration for the runnable.
   * @returns - The updated state with the new message added to the list of messages.
   */
  retrieve = async (_state: GraphState, config: SkillRunnableConfig) => {
    const { user } = config.configurable;

    const {
      resources,
      documents: contextDocuments,
      contentList,
      tplConfig = {},
    } = config?.configurable || {};

    let content = '';

    if (resources?.length > 0) {
      content = resources[0].resource?.content;
    } else if (contextDocuments?.length > 0) {
      content = contextDocuments[0].document?.content;
    } else if (contentList?.length > 0) {
      content = contentList.join('\n\n');
    }

    this.emitEvent(
      {
        event: 'log',
        content: `Start retrieving with selected content: ${content?.slice(0, 40)}`,
      },
      config,
    );

    const tool = new ReflySearch({
      engine: this.engine,
      user,
      domains: tplConfig.domains.value as SearchDomain[],
      mode: 'vector',
    });
    const output = await tool.invoke(content, config);
    const searchResp = JSON.parse(output) as SearchResponse;

    if (!searchResp.success || searchResp.errMsg) {
      throw new Error(`Search failed: ${searchResp.errMsg}`);
    }

    const sources: Source[] = searchResp.data?.map((result) => ({
      url: ((result.metadata?.resourceMeta as any)?.url as string) || '',
      title: result.title,
      pageContent: result.snippets.map((s) => s.text).join('\n\n'),
      metadata: {
        entityId: result.id,
        entityType: 'resource',
        title: result.title,
      },
    }));

    if (sources.length > 0) {
      this.emitEvent({ structuredData: { sources: truncateSource(sources) } }, config);
    }

    return { sources };
  };

  /**
   * Generate answer
   * @param state - The current state of the agent, including all messages.
   * @param config - The configuration for the runnable.
   * @returns The updated state with the new message added to the list of messages.
   */
  generate = async (
    state: GraphState,
    config?: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { sources } = state;
    const { locale = 'en' } = config?.configurable || {};

    const llm = this.engine.chatModel({
      temperature: 0.1,
    });

    const systemPrompt = `Found ${sources.length} related resources. Please directly notify user the number of resources in ${locale} language`;
    const response = await llm.invoke([new SystemMessage(systemPrompt)]);

    return { messages: [new AIMessage(response)] };
  };

  toRunnable(): Runnable<any, any, RunnableConfig> {
    // Define a new graph
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('retrieve', this.retrieve)
      .addNode('generate', this.generate)
      .addEdge(START, 'retrieve')
      .addEdge('retrieve', 'generate')
      .addEdge('generate', END);

    return workflow.compile();
  }
}
