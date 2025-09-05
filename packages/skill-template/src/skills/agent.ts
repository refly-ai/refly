import { START, END, StateGraphArgs, StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { Icon, SkillTemplateConfigDefinition, User } from '@refly/openapi-schema';

// types
import { GraphState } from '../scheduler/types';
// utils
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';

// prompts
import * as commonQnA from '../scheduler/module/commonQnA';
import { buildSystemPrompt } from '../mcp/core/prompt';
import { MCPTool, MCPToolInputSchema } from '../mcp/core/prompt';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import { type StructuredToolInterface } from '@langchain/core/tools'; // For MCP Tools

/**
 * Converts LangChain StructuredToolInterface array to MCPTool array.
 * This is used to prepare tools for the system prompt, matching the MCPTool interface.
 */
function convertToMCPTools(langchainTools: StructuredToolInterface[]): MCPTool[] {
  return langchainTools.map((tool) => {
    // tool.schema is expected to be a Zod schema object
    const zodSchema = tool.schema;
    // Convert Zod schema to JSON schema.
    // The `as any` is used because zodToJsonSchema returns a generic JSONSchema7Type,
    // and we need to access properties like title, description, etc., which might not be strictly typed.
    const jsonSchema = zodToJsonSchema(zodSchema as any) as any;

    const properties = (jsonSchema?.properties ?? {}) as Record<string, object>;
    const propertyKeys = Object.keys(properties);

    const inputSchema: MCPToolInputSchema = {
      type: jsonSchema.type || 'object',
      title: jsonSchema.title || tool.name,
      description: jsonSchema.description || tool.description || '',
      properties,
      // Azure OpenAI requires `required` to list every key in properties when present
      required: propertyKeys,
    };

    return {
      id: tool.name,
      serverId: '',
      serverName: '',
      name: tool.name,
      description: tool.description || '',
      inputSchema,
    };
  });
}

// Define a more specific type for the compiled graph
type CompiledGraphApp = {
  invoke: (
    input: { messages: BaseMessage[] },
    config?: any,
  ) => Promise<{ messages: BaseMessage[] }>;
};

interface AgentComponents {
  tools: StructuredToolInterface[];
  compiledLangGraphApp: CompiledGraphApp;
  mcpAvailable: boolean;
}

export class Agent extends BaseSkill {
  name = 'commonQnA';

  icon: Icon = { type: 'emoji', value: '💬' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  description = 'Answer common questions';

  schema = z.object({
    query: z.string().optional().describe('The question to be answered'),
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  commonPreprocess = async (
    state: GraphState,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
    customInstructions?: string,
  ) => {
    const { query, messages = [], images = [] } = state;
    const { locale = 'auto', preprocessResult } = config.configurable;
    const { optimizedQuery, rewrittenQueries, context, sources, usedChatHistory } =
      preprocessResult;

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
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

  private async initializeAgentComponents(
    user: User,
    config?: SkillRunnableConfig,
  ): Promise<AgentComponents> {
    const userId = user?.uid ?? user?.email ?? JSON.stringify(user);
    const { selectedTools = [] } = config?.configurable ?? {};

    this.engine.logger.log(`Initializing new agent components for user ${userId}`);
    let actualToolNodeInstance: ToolNode<typeof MessagesAnnotation.State> | null = null;

    // LLM and LangGraph Setup
    const baseLlm = this.engine.chatModel({ temperature: 0.1 });
    let llmForGraph: Runnable<BaseMessage[], AIMessage>;

    if (selectedTools.length > 0) {
      // Ensure tool definitions are valid before binding
      const validTools = selectedTools.filter(
        (tool) => tool.name && tool.description && tool.schema,
      );

      if (validTools.length > 0) {
        this.engine.logger.log(
          `Binding ${validTools.length} valid tools to LLM with tool_choice="auto"`,
        );
        // Use tool_choice="auto" to force LLM to decide when to use tools
        // This ensures proper tool_calls format generation
        llmForGraph = baseLlm.bindTools(validTools, { tool_choice: 'auto' });
        actualToolNodeInstance = new ToolNode(validTools);
      } else {
        this.engine.logger.warn('No valid tools found, using base LLM without tools');
        llmForGraph = baseLlm;
      }
    } else {
      this.engine.logger.log('No tools selected, using base LLM without tools');
      llmForGraph = baseLlm;
    }

    const llmNodeForCachedGraph = async (nodeState: typeof MessagesAnnotation.State) => {
      try {
        // Use llmForGraph, which is the (potentially tool-bound) LLM instance for the graph
        const response = await llmForGraph.invoke(nodeState.messages);

        this.engine.logger.log('LLM response received:', {
          hasToolCalls: !!response.tool_calls,
          toolCallsCount: response.tool_calls?.length || 0,
          toolCalls: response.tool_calls,
          content:
            typeof response.content === 'string'
              ? response.content.substring(0, 100)
              : 'Non-string content',
        });

        return { messages: [response] };
      } catch (error) {
        this.engine.logger.error('LLM node execution failed:', error);
        throw error;
      }
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

    if (actualToolNodeInstance) {
      // Enhanced tool node with better error handling and logging
      const enhancedToolNode = async (toolState: typeof MessagesAnnotation.State) => {
        try {
          this.engine.logger.log('Executing tool node with enhanced error handling');

          const result = await actualToolNodeInstance.invoke(toolState);

          // Check tool execution results
          const lastToolMessage = result.messages[result.messages.length - 1];
          if (lastToolMessage && typeof lastToolMessage.content === 'string') {
            const toolResult = lastToolMessage.content;

            // Log tool execution results
            if (toolResult.includes('error') || toolResult.includes('failed')) {
              this.engine.logger.warn('Tool execution failed:', toolResult);
            } else {
              this.engine.logger.log('Tool execution successful');
            }
          }

          return result;
        } catch (error) {
          this.engine.logger.error('Tool execution failed:', error);
          throw error;
        }
      };

      // @ts-ignore - Suppressing persistent type error with addNode and runnable type mismatch
      workflow = workflow.addNode('tools', enhancedToolNode);
      // @ts-ignore - Suppressing persistent type error with addEdge and node name mismatch
      workflow = workflow.addEdge('tools', 'llm'); // Output of tools goes back to LLM

      // addConditionalEdges does not return the graph instance, so no 'as typeof workflow' needed here
      // if the 'workflow' variable already has the correct comprehensive type.
      // @ts-ignore - Suppressing persistent type error with addConditionalEdges and node name mismatch
      workflow.addConditionalEdges('llm', (graphState: typeof MessagesAnnotation.State) => {
        const lastMessage = graphState.messages[graphState.messages.length - 1] as AIMessage;

        if (lastMessage?.tool_calls && lastMessage?.tool_calls?.length > 0) {
          this.engine.logger.log(
            `Tool calls detected (${lastMessage.tool_calls.length} calls), routing to tools node`,
            { toolCalls: lastMessage.tool_calls },
          );
          return 'tools';
        }

        this.engine.logger.log('No tool calls detected, routing to END');
        return END;
      });
    } else {
      this.engine.logger.log(
        'No tools initialized or available. LLM output will directly go to END.',
      );
      // @ts-ignore - Suppressing persistent type error with addEdge and node name mismatch
      workflow = workflow.addEdge('llm', END);
    }

    // Compile the graph
    const compiledGraph = workflow.compile();

    const components: AgentComponents = {
      tools: selectedTools, // Store the successfully initialized tools
      compiledLangGraphApp: compiledGraph, // Store the compiled graph
      mcpAvailable: selectedTools.length > 0,
    };

    this.engine.logger.log(`Agent components initialized and cached for user ${userId}`);
    return components;
  }

  agentNode = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill, user } = config.configurable;
    const { locale = 'auto' } = config.configurable;

    const project = config.configurable?.project as
      | { projectId: string; customInstructions?: string }
      | undefined;
    const customInstructions = project?.projectId ? project?.customInstructions : undefined;

    const {
      compiledLangGraphApp,
      mcpAvailable,
      tools: mcpTools,
    } = await this.initializeAgentComponents(user, config);

    const module: SkillPromptModule = {
      buildSystemPrompt: mcpAvailable
        ? () => {
            return buildSystemPrompt(
              convertToMCPTools(mcpTools), // Use the conversion function, mcpServerList removed
              locale,
            );
          }
        : commonQnA.buildCommonQnASystemPrompt,
      buildContextUserPrompt: commonQnA.buildCommonQnAContextUserPrompt,
      buildUserPrompt: commonQnA.buildCommonQnAUserPrompt,
    };

    const { requestMessages } = await this.commonPreprocess(
      state,
      config,
      module,
      customInstructions,
    );

    config.metadata.step = { name: 'answerQuestion' };

    try {
      this.engine.logger.log('Starting agent execution with messages:', requestMessages.length);

      const result = await compiledLangGraphApp.invoke(
        { messages: requestMessages },
        {
          ...config,
          recursionLimit: 20,
          metadata: {
            ...config.metadata,
            ...currentSkill,
            mcpAvailable,
            toolCount: mcpTools?.length || 0,
          },
        },
      );

      this.engine.logger.log('Agent execution completed:', {
        messagesCount: result.messages?.length || 0,
        toolCallCount:
          result.messages?.filter((msg) => (msg as AIMessage).tool_calls?.length > 0).length || 0,
        mcpAvailable,
        toolCount: mcpTools?.length || 0,
      });

      return { messages: result.messages };
    } catch (error) {
      this.engine.logger.error('Agent execution failed:', error);

      const errorMessage = new AIMessage(`
I encountered technical difficulties while processing your request. Here's what happened:

**Error Details**: ${error.message}

**Next Steps**:
1. Try rephrasing your request in simpler terms
2. Break down complex tasks into smaller steps
3. Try again - this might be a temporary issue
4. Provide more context about what you're trying to achieve

I'll do my best to help you find a solution!
      `);

      return { messages: [errorMessage] };
    } finally {
      this.engine.logger.log('Agent execution finished.');
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
}
