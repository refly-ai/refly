import { z } from 'zod';
import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
import { ReflySearch } from '../../tools/refly-search';
import {
  SearchResponse,
  Source,
  SkillInvocationConfig,
  SkillTemplateConfigSchema,
  SearchDomain,
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

  configSchema: SkillTemplateConfigSchema = {
    items: [
      {
        key: 'domains',
        label: 'Domains',
        inputMode: 'multiSelect',
        options: [
          {
            label: 'Resource',
            value: 'resource',
          },
          {
            label: 'Note',
            value: 'note',
          },
        ],
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {
    input: {
      rules: [{ key: 'query' }],
    },
    context: {
      rules: [
        { key: 'resourceIds', limit: 1 },
        { key: 'noteIds', limit: 1 },
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
  retrieve = async (state: GraphState, config: SkillRunnableConfig) => {
    const { user } = config;

    const { resources, notes, contentList, tplConfig = {} } = config?.configurable || {};

    let content = '';

    if (resources?.length > 0) {
      content = resources[0].content;
    } else if (notes?.length > 0) {
      content = notes[0].content;
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

    // TODO: implement given resourceIds and collectionIds q&a @mrcfps

    const tool = new ReflySearch({
      engine: this.engine,
      user,
      domains: tplConfig.domains as SearchDomain[],
      mode: 'vector',
    });
    const output = await tool.invoke(content, config);
    const searchResp = JSON.parse(output) as SearchResponse;

    if (!searchResp.success || searchResp.errMsg) {
      throw new Error(`Search failed: ${searchResp.errMsg}`);
    }

    const sources: Source[] = searchResp.data?.map((result) => ({
      url: result.metadata?.resourceMeta?.url,
      title: result.title,
      pageContent: result.content?.join('\n'),
      metadata: {
        resourceId: result.id,
        resourceName: result.title,
        collectionId: result.metadata?.collectionId,
      },
    }));

    this.emitEvent(
      {
        event: 'structured_data',
        content: JSON.stringify(sources),
        structuredDataKey: 'sources',
      },
      config,
    );

    return { sources };
  };

  /**
   * Generate answer
   * @param state - The current state of the agent, including all messages.
   * @param config - The configuration for the runnable.
   * @returns The updated state with the new message added to the list of messages.
   */
  generate = async (state: GraphState, config?: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    const { sources } = state;
    const { locale = 'en', chatHistory = [] } = config?.configurable || {};

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
