import {
  START,
  END,
  StateGraphArgs,
  StateGraph,
  MessagesAnnotation,
  // ToolNode, // Moved to prebuilt
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt'; // Correct import for ToolNode
import { z } from 'zod';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON, isValidUrl } from '@refly/utils';
import {
  Icon,
  ListMcpServersResponse,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Source,
  User,
} from '@refly/openapi-schema';
import { createSkillTemplateInventory } from '../inventory';
import { LangfuseListener } from '../langfuse-listener';
import { getTraceManager } from '@refly/observability';
import { createId } from '@paralleldrive/cuid2';

// types
import { GraphState } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { truncateSource } from '../scheduler/utils/truncator';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';
import { processQuery } from '../scheduler/utils/queryProcessor';
import { extractAndCrawlUrls, crawlExtractedUrls } from '../scheduler/utils/extract-weblink';

// prompts
import * as commonQnA from '../scheduler/module/commonQnA';
import { checkModelContextLenSupport } from '../scheduler/utils/model';
import { MultiServerMCPClient } from '../adapters';
import { buildSystemPrompt } from '../mcp/core/prompt';
import { convertMcpServersToClientConfig } from '../utils/mcp-utils';

import type { AIMessage, BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import type { StructuredToolInterface } from '@langchain/core/tools'; // For MCP Tools

interface CachedAgentComponents {
  mcpClient: MultiServerMCPClient | null;
  mcpTools: StructuredToolInterface[];
  llmModel: Runnable<BaseMessage[], AIMessage>;
  toolNodeInstance: ToolNode<typeof MessagesAnnotation.State> | null;
  compiledLangGraphApp: any;
  mcpAvailable: boolean;
  mcpServerNamesList: string[]; // Add mcpServerNamesList property
}

export class Agent extends BaseSkill {
  name = 'commonQnA';

  icon: Icon = { type: 'emoji', value: '💬' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Answer common questions';

  schema = z.object({
    query: z.string().optional().describe('The question to be answered'),
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  skills: BaseSkill[] = createSkillTemplateInventory(this.engine);
  private userAgentComponentsCache = new Map<string, CachedAgentComponents>();
  private langfuseListener: LangfuseListener | null = null;

  isValidSkillName = (name: string) => {
    return this.skills.some((skill) => skill.name === name);
  };

  commonPreprocess = async (
    state: GraphState,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
    customInstructions?: string,
  ) => {
    const { messages = [], images = [] } = state;
    const { locale = 'en', modelConfigMap, project, runtimeConfig } = config.configurable;

    config.metadata.step = { name: 'analyzeQuery' };

    const {
      optimizedQuery,
      query,
      usedChatHistory,
      hasContext,
      remainingTokens,
      mentionedContext,
      rewrittenQueries,
    } = await processQuery({
      config,
      ctxThis: this,
      state,
      shouldSkipAnalysis: true,
    });

    const projectId = project?.projectId;
    const enableKnowledgeBaseSearch = !!projectId && !!runtimeConfig?.enabledKnowledgeBase;
    this.engine.logger.log(
      `ProjectId: ${projectId}, Enable KB Search: ${enableKnowledgeBaseSearch}`,
    );

    const contextUrls = config.configurable?.urls || [];
    this.engine.logger.log(`Context URLs: ${safeStringifyJSON(contextUrls)}`);

    let contextUrlSources: Source[] = [];
    if (contextUrls.length > 0) {
      const urls = contextUrls.map((item) => item.url).filter((url) => url && isValidUrl(url));
      if (urls.length > 0) {
        this.engine.logger.log(`Processing ${urls.length} URLs from context`);
        contextUrlSources = await crawlExtractedUrls(urls, config, this, {
          concurrencyLimit: 5,
          batchSize: 8,
        });
        this.engine.logger.log(`Processed context URL sources count: ${contextUrlSources.length}`);
      }
    }

    const { sources: queryUrlSources, analysis } = await extractAndCrawlUrls(query, config, this, {
      concurrencyLimit: 5,
      batchSize: 8,
    });
    this.engine.logger.log(`URL extraction analysis: ${safeStringifyJSON(analysis)}`);
    this.engine.logger.log(`Extracted query URL sources count: ${queryUrlSources.length}`);

    const urlSources = [...contextUrlSources, ...queryUrlSources];
    this.engine.logger.log(`Total URL sources count: ${urlSources.length}`);

    let context = '';
    let sources: Source[] = [];
    const hasUrlSources = urlSources.length > 0;
    const needPrepareContext =
      (hasContext || hasUrlSources || enableKnowledgeBaseSearch) && remainingTokens > 0;
    const isModelContextLenSupport = checkModelContextLenSupport(modelConfigMap.chat);

    this.engine.logger.log(`optimizedQuery: ${optimizedQuery}`);
    this.engine.logger.log(`mentionedContext: ${safeStringifyJSON(mentionedContext)}`);
    this.engine.logger.log(`hasUrlSources: ${hasUrlSources}`);

    if (needPrepareContext) {
      config.metadata.step = { name: 'analyzeContext' };
      const preparedRes = await prepareContext(
        {
          query: optimizedQuery,
          mentionedContext,
          maxTokens: remainingTokens,
          enableMentionedContext: hasContext,
          rewrittenQueries,
          urlSources,
        },
        {
          config,
          ctxThis: this,
          state,
          tplConfig: {
            ...(config?.configurable?.tplConfig || {}),
            enableKnowledgeBaseSearch: {
              value: enableKnowledgeBaseSearch,
              label: 'Knowledge Base Search',
              displayValue: enableKnowledgeBaseSearch ? 'true' : 'false',
            },
          },
        },
      );
      context = preparedRes.contextStr;
      sources = preparedRes.sources;
      this.engine.logger.log(`context: ${safeStringifyJSON(context)}`);
      this.engine.logger.log(`sources: ${safeStringifyJSON(sources)}`);
    }

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext: needPrepareContext && isModelContextLenSupport,
      context,
      images,
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
      modelInfo: config?.configurable?.modelConfigMap.chat,
      customInstructions,
    });

    return { requestMessages, sources };
  };

  private async getOrInitializeAgentComponents(
    user: User,
    selectedMcpServers: string[] = [],
  ): Promise<CachedAgentComponents> {
    const userId = user?.uid ?? user?.email ?? JSON.stringify(user);

    this.engine.logger.log(`Initializing new agent components for user ${userId}`);

    let mcpClientToCache: MultiServerMCPClient | null = null;
    let actualMcpTools: StructuredToolInterface[] = []; // Use StructuredToolInterface
    let actualToolNodeInstance: ToolNode<typeof MessagesAnnotation.State> | null = null;
    let mcpSuccessfullyInitializedAndToolsAvailable = false;

    try {
      // Attempt to initialize MCP components
      const mcpServerList = await this.engine.service
        .listMcpServers(user, {
          enabled: true,
        })
        .then((data) => data?.data?.filter((item) => selectedMcpServers?.includes?.(item.name)))
        .catch(() => [] as ListMcpServersResponse['data']);

      const cachedAgentComponents = this.userAgentComponentsCache.get(userId);
      const currentMcpServerNames = (mcpServerList?.map((server) => server.name) ?? []).sort();

      if (cachedAgentComponents) {
        const cachedMcpServerNames = cachedAgentComponents.mcpServerNamesList;

        if (JSON.stringify(currentMcpServerNames) === JSON.stringify(cachedMcpServerNames)) {
          this.engine.logger.log(
            `Using cached agent components for user ${userId} as MCP server list is unchanged.`,
          );
          return cachedAgentComponents;
        } else {
          this.engine.logger.warn(
            `MCP server list changed for user ${userId}. Cached: ${JSON.stringify(
              cachedMcpServerNames ?? [],
            )}, Current: ${JSON.stringify(currentMcpServerNames)}. Re-initializing components.`,
          );
        }
      }

      await this.dispose(userId);

      if (!mcpServerList || mcpServerList.length === 0) {
        this.engine.logger.warn(
          `No MCP servers found for user ${userId}. Proceeding without MCP tools.`,
        );
      } else {
        let tempMcpClient: MultiServerMCPClient;

        try {
          // Pass mcpServersResponse (which is ListMcpServersResponse) to convertMcpServersToClientConfig
          const mcpClientConfig = convertMcpServersToClientConfig({ data: mcpServerList });
          tempMcpClient = new MultiServerMCPClient(mcpClientConfig);

          await tempMcpClient.initializeConnections();
          this.engine.logger.log('MCP connections initialized successfully for new components');

          const toolsFromMcp = (await tempMcpClient.getTools()) as StructuredToolInterface[]; // Cast or ensure getTools returns this type
          if (!toolsFromMcp || toolsFromMcp.length === 0) {
            this.engine.logger.warn(
              `No MCP tools found for user ${userId} after initializing client. Proceeding without MCP tools.`,
            );
            await tempMcpClient
              .close()
              .catch((closeError) =>
                this.engine.logger.error(
                  'Error closing MCP client when no tools found after connection:',
                  closeError,
                ),
              );
          } else {
            this.engine.logger.log(
              `Loaded ${toolsFromMcp.length} MCP tools for new components: ${toolsFromMcp
                .map((tool) => tool.name)
                .join(', ')}`,
            );
            actualMcpTools = toolsFromMcp;
            mcpClientToCache = tempMcpClient;
            mcpSuccessfullyInitializedAndToolsAvailable = true;
          }
        } catch (mcpError) {
          this.engine.logger.error(
            'Error during MCP client operation (initializeConnections or getTools):',
            mcpError,
          );
          await tempMcpClient
            .close()
            .catch((closeError) =>
              this.engine.logger.error(
                'Error closing MCP client after operation failure:',
                closeError,
              ),
            );
          await this.dispose(userId);
        }
      }

      // LLM and LangGraph Setup
      const baseLlm = this.engine.chatModel({ temperature: 0.1 });
      let llmForGraph: Runnable<BaseMessage[], AIMessage>;

      if (mcpSuccessfullyInitializedAndToolsAvailable && actualMcpTools.length > 0) {
        llmForGraph = baseLlm.bindTools(actualMcpTools, { strict: true } as never);
        actualToolNodeInstance = new ToolNode(actualMcpTools);
      } else {
        llmForGraph = baseLlm;
      }

      const llmNodeForCachedGraph = async (nodeState: typeof MessagesAnnotation.State) => {
        // Use llmForGraph, which is the (potentially tool-bound) LLM instance for the graph
        const response = await llmForGraph.invoke(nodeState.messages);
        return { messages: [response as AIMessage] }; // Ensure response is treated as AIMessage
      };

      // Initialize StateGraph with explicit generic arguments for State and all possible Node names
      // @ts-ignore - Suppressing persistent type error with StateGraph constructor and generics
      let workflow = new StateGraph(
        MessagesAnnotation, // This provides the schema and channel definitions
      );

      // Build the graph step-by-step, using 'as typeof workflow' to maintain the broad type.
      // @ts-ignore - Suppressing persistent type error with addNode and runnable type mismatch
      workflow = workflow.addNode('llm', llmNodeForCachedGraph);
      // @ts-ignore - Suppressing persistent type error with addEdge and node name mismatch
      workflow = workflow.addEdge(START, 'llm');

      if (mcpSuccessfullyInitializedAndToolsAvailable && actualToolNodeInstance) {
        // @ts-ignore - Suppressing persistent type error with addNode and runnable type mismatch
        workflow = workflow.addNode('tools', actualToolNodeInstance);
        // @ts-ignore - Suppressing persistent type error with addEdge and node name mismatch
        workflow = workflow.addEdge('tools', 'llm'); // Output of tools goes back to LLM

        // addConditionalEdges does not return the graph instance, so no 'as typeof workflow' needed here
        // if the 'workflow' variable already has the correct comprehensive type.
        // @ts-ignore - Suppressing persistent type error with addConditionalEdges and node name mismatch
        workflow.addConditionalEdges('llm', (graphState: typeof MessagesAnnotation.State) => {
          const lastMessage = graphState.messages[graphState.messages.length - 1] as AIMessage;
          if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            this.engine.logger.log(
              'Tool calls detected (MCP tools available), routing to tools node',
            );
            return 'tools';
          }
          this.engine.logger.log('No tool calls (MCP tools available), routing to END');
          return END;
        });
      } else {
        this.engine.logger.log(
          'No MCP tools initialized or available. LLM output will directly go to END.',
        );
        // @ts-ignore - Suppressing persistent type error with addEdge and node name mismatch
        workflow = workflow.addEdge('llm', END);
      }

      // Compile the graph
      const compiledGraph = workflow.compile();

      const components: CachedAgentComponents = {
        mcpClient: mcpClientToCache,
        mcpTools: actualMcpTools, // Store the successfully initialized tools
        llmModel: llmForGraph, // Store the potentially tool-bound LLM
        toolNodeInstance: actualToolNodeInstance,
        compiledLangGraphApp: compiledGraph, // Store the compiled graph
        mcpAvailable: mcpSuccessfullyInitializedAndToolsAvailable,
        mcpServerNamesList: currentMcpServerNames,
      };

      // disable userAgentComponentsCache
      // this.userAgentComponentsCache.set(userId, components);

      this.engine.logger.log(`Agent components initialized and cached for user ${userId}`);
      return components;
    } catch (error) {
      this.engine.logger.error('Critical error during new agent components initialization:', error);
      if (mcpClientToCache) {
        await mcpClientToCache
          .close()
          .catch((closeError) =>
            this.engine.logger.error(
              'Error closing successfully initialized MCP client during overall setup failure:',
              closeError,
            ),
          );
      }
      if (error instanceof Error && error.stack) {
        this.engine.logger.error('Error stack for new components initialization:', error.stack);
      }
      await this.dispose(userId);
      throw new Error('Failed to initialize agent components');
    }
  }

  agentNode = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill, user, selectedMcpServers = [], emitter } = config.configurable;

    // Initialize trace manager and create trace for this request
    const traceManager = getTraceManager();
    const traceId = createId();
    const rootSpanId = createId();
    
    // Create trace for the entire skill execution
    if (traceManager) {
      traceManager.createTrace(
        traceId,
        `${this.name} - Question Answering`,
        {
          skillName: this.name,
          userId: user?.uid ?? user?.email ?? 'anonymous',
          metadata: {
            messages: state.messages,
            selectedMcpServers,
            customInstructions: (config.configurable?.project as any)?.customInstructions,
            model: (config.configurable as any)?.modelInfo?.model,
            type: 'skill_execution',
            mcpServers: selectedMcpServers,
          },
        },
      );

      // Create root span for request processing
      traceManager.createSpan(traceId, rootSpanId, {
        name: 'Request Processing',
        input: state.messages,
        metadata: {
          step: 'agent_node_execution',
        },
      });
    }

    // Initialize Langfuse listener if not already done and emitter is available
    if (!this.langfuseListener && emitter) {
      this.langfuseListener = new LangfuseListener({
        enabled: true,
        excludeEvents: ['stream'], // Exclude noisy stream events by default
      });
      this.langfuseListener.attachToEmitter(emitter);
    }

    const project = config.configurable?.project as
      | { projectId: string; customInstructions?: string }
      | undefined;
    const customInstructions = project?.projectId ? project?.customInstructions : undefined;

    try {
      console.log('\n=== GETTING OR INITIALIZING CACHED LANGGRAPH AGENT FLOW ===');
      const { compiledLangGraphApp, mcpAvailable } = await this.getOrInitializeAgentComponents(
        user,
        selectedMcpServers,
      );

      const module: SkillPromptModule = {
        buildSystemPrompt: mcpAvailable
          ? () =>
              buildSystemPrompt(
                'You are an advanced AI assistant with specialized expertise in leveraging the Model Context Protocol (MCP) to solve complex problems efficiently. Your intelligence manifests through precise tool orchestration, context-aware execution, and proactive optimization of MCP server capabilities. ' +
                  'When a tool call is made, you will receive a ToolMessage with the result. ' +
                  'If an MCP server call fails or returns malformed data, the ToolMessage will contain the error details. ' +
                  'You MUST carefully analyze this error message. ' +
                  'If the error indicates incorrect arguments (e.g., missing parameters, invalid values, type mismatches), you MUST revise the arguments and attempt the tool call again. Do NOT repeat the previous mistake. ' +
                  'If the error seems to be a transient issue (e.g., network error, temporary unavailability), you should retry the call, perhaps after a brief conceptual pause. ' +
                  "You must continuously retry and adapt your approach to achieve the user's expected outcome. Never abandon the operation prematurely. " +
                  'After several (e.g., 3-5) persistent failures for the same tool call despite your best efforts to correct it, and if no alternative tools or approaches are viable, you may then inform the user about the specific difficulty encountered and suggest a different course of action or ask for clarification.',
              )
          : commonQnA.buildCommonQnASystemPrompt,
        buildContextUserPrompt: commonQnA.buildCommonQnAContextUserPrompt,
        buildUserPrompt: commonQnA.buildCommonQnAUserPrompt,
      };

      const { requestMessages, sources } = await this.commonPreprocess(
        state,
        config,
        module,
        customInstructions,
      );

      config.metadata.step = { name: 'answerQuestion' };

      if (sources.length > 0) {
        const truncatedSources = truncateSource(sources);
        await this.emitLargeDataEvent(
          {
            data: truncatedSources,
            buildEventData: (chunk, { isPartial, chunkIndex, totalChunks }) => ({
              structuredData: {
                sources: chunk,
                isPartial,
                chunkIndex,
                totalChunks,
              },
            }),
          },
          config,
        );
      }

      // Create span for LangGraph execution
      const langGraphSpanId = createId();
      if (traceManager) {
        traceManager.createSpan(traceId, langGraphSpanId, {
          name: 'LangGraph Execution',
          input: { messages: requestMessages },
          metadata: {
            mcpAvailable,
            recursionLimit: 50,
            step: 'langgraph_invoke',
          },
        });
      }

      const result = await compiledLangGraphApp.invoke(
        { messages: requestMessages },
        {
          ...config,
          recursionLimit: 50,
          metadata: {
            ...config.metadata,
            ...currentSkill,
            traceId, // Pass trace ID to child operations
          },
        },
      );

      // Update spans with success results
      if (traceManager) {
        traceManager.endSpan(langGraphSpanId, {
          output: result.messages,
          success: true,
        });
        
        traceManager.endSpan(rootSpanId, {
          output: result.messages,
          success: true,
        });

        traceManager.endTrace(traceId, result.messages);
      }

      return { messages: result.messages };
    } catch (error) {
      // Update spans and trace with error information
      if (traceManager) {
        traceManager.endSpan(rootSpanId, {
          error: error?.message || error,
          success: false,
        }, error?.message, 'ERROR');

        traceManager.endTrace(traceId, { error: error?.message || error });
      }
      
      this.engine.logger.error('Error in agentNode execution:', error);
      throw error;
    } finally {
      this.engine.logger.log('agentNode execution finished.');
      this.dispose();
    }
  };

  toRunnable() {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('agent', this.agentNode)
      .addEdge(START, 'agent')
      .addEdge('agent', END);

    return workflow.compile();
  }

  public async dispose(_userId?: string): Promise<void> {
    if (_userId) {
      const components = this.userAgentComponentsCache.get(_userId);

      await components?.mcpClient?.close?.();

      this.userAgentComponentsCache.delete(_userId);
      return;
    }

    this.engine.logger.log(`Disposing Agent (${this.name}) and closing all cached MCP clients...`);
    for (const [userId, components] of this.userAgentComponentsCache) {
      try {
        await components.mcpClient?.close?.();
        this.engine.logger.log(`Closed MCP client for user ${userId}`);
      } catch (e) {
        this.engine.logger.error(`Error closing MCP client for user ${userId} during dispose:`, e);
      }
    }
    this.userAgentComponentsCache.clear();

    // Clean up Langfuse listener
    if (this.langfuseListener) {
      this.langfuseListener.detach();
      this.langfuseListener = null;
    }

    this.engine.logger.log(`Agent (${this.name}) disposed, cache cleared.`);
  }
}
