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
import { ITool, ToolInputSchema } from '../tool';
import { buildSystemPrompt } from '../prompts/node-agent';
import { buildWorkflowCopilotPrompt } from '../prompts/copilot-agent';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { AIMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import { type StructuredToolInterface } from '@langchain/core/tools';

/**
 * Converts LangChain StructuredToolInterface array to ITool array.
 * This is used to prepare tools for the system prompt, matching the ITool interface.
 */
function convertToTools(langchainTools: StructuredToolInterface[]): ITool[] {
  return langchainTools.map((tool) => {
    // tool.schema is expected to be a Zod schema object
    const zodSchema = tool.schema;
    // Convert Zod schema to JSON schema.
    // The `as any` is used because zodToJsonSchema returns a generic JSONSchema7Type,
    // and we need to access properties like title, description, etc., which might not be strictly typed.
    const jsonSchema = zodToJsonSchema(zodSchema as any) as any;

    const properties = (jsonSchema?.properties ?? {}) as Record<string, object>;
    const propertyKeys = Object.keys(properties);

    const inputSchema: ToolInputSchema = {
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
              this.engine.logger.log(`Invoking tool '${toolName}' with args:`, {
                toolName,
                args: toolArgs,
                argsJson: JSON.stringify(toolArgs, null, 2),
              });

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
    const { locale = 'auto', mode = 'node_agent' } = config.configurable;

    const project = config.configurable?.project as
      | { projectId: string; customInstructions?: string }
      | undefined;
    const customInstructions = project?.projectId ? project?.customInstructions : undefined;

    const { compiledLangGraphApp, toolsAvailable, tools } = await this.initializeAgentComponents(
      user,
      config,
    );
    const iTools = convertToTools(tools);

    const module: SkillPromptModule = {
      buildSystemPrompt:
        mode === 'copilot_agent'
          ? () =>
              buildWorkflowCopilotPrompt({
                installedToolsets: config.configurable.installedToolsets ?? [],
              })
          : toolsAvailable
            ? () => buildSystemPrompt(iTools, locale)
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
