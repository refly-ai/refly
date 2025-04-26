import { END, START, StateGraph, StateGraphArgs } from '@langchain/langgraph';
import { z } from 'zod';
import { BaseSkill, BaseSkillState, baseStateGraphArgs, SkillRunnableConfig } from '../base';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';

// Import MCP modules

import { AIMessage } from '@langchain/core/messages';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { GraphState } from '../scheduler/types';
import { prepareContext } from '../scheduler/utils/context';
import { buildFinalRequestMessages } from '../scheduler/utils/message';
import { processQuery } from '../scheduler/utils/queryProcessor';
import { MCPAssistant, Message, MessageRole, ChunkCallbackData } from '../mcp/core/MCPAssistant';
import { MCPServerConfig } from '../mcp/core/types';

/**
 * Extended state for MCP Connector skill
 */
interface MCPConnectorState extends BaseSkillState {
  mcpActionResult?: any;
}

/**
 * MCP Connector Skill
 * Connects to Model Context Protocol servers and makes intelligent decisions
 * about when and how to use their capabilities to solve user queries.
 * Uses MCPAssistant to manage interactions with MCP servers.
 */
export class MCPConnector extends BaseSkill {
  name = 'mcpConnector';

  icon: Icon = { type: 'emoji', value: '🔌' };

  displayName = {
    en: 'MCP Connector',
    'zh-CN': 'MCP 连接器',
  };

  description =
    'Connect to MCP servers and intelligently leverage their capabilities to solve user queries';

  // MCPAssistant instances cache - store assistants by session ID
  private mcpAssistants: Record<string, MCPAssistant> = {};

  // Server configurations cache
  private serverConfigs: Record<string, MCPServerConfig> = {};

  // Configuration schema for the skill
  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'mcpServers',
        inputMode: 'inputTextArea',
        defaultValue: '',
        labelDict: {
          en: 'MCP Servers',
          'zh-CN': 'MCP 服务器',
        },
        descriptionDict: {
          en: 'Comma-separated list of MCP server URLs',
          'zh-CN': '以逗号分隔的 MCP 服务器 URL 列表',
        },
      },
      {
        key: 'autoConnect',
        inputMode: 'switch',
        defaultValue: true,
        labelDict: {
          en: 'Auto Connect',
          'zh-CN': '自动连接',
        },
        descriptionDict: {
          en: 'Automatically connect to MCP servers on startup',
          'zh-CN': '启动时自动连接到 MCP 服务器',
        },
      },
      {
        key: 'useAdvancedPrompting',
        inputMode: 'switch',
        defaultValue: true,
        labelDict: {
          en: 'Use Advanced Prompting',
          'zh-CN': '使用高级提示',
        },
        descriptionDict: {
          en: 'Enable sophisticated prompting for more accurate MCP capability selection',
          'zh-CN': '启用复杂提示以更准确地选择 MCP 功能',
        },
      },
      {
        key: 'modelTemperature',
        inputMode: 'inputNumber',
        defaultValue: 0.2,
        labelDict: {
          en: 'Model Temperature',
          'zh-CN': '模型温度',
        },
        descriptionDict: {
          en: 'Temperature for the model when making MCP decisions (0-1)',
          'zh-CN': '做出 MCP 决策时的模型温度 (0-1)',
        },
        inputProps: {
          min: 0,
          max: 1,
          step: 0.1,
        },
      },
    ],
  };

  // Invocation configuration
  invocationConfig: SkillInvocationConfig = {};

  // Schema definition for input
  schema = z.object({
    query: z.string().optional().describe('User query for MCP interaction'),
    images: z.array(z.string()).optional().describe('Images that might be relevant'),
  });

  // State graph definition with additional mcpActionResult channel
  graphState: StateGraphArgs<MCPConnectorState>['channels'] = {
    ...baseStateGraphArgs,
    mcpActionResult: {
      reducer: (_left, right) => right,
      default: () => undefined,
    },
  };

  /**
   * Create a new MCPAssistant or get an existing one
   * @param sessionId Unique session identifier
   * @param config Skill configuration
   * @returns MCPAssistant instance
   */
  private getOrCreateAssistant(sessionId: string, config: SkillRunnableConfig): MCPAssistant {
    // Check if we already have an assistant for this session
    if (this.mcpAssistants[sessionId]) {
      return this.mcpAssistants[sessionId];
    }

    // Create a new assistant
    const assistant = new MCPAssistant({
      autoInjectTools: true,
      // customSystemPrompt: this.buildCustomSystemPrompt(config),
      modelProvider: (messages) => this.callModel(messages, config),
      onChunk: (data) => this.handleChunk(data, config),
    });

    // Cache the assistant
    this.mcpAssistants[sessionId] = assistant;

    return assistant;
  }

  /**
   * Build custom system prompt for MCPAssistant
   * @param config Skill configuration
   * @returns Custom system prompt
   */
  private buildCustomSystemPrompt(config: SkillRunnableConfig): string {
    const { locale = 'en' } = config.configurable;

    // Base custom prompt with locale support
    const customPrompt =
      locale === 'zh-CN'
        ? '你是一个有用的AI助手，能够回答用户的问题并根据需要使用外部工具。当看到用户询问需要最新信息、代码执行或使用专业工具的问题时，应优先考虑使用合适的工具来回答。'
        : 'You are a helpful AI assistant that can answer user questions and use external tools when needed. When the user asks questions requiring up-to-date information, code execution, or specialized tools, prioritize using the appropriate tools to answer.';

    return customPrompt;
  }

  /**
   * Call the model with messages
   * @param messages Messages to send to the model
   * @param config Skill configuration
   * @returns Model response text
   */
  private async callModel(messages: Message[], config: SkillRunnableConfig): Promise<string> {
    // Convert MCPAssistant messages to BaseMessage format
    const baseMessages = messages.map((msg) => {
      // Map roles
      const roleMap: Record<MessageRole, string> = {
        [MessageRole.SYSTEM]: 'system',
        [MessageRole.USER]: 'user',
        [MessageRole.ASSISTANT]: 'assistant',
      };

      // Create BaseMessage-compatible object
      return {
        role: roleMap[msg.role],
        content: msg.content,
      };
    });

    // Get temperature setting
    const temperature = (config.configurable.tplConfig?.modelTemperature?.value as number) || 0.2;

    // Call model
    const model = this.engine.chatModel({ temperature });
    const response = await model.invoke(baseMessages as any, {
      ...config,
      metadata: {
        ...config.metadata,
        step: { name: 'mcpAssistantModelCall' },
      },
    });

    // Return response content
    return typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  }

  /**
   * Handle chunks from MCPAssistant
   * @param data Chunk data
   * @param config Skill configuration
   */
  private handleChunk(data: ChunkCallbackData, config: SkillRunnableConfig): void {
    // Handle text chunks
    if (data.text) {
      this.emitEvent(
        {
          log: {
            key: 'mcp_chunk',
            titleArgs: {
              content: data.text,
            },
          },
        },
        config,
      );
    }

    // Handle tool response chunks
    if (data.mcpToolResponse) {
      // Find tools being executed
      const executing = data.mcpToolResponse.filter((tool) => tool.status === 'invoking');
      if (executing.length > 0) {
        this.emitEvent(
          {
            log: {
              key: 'mcp_tool_executing',
              titleArgs: {
                tool: executing[0].tool.name,
              },
            },
          },
          config,
        );
      }

      // Find completed tools
      const completed = data.mcpToolResponse.filter((tool) => tool.status === 'done');
      if (completed.length > 0) {
        this.emitEvent(
          {
            log: {
              key: 'mcp_tool_completed',
              titleArgs: {
                tool: completed[0].tool.name,
              },
            },
          },
          config,
        );
      }

      // Find error tools
      const errors = data.mcpToolResponse.filter((tool) => tool.status === 'error');
      if (errors.length > 0) {
        this.emitEvent(
          {
            log: {
              key: 'mcp_tool_error',
              titleArgs: {
                tool: errors[0].tool.name,
                error: errors[0].response?.content[0]?.text || 'Unknown error',
              },
            },
          },
          config,
        );
      }
    }
  }

  /**
   * Build server configurations from URLs
   * @param serverUrls Array of server URLs
   * @returns Array of server configurations
   */
  private buildServerConfigs(serverUrls: string[]): MCPServerConfig[] {
    return serverUrls.map((url, index) => {
      // Check if we already have a configuration for this URL
      if (this.serverConfigs[url]) {
        return this.serverConfigs[url];
      }

      // Create a new configuration
      const config: MCPServerConfig = {
        id: `server-${index}`,
        name: `MCP Server ${index + 1}`,
        description: `MCP server at ${url}`,
        type: url.includes('/sse') ? 'sse' : 'streamableHttp',
        baseUrl: url,
      };

      // Cache the configuration
      this.serverConfigs[url] = config;

      return config;
    });
  }

  /**
   * Add servers to MCPAssistant
   * @param assistant MCPAssistant instance
   * @param serverConfigs Array of server configurations
   * @param config Skill configuration
   * @returns Connection results
   */
  private async addServersToAssistant(
    assistant: MCPAssistant,
    serverConfigs: MCPServerConfig[],
    config: SkillRunnableConfig,
  ): Promise<{
    success: boolean;
    connectedServers: string[];
    failedServers: string[];
  }> {
    const connectedServers: string[] = [];
    const failedServers: string[] = [];

    // Notify about connection attempt
    this.emitEvent(
      {
        log: {
          key: 'connecting_mcp_servers',
          titleArgs: {
            count: serverConfigs.length,
          },
        },
      },
      config,
    );

    // Connect to each server
    for (const serverConfig of serverConfigs) {
      try {
        await assistant.addServer(serverConfig);
        connectedServers.push(serverConfig.baseUrl || serverConfig.id);

        this.engine.logger.log(
          `Connected to MCP server: ${serverConfig.baseUrl || serverConfig.id}`,
        );
      } catch (error) {
        failedServers.push(serverConfig.baseUrl || serverConfig.id);

        this.engine.logger.error(
          `Failed to connect to MCP server ${serverConfig.baseUrl || serverConfig.id}: ${error}`,
        );
      }
    }

    // Log connection results
    if (failedServers.length > 0) {
      const errorMessage = `Failed to connect to ${failedServers.length} MCP server(s): ${failedServers.join(', ')}`;
      this.engine.logger.warn(errorMessage);
      this.emitEvent(
        {
          log: {
            key: 'mcp_connection_error',
            titleArgs: {
              error: errorMessage,
            },
          },
        },
        config,
      );
    }

    this.engine.logger.log(`Successfully connected to ${connectedServers.length} MCP server(s)`);

    return {
      success: connectedServers.length > 0,
      connectedServers,
      failedServers,
    };
  }

  /**
   * Clean up MCPAssistant instances and connections
   */
  cleanupSessions(): void {
    // Close all assistants
    for (const [sessionId, assistant] of Object.entries(this.mcpAssistants)) {
      try {
        assistant.close().catch((error) => {
          this.engine.logger.warn(`Failed to close MCPAssistant for ${sessionId}: ${error}`);
        });

        delete this.mcpAssistants[sessionId];
      } catch (error) {
        this.engine.logger.warn(`Error cleaning up MCPAssistant for ${sessionId}: ${error}`);
      }
    }

    // Clear caches
    this.mcpAssistants = {};
  }

  /**
   * Main handler method for the MCP Connector skill
   * @param state Graph state
   * @param config Skill configuration
   * @returns Updated graph state
   */
  callMCPConnector = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<MCPConnectorState>> => {
    const { messages = [], images = [] } = state;
    const { locale = 'en', tplConfig } = config.configurable;

    // Get configuration values
    const mcpServersString =
      (tplConfig?.mcpServers?.value as string) ||
      'https://mcpmarket.cn/sse/67f39bfdb66f446c3d8ef609,https://mcp.semgrep.ai/sse,https://remote.mcpservers.org/sequentialthinking/mcp,https://remote.mcpservers.org/fetch/mcp';
    const serverUrls = mcpServersString
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    const autoConnect = tplConfig?.autoConnect?.value !== false;

    // Generate a session ID for this request
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Set initial step
    config.metadata.step = { name: 'processQuery' };

    // Process the query
    const { query, optimizedQuery, usedChatHistory, mentionedContext, remainingTokens } =
      await processQuery({
        config,
        ctxThis: this,
        state,
      });

    // If no servers or auto-connect disabled, answer directly
    if (!autoConnect || serverUrls.length === 0) {
      return this.handleDirectAnswer(
        query,
        optimizedQuery,
        usedChatHistory,
        mentionedContext,
        remainingTokens,
        images,
        messages,
        config,
      );
    }

    // Create MCPAssistant and add servers
    const assistant = this.getOrCreateAssistant(sessionId, config);

    // Build server configurations
    const serverConfigs = this.buildServerConfigs(serverUrls);

    // Connect to servers
    const connectionResult = await this.addServersToAssistant(assistant, serverConfigs, config);

    // If connection failed, answer directly
    if (!connectionResult.success) {
      this.emitEvent(
        {
          log: {
            key: 'no_mcp_servers',
          },
        },
        config,
      );

      return this.handleDirectAnswer(
        query,
        optimizedQuery,
        usedChatHistory,
        mentionedContext,
        remainingTokens,
        images,
        messages,
        config,
      );
    }

    try {
      // Set MCP processing step
      config.metadata.step = { name: 'processMCPQuery' };

      // Run the assistant with the query
      const assistantResponse = await assistant.run(query);

      // Get all messages for context
      const mcpActionResult = assistant.getMessages();

      // Create response message
      const responseMessage = new AIMessage({ content: assistantResponse });

      return {
        messages: [responseMessage],
        mcpActionResult,
      };
    } catch (error) {
      // Log error
      this.engine.logger.error(`Error in MCPAssistant processing: ${error}`);

      // Fall back to direct answer
      this.emitEvent(
        {
          log: {
            key: 'mcp_processing_error',
            titleArgs: {
              error: String(error),
            },
          },
        },
        config,
      );

      return this.handleDirectAnswer(
        query,
        optimizedQuery,
        usedChatHistory,
        mentionedContext,
        remainingTokens,
        images,
        messages,
        config,
      );
    } finally {
      // Clean up the assistant after use
      try {
        await assistant.close();
        delete this.mcpAssistants[sessionId];
      } catch (closeError) {
        this.engine.logger.warn(`Error closing MCPAssistant: ${closeError}`);
      }
    }
  };

  /**
   * Handle direct answering without MCP
   * @param query Original query
   * @param optimizedQuery Optimized query
   * @param usedChatHistory Used chat history
   * @param mentionedContext Mentioned context
   * @param remainingTokens Remaining tokens
   * @param images Images
   * @param messages Messages
   * @param config Skill configuration
   * @returns Updated graph state
   */
  private async handleDirectAnswer(
    query: string,
    optimizedQuery: string,
    usedChatHistory: any[],
    mentionedContext: any,
    remainingTokens: number,
    images: string[],
    messages: any[],
    config: SkillRunnableConfig,
  ): Promise<Partial<MCPConnectorState>> {
    const { locale = 'en' } = config.configurable;

    // Prepare context for direct answering
    config.metadata.step = { name: 'prepareContext' };

    const { contextStr } = await prepareContext(
      {
        query: optimizedQuery,
        mentionedContext,
        maxTokens: remainingTokens,
        enableMentionedContext: true,
      },
      {
        config,
        ctxThis: this,
        state: { query, images, messages: [] },
        tplConfig: config.configurable.tplConfig,
      },
    );

    // Use simple module for direct answering
    const module = {
      buildSystemPrompt: () =>
        'You are a helpful assistant. Answer the user query based on your knowledge and the provided context if any.',
      buildContextUserPrompt: (context) => context,
      buildUserPrompt: ({ originalQuery }) => originalQuery,
    };

    // Build request messages
    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext: !!contextStr,
      context: contextStr,
      images,
      originalQuery: query,
      optimizedQuery,
      modelInfo: config?.configurable?.modelInfo,
    });

    // Call model directly
    const model = this.engine.chatModel();
    const responseMessage = await model.invoke(requestMessages, {
      ...config,
      metadata: {
        ...config.metadata,
        step: { name: 'directAnswer' },
      },
    });

    // 返回类型为 Partial<MCPConnectorState>
    return {
      messages: [responseMessage],
      // mcpActionResult 属性也可以在这里设置为 null 或其他值
      mcpActionResult: null,
    };
  }

  /**
   * Define the workflow for this skill
   * @returns The compiled runnable
   */
  toRunnable(): Runnable<any, any, RunnableConfig> {
    // Create a simple linear workflow
    const workflow = new StateGraph<MCPConnectorState>({
      channels: this.graphState,
    })
      .addNode('callMCPConnector', this.callMCPConnector.bind(this))
      .addEdge(START, 'callMCPConnector')
      .addEdge('callMCPConnector', END);

    return workflow.compile();
  }
}
