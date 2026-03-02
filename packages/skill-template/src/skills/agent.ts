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
import pLimit from 'p-limit';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { Icon, SkillTemplateConfigDefinition, User } from '@refly/openapi-schema';

// types
import { GraphState } from '../scheduler/types';
// utils
import { buildFinalRequestMessages, applyAgentLoopCaching } from '../scheduler/utils/message';
import { compressAgentLoopMessages } from '../utils/context-manager';
import { getModelSceneFromMode } from '@refly/utils';

// prompts
import { buildNodeAgentSystemPrompt } from '../prompts/node-agent';
import { buildUserPrompt } from '../prompts/user-prompt';
import { buildWorkflowCopilotPrompt } from '../prompts/copilot-agent';

import { AIMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import { type StructuredToolInterface } from '@langchain/core/tools';
import { isGeminiModel } from '@refly/providers';
import { countToken } from '../scheduler/utils/token';
import { simplifyToolForGemini } from '../utils/schema-simplifier';

// Constants for recursion control
const MAX_TOOL_ITERATIONS = 25;
// Formula: 2 * maxIterations + 1 (each iteration = LLM + tools nodes)
const DEFAULT_RECURSION_LIMIT = 2 * MAX_TOOL_ITERATIONS + 1;
// Max consecutive identical tool calls to detect infinite loops
const MAX_IDENTICAL_TOOL_CALLS = 3;
// Default maximum concurrent tool calls (can be overridden by WORKFLOW_TOOL_PARALLEL_CONCURRENCY env var)
const DEFAULT_TOOL_PARALLEL_CONCURRENCY = 10;

// WeakMap cache for Zod to JSON Schema conversion (avoids repeated conversions)
const zodSchemaCache = new WeakMap<object, object>();

/**
 * Get tool parallel concurrency limit from environment variable
 * @returns Maximum number of concurrent tool calls
 */
function getToolParallelConcurrency(): number {
  const envConcurrency = process.env.WORKFLOW_TOOL_PARALLEL_CONCURRENCY;
  if (envConcurrency) {
    const parsed = Number.parseInt(envConcurrency, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_TOOL_PARALLEL_CONCURRENCY;
}

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
    const {
      preprocessResult,
      mode = 'node_agent',
      ptcEnabled = false,
      ptcContext = undefined,
      ptcSequential = false,
    } = config.configurable;
    const { optimizedQuery, context, sources, usedChatHistory } = preprocessResult;

    const systemPrompt =
      mode === 'copilot_agent'
        ? buildWorkflowCopilotPrompt({
            installedToolsets: config.configurable.installedToolsets ?? [],
            webSearchEnabled: config.configurable.webSearchEnabled ?? false,
          })
        : buildNodeAgentSystemPrompt({ ptcEnabled, ptcContext, ptcSequential });

    // Use copilot scene for copilot_agent mode, agent scene for node_agent mode, otherwise use chat scene
    const modelConfigScene = getModelSceneFromMode(mode);
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
    const {
      selectedTools: rawSelectedTools = [],
      builtInTools = [],
      mode = 'node_agent',
      ptcEnabled = false,
    } = config?.configurable ?? {};

    // In PTC mode, only use builtin tools in the tool definition
    const selectedTools = ptcEnabled ? builtInTools : rawSelectedTools;

    let actualToolNodeInstance: ToolNode<typeof MessagesAnnotation.State> | null = null;
    let availableToolsForNode: StructuredToolInterface[] = [];

    // LLM and LangGraph Setup
    // Use copilot scene for copilot_agent mode, agent scene for node_agent mode, otherwise use chat scene
    const modelScene = getModelSceneFromMode(mode);
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

        const agentModelInfo = config?.configurable?.modelConfigMap?.agent;
        const supportsToolChoice = agentModelInfo?.capabilities?.supportToolChoice !== false;

        // Check if current LLM is Gemini - if so, simplify tool schemas
        const isGemini = isGeminiModel(baseLlm);
        const toolsForBinding = isGemini
          ? validTools.map((tool) => {
              this.engine.logger.info(
                `Simplifying schema for tool "${tool.name}" for Gemini compatibility`,
              );
              return simplifyToolForGemini(tool);
            })
          : validTools;

        // Use tool_choice="auto" to force LLM to decide when to use tools
        // This ensures proper tool_calls format generation
        // Some models (e.g., Claude Haiku) do not support tool_choice parameter
        const bindOptions = supportsToolChoice ? { tool_choice: 'auto' } : undefined;
        this.engine.logger.info(
          `Binding ${toolsForBinding.length} valid tools to LLM with options: ${JSON.stringify(bindOptions)}: [${toolNames.join(', ')}]`,
        );
        llmForGraph = baseLlm.bindTools(toolsForBinding, bindOptions);

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
    // Get compression context from config
    const { user, canvasId, resultId, version } = config?.configurable ?? {};

    // Get model info for context caching check
    const agentModelInfo = config?.configurable?.modelConfigMap?.agent;
    const supportsContextCaching = !!agentModelInfo?.capabilities?.contextCaching;

    const llmNodeForCachedGraph = async (nodeState: typeof MessagesAnnotation.State) => {
      try {
        let currentMessages = nodeState.messages ?? [];
        if (this.engine?.service && user && canvasId && resultId && version) {
          try {
            // Calculate tools tokens once (tools schema is static during the agent loop)
            const toolSchemaTokens = availableToolsForNode?.length
              ? countToken(
                  JSON.stringify(
                    availableToolsForNode.map((t) => ({
                      name: t.name,
                      description: t.description,
                      schema: t.schema,
                    })),
                  ),
                )
              : 0;
            const modelInfo = config?.configurable?.modelConfigMap?.agent;
            const contextLimit = modelInfo?.contextLimit ?? 128000;
            const maxOutput = modelInfo?.maxOutput ?? 8000;
            const compressionResult = await compressAgentLoopMessages({
              messages: currentMessages,
              contextLimit,
              maxOutput,
              user,
              canvasId,
              resultId,
              resultVersion: version,
              service: this.engine.service,
              logger: this.engine.logger,
              modelInfo,
              // Include tools tokens in the calculation for accurate budget estimation
              additionalTokens: toolSchemaTokens,
            });
            currentMessages = compressionResult.messages;
          } catch (compressionError) {
            // Log but don't fail - compression is optional optimization
            this.engine.logger.error('Agent loop compression failed', {
              error: (compressionError as Error)?.message,
            });
          }
        }

        // Apply context caching for each iteration if the model supports it
        // This ensures new messages (AIMessage with tool_calls, ToolMessage) get cache points
        currentMessages = applyAgentLoopCaching(currentMessages, supportsContextCaching);

        // Use llmForGraph, which is the (potentially tool-bound) LLM instance for the graph
        const response = await llmForGraph.invoke(currentMessages);
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
      // Get concurrency limit from environment variable
      const concurrencyLimit = getToolParallelConcurrency();

      // Enhanced tool node with parallel execution of tool calls (with concurrency control)
      const enhancedToolNode = async (toolState: typeof MessagesAnnotation.State) => {
        try {
          const priorMessages = toolState.messages ?? [];
          const lastMessage = priorMessages[priorMessages.length - 1] as AIMessage | undefined;
          const toolCalls = lastMessage?.tool_calls ?? [];

          if (!toolCalls || toolCalls.length === 0) {
            this.engine.logger.info('No tool calls to execute');
            return { messages: priorMessages };
          }

          this.engine.logger.info(
            `Executing ${toolCalls.length} tool calls with concurrency limit ${concurrencyLimit}: [${toolCalls.map((tc) => tc?.name).join(', ')}]`,
          );

          // Create a concurrency limiter
          const limit = pLimit(concurrencyLimit);

          // Execute all tool calls with concurrency control
          const toolPromises = toolCalls.map((call, index) =>
            limit(async () => {
              const toolName = call?.name ?? '';
              const toolArgs = (call?.args as Record<string, unknown>) ?? {};
              const toolCallId = call?.id ?? '';

              if (!toolName) {
                this.engine.logger.warn(`Tool call at index ${index} has empty name`);
                return {
                  index,
                  message: new ToolMessage({
                    content: 'Error: Tool name is missing',
                    tool_call_id: toolCallId,
                    name: 'unknown_tool',
                  }),
                };
              }

              const matchedTool = (availableToolsForNode || []).find((t) => t?.name === toolName);

              if (!matchedTool) {
                this.engine.logger.warn(`Tool not found: ${toolName}`);
                return {
                  index,
                  message: new ToolMessage({
                    content: `Error: Tool '${toolName}' not available`,
                    tool_call_id: toolCallId,
                    name: toolName,
                  }),
                };
              }

              try {
                const rawResult = await matchedTool.invoke(toolArgs);
                const stringified =
                  typeof rawResult === 'string'
                    ? rawResult
                    : JSON.stringify(rawResult ?? {}, null, 2);

                this.engine.logger.info(`Tool '${toolName}' completed successfully`);
                return {
                  index,
                  message: new ToolMessage({
                    content: stringified,
                    tool_call_id: toolCallId,
                    name: matchedTool.name,
                  }),
                };
              } catch (toolError) {
                const errMsg =
                  (toolError as Error)?.message ?? String(toolError ?? 'Unknown tool error');
                this.engine.logger.error(`Tool '${toolName}' failed: ${errMsg}`);
                return {
                  index,
                  message: new ToolMessage({
                    content: `Error executing tool '${toolName}': ${errMsg}`,
                    tool_call_id: toolCallId,
                    name: matchedTool.name,
                  }),
                };
              }
            }),
          );

          // Wait for all tools to complete
          const results = await Promise.all(toolPromises);

          // Sort by original index to maintain order for LLM context
          const toolResultMessages = results
            .sort((a, b) => a.index - b.index)
            .map((r) => r.message);

          this.engine.logger.info(`All ${toolCalls.length} tool calls completed`);
          if ((lastMessage as any).response_metadata?.model_provider === 'google-vertexai') {
            const originalSignatures = (lastMessage as any).additional_kwargs?.signatures as any[];
            const toolCallsCount = lastMessage.tool_calls?.length ?? 0;

            // CRITICAL: Vertex AI (Gemini) requires valid signatures for tool calls
            // The signatures array structure varies based on the response:
            // - Valid signatures can be anywhere: beginning, middle, or end
            // - Empty strings are placeholders for text parts
            // Strategy: Find the first non-empty signature, then take N consecutive elements
            // from that position, preserving the original structure and positional relationships
            if (Array.isArray(originalSignatures) && originalSignatures.length > toolCallsCount) {
              // Find the index of the first non-empty signature
              const firstNonEmptyIndex = originalSignatures.findIndex(
                (s) => typeof s === 'string' && s.length > 0,
              );

              if (firstNonEmptyIndex >= 0) {
                // Take N consecutive elements starting from the first non-empty signature
                const extractedSignatures = originalSignatures.slice(
                  firstNonEmptyIndex,
                  firstNonEmptyIndex + toolCallsCount,
                );

                // If we don't have enough elements, pad with empty strings
                while (extractedSignatures.length < toolCallsCount) {
                  extractedSignatures.push('');
                }

                lastMessage.additional_kwargs.signatures = extractedSignatures;
              } else {
                // Fallback: no non-empty signatures found (shouldn't happen)
                this.engine.logger.warn(
                  `No non-empty signatures found for ${toolCallsCount} tool calls`,
                );
                lastMessage.additional_kwargs.signatures = originalSignatures.slice(
                  0,
                  toolCallsCount,
                );
              }
            }

            // Clear content to avoid 400 INVALID_ARGUMENT when AIMessage has both text and tool_calls
            lastMessage.content = '';
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

    const ptcEnabled = config.configurable.ptcEnabled;
    const ptcContext = config.configurable.ptcContext;
    const ptcMetadata =
      ptcEnabled && ptcContext
        ? {
            ptcToolsets: ptcContext.toolsets,
            ptcSdkPathPrefix: ptcContext.sdk.pathPrefix,
          }
        : {};

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
            ptcEnabled,
            ...ptcMetadata,
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
