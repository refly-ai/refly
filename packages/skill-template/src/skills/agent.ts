import {
  START,
  END,
  StateGraphArgs,
  StateGraph,
  MessagesAnnotation,
  GraphRecursionError,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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

// Constants for recursion control
const MAX_TOOL_ITERATIONS = 25;
// Formula: 2 * maxIterations + 1 (each iteration = LLM + tools nodes)
const DEFAULT_RECURSION_LIMIT = 2 * MAX_TOOL_ITERATIONS + 1;
// Max consecutive identical tool calls to detect infinite loops
const MAX_IDENTICAL_TOOL_CALLS = 3;

// WeakMap cache for Zod to JSON Schema conversion (avoids repeated conversions)
const zodSchemaCache = new WeakMap<object, object>();

/**
 * Convert Zod schema to JSON Schema with caching.
 * Uses WeakMap so cached entries are automatically garbage collected
 * when the original Zod schema is no longer referenced.
 *
 * Note: StructuredToolInterface.schema is typed as ToolInputSchemaBase which
 * is a union type, but at runtime it's always a Zod schema for DynamicStructuredTool.
 */
function getJsonSchema(zodSchema: unknown): object | undefined {
  if (!zodSchema || typeof zodSchema !== 'object') return undefined;

  let cached = zodSchemaCache.get(zodSchema);
  if (!cached) {
    // zodToJsonSchema accepts ZodType, runtime schema is always Zod
    cached = zodToJsonSchema(zodSchema as z.ZodTypeAny, { target: 'openApi3' });
    zodSchemaCache.set(zodSchema, cached);
  }
  return cached;
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

    // Use copilot scene for copilot_agent mode, otherwise use chat scene
    const modelConfigScene = mode === 'copilot_agent' ? 'copilot' : 'chat';
    const modelInfo = config?.configurable?.modelConfigMap?.[modelConfigScene];
    const hasVisionCapability = modelInfo?.capabilities?.vision ?? false;

    const userPrompt = buildUserPrompt(optimizedQuery, context, { hasVisionCapability });

    const requestMessages = buildFinalRequestMessages({
      systemPrompt,
      userPrompt,
      chatHistory: usedChatHistory,
      messages,
      images,
      modelInfo,
    });

    return { requestMessages, sources, systemPrompt, modelInfo };
  };

  private async initializeAgentComponents(
    _user: User,
    config?: SkillRunnableConfig,
  ): Promise<AgentComponents> {
    const { selectedTools = [], mode = 'node_agent' } = config?.configurable ?? {};

    let actualToolNodeInstance: ToolNode<typeof MessagesAnnotation.State> | null = null;
    let availableToolsForNode: StructuredToolInterface[] = [];

    // LLM and LangGraph Setup
    // Use copilot scene for copilot_agent mode, otherwise use chat scene
    const modelScene = mode === 'copilot_agent' ? 'copilot' : 'chat';
    const baseLlm = this.engine.chatModel({ temperature: 0.1 }, modelScene);
    let llmForGraph: Runnable<BaseMessage[], AIMessage>;

    if (selectedTools.length > 0) {
      // Ensure tool definitions are valid before binding
      // Also filter out tools with names exceeding 64 characters (OpenAI limit)
      const validTools = selectedTools.filter((tool) => {
        if (!tool.name || !tool.description || !tool.schema) {
          this.engine.logger.warn(`Skipping invalid tool: ${tool.name || 'unnamed'}`);
          return false;
        }
        if (tool.name.length > 64) {
          this.engine.logger.warn(
            `Skipping tool with name exceeding 64 characters: ${tool.name} (${tool.name.length} chars)`,
          );
          return false;
        }
        return true;
      });

      if (validTools.length > 0) {
        const toolNames = validTools.map((tool) => tool.name);
        this.engine.logger.info(
          `Binding ${validTools.length} valid tools to LLM with tool_choice="auto": [${toolNames.join(', ')}]`,
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
      this.engine.logger.info('No tools selected, using base LLM without tools');
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
          this.engine.logger.info('Executing tool node with strict sequential tool calls');

          const priorMessages = toolState.messages ?? [];
          const lastMessage = priorMessages[priorMessages.length - 1] as AIMessage | undefined;
          const toolCalls = lastMessage?.tool_calls ?? [];

          if (!toolCalls || toolCalls.length === 0) {
            this.engine.logger.info('No tool calls to execute');
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
              // Each invocation awaited to ensure strict serial execution
              const rawResult = await matchedTool.invoke(toolArgs);
              const stringified =
                typeof rawResult === 'string'
                  ? rawResult
                  : JSON.stringify(rawResult ?? {}, null, 2);

              toolResultMessages.push(
                new ToolMessage({
                  content: stringified,
                  tool_call_id: call?.id ?? '',
                  name: matchedTool.name,
                }),
              );

              this.engine.logger.info(`Tool '${toolName}' executed successfully`);
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

      // Track tool call history for loop detection
      let toolCallHistory: string[] = [];

      // addConditionalEdges does not return the graph instance, so no 'as typeof workflow' needed here
      // if the 'workflow' variable already has the correct comprehensive type.
      // @ts-ignore - Suppressing persistent type error with addConditionalEdges and node name mismatch
      workflow.addConditionalEdges('llm', (graphState: typeof MessagesAnnotation.State) => {
        const lastMessage = graphState.messages[graphState.messages.length - 1] as AIMessage;

        if (lastMessage?.tool_calls && lastMessage?.tool_calls?.length > 0) {
          // Create a signature for the current tool calls to detect loops
          const currentToolSignature = lastMessage.tool_calls
            .map((tc) => `${tc?.name ?? ''}:${JSON.stringify(tc?.args ?? {})}`)
            .sort()
            .join('|');

          // Check for repeated identical tool calls (potential infinite loop)
          toolCallHistory.push(currentToolSignature);
          const recentCalls = toolCallHistory.slice(-MAX_IDENTICAL_TOOL_CALLS);
          const allIdentical =
            recentCalls.length === MAX_IDENTICAL_TOOL_CALLS &&
            recentCalls.every((call) => call === currentToolSignature);

          if (allIdentical) {
            this.engine.logger.warn(
              `Detected ${MAX_IDENTICAL_TOOL_CALLS} identical consecutive tool calls, breaking potential infinite loop`,
              { toolSignature: currentToolSignature },
            );
            // Reset history and route to END to prevent infinite loop
            toolCallHistory = [];
            return END;
          }

          this.engine.logger.info(
            `Tool calls detected (${lastMessage.tool_calls.length} calls), routing to tools node`,
            { toolCalls: lastMessage.tool_calls, iterationCount: toolCallHistory.length },
          );
          return 'tools';
        }

        this.engine.logger.info('No tool calls detected, routing to END');
        // Reset tool call history when conversation ends naturally
        toolCallHistory = [];
        return END;
      });
    } else {
      this.engine.logger.info(
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

    try {
      const result = await compiledLangGraphApp.invoke(
        { messages: requestMessages },
        {
          ...config,
          recursionLimit: DEFAULT_RECURSION_LIMIT,
          metadata: {
            ...config.metadata,
            ...currentSkill,
            toolsAvailable,
            toolCount: tools?.length || 0,
            // Reproducible context for Langfuse tracing
            // Tool definitions with full JSON Schema for offline replay
            toolDefinitions: tools?.map((t) => ({
              type: 'function',
              name: t.name,
              description: t.description,
              parameters: getJsonSchema(t.schema),
            })),
            // Runtime config for reproducibility
            // Note: systemPrompt already in input[0], modelConfig duplicates modelParameters
            toolChoice: toolsAvailable ? 'auto' : undefined,
            graphRecursionLimit: DEFAULT_RECURSION_LIMIT,
          },
        },
      );

      this.engine.logger.info(
        `Agent execution completed: ${JSON.stringify({
          messagesCount: result.messages?.length || 0,
          toolCallCount:
            result.messages?.filter((msg) => (msg as AIMessage).tool_calls?.length > 0).length || 0,
          toolsAvailable,
          toolCount: tools?.length || 0,
        })}`,
      );

      return { messages: result.messages };
    } catch (error) {
      // Handle recursion limit error gracefully
      if (error instanceof GraphRecursionError) {
        this.engine.logger.warn(
          `Agent reached recursion limit (${DEFAULT_RECURSION_LIMIT} steps, ~${MAX_TOOL_ITERATIONS} iterations). Returning partial result.`,
        );

        // Create a message explaining the situation to the user
        const limitReachedMessage = new AIMessage({
          content:
            'I apologize, but I have reached the maximum number of iterations while working on this task. ' +
            'Here is a summary of what I was able to accomplish. ' +
            'If you need further assistance, please try breaking down the task into smaller steps or provide more specific instructions.',
        });

        return { messages: [limitReachedMessage] };
      }

      // Re-throw other errors
      throw error;
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
