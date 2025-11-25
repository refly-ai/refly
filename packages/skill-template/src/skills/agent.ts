import { START, END, StateGraphArgs, StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { Icon, SkillTemplateConfigDefinition, User } from '@refly/openapi-schema';

// types
import { GraphState } from '../scheduler/types';
// utils
import { buildFinalRequestMessages } from '../scheduler/utils/message';

// prompts
import { buildNodeAgentSystemPrompt } from '../prompts/node-agent';
import { buildUserPrompt } from '../prompts/user-prompt';
import { buildWorkflowCopilotPrompt } from '../prompts/copilot-agent';

import { AIMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import { type StructuredToolInterface } from '@langchain/core/tools';

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
  toolsAvailable: boolean;
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

  commonPreprocess = async (state: GraphState, config: SkillRunnableConfig) => {
    const { messages = [], images = [] } = state;
    const { preprocessResult, mode = 'node_agent' } = config.configurable;
    const { optimizedQuery, context, sources, usedChatHistory } = preprocessResult;

    const systemPrompt =
      mode === 'copilot_agent'
        ? buildWorkflowCopilotPrompt({
            installedToolsets: config.configurable.installedToolsets ?? [],
          })
        : buildNodeAgentSystemPrompt();

    const userPrompt = buildUserPrompt(optimizedQuery, context);

    const requestMessages = buildFinalRequestMessages({
      systemPrompt,
      userPrompt,
      chatHistory: usedChatHistory,
      messages,
      images,
      modelInfo: config?.configurable?.modelConfigMap.chat,
    });

    return { requestMessages, sources };
  };

  private async initializeAgentComponents(
    _user: User,
    config?: SkillRunnableConfig,
  ): Promise<AgentComponents> {
    const { selectedTools = [] } = config?.configurable ?? {};

    let actualToolNodeInstance: ToolNode<typeof MessagesAnnotation.State> | null = null;
    let availableToolsForNode: StructuredToolInterface[] = [];

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
        availableToolsForNode = validTools;
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
        return { messages: [response] };
      } catch (error) {
        this.engine.logger.error(`LLM node execution failed: ${error.stack}`);
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
      // Enhanced tool node with strict sequential execution of tool calls
      const enhancedToolNode = async (toolState: typeof MessagesAnnotation.State) => {
        try {
          this.engine.logger.log('Executing tool node with strict sequential tool calls');

          const priorMessages = toolState.messages ?? [];
          const lastMessage = priorMessages[priorMessages.length - 1] as AIMessage | undefined;
          const toolCalls = lastMessage?.tool_calls ?? [];

          if (!toolCalls || toolCalls.length === 0) {
            this.engine.logger.log('No tool calls to execute');
            return { messages: priorMessages };
          }

          const toolResultMessages: BaseMessage[] = [];

          // Execute each tool call strictly in sequence
          for (const call of toolCalls) {
            const toolName = call?.name ?? '';
            const toolArgs = (call?.args as Record<string, unknown>) ?? {};

            if (!toolName) {
              this.engine.logger.warn('Encountered a tool call with empty name, skipping');
              toolResultMessages.push(
                new ToolMessage({
                  content: 'Error: Tool name is missing',
                  tool_call_id: call?.id ?? '',
                  name: toolName || 'unknown_tool',
                }),
              );
              continue;
            }

            const matchedTool = (availableToolsForNode || []).find((t) => t?.name === toolName);

            if (!matchedTool) {
              this.engine.logger.warn(`Requested tool not found: ${toolName}`);
              toolResultMessages.push(
                new ToolMessage({
                  content: `Error: Tool '${toolName}' not available`,
                  tool_call_id: call?.id ?? '',
                  name: toolName,
                }),
              );
              continue;
            }

            try {
              // Log tool arguments before invocation
              this.engine.logger.log(
                `Invoking tool '${toolName}' with args:\n${JSON.stringify(toolArgs, null, 2)}`,
              );

              // Each invocation awaited to ensure strict serial execution
              const rawResult = await matchedTool.invoke(toolArgs);
              const stringified =
                typeof rawResult === 'string'
                  ? rawResult
                  : JSON.stringify(rawResult ?? {}, null, 2);

              toolResultMessages.push(
                new ToolMessage({
                  content: stringified ?? 'null',
                  tool_call_id: call?.id ?? '',
                  name: matchedTool.name,
                }),
              );

              this.engine.logger.log(`Tool '${toolName}' executed successfully`);
            } catch (toolError) {
              const errMsg =
                (toolError as Error)?.message ?? String(toolError ?? 'Unknown tool error');
              this.engine.logger.error(`Tool '${toolName}' execution failed: ${errMsg}`);
              toolResultMessages.push(
                new ToolMessage({
                  content: `Error executing tool '${toolName}': ${errMsg}`,
                  tool_call_id: call?.id ?? '',
                  name: matchedTool.name,
                }),
              );
            }
          }

          return { messages: [...priorMessages, ...toolResultMessages] };
        } catch (error) {
          this.engine.logger.error('Tool node execution failed:', error);
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
      toolsAvailable: selectedTools.length > 0,
    };

    return components;
  }

  agentNode = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill, user } = config.configurable;
    const { compiledLangGraphApp, toolsAvailable, tools } = await this.initializeAgentComponents(
      user,
      config,
    );

    const { requestMessages } = await this.commonPreprocess(state, config);

    config.metadata.step = { name: 'answerQuestion' };

    const result = await compiledLangGraphApp.invoke(
      { messages: requestMessages },
      {
        ...config,
        recursionLimit: 20,
        metadata: {
          ...config.metadata,
          ...currentSkill,
          toolsAvailable,
          toolCount: tools?.length || 0,
        },
      },
    );

    this.engine.logger.log(
      `Agent execution completed: ${JSON.stringify({
        messagesCount: result.messages?.length || 0,
        toolCallCount:
          result.messages?.filter((msg) => (msg as AIMessage).tool_calls?.length > 0).length || 0,
        toolsAvailable,
        toolCount: tools?.length || 0,
      })}`,
    );

    return { messages: result.messages };
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
