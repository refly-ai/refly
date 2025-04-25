import { END, START, StateGraph, StateGraphArgs } from '@langchain/langgraph';
import { z } from 'zod';
import { BaseSkill, BaseSkillState, baseStateGraphArgs, SkillRunnableConfig } from '../base';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';

// Import MCP SDK
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { BaseMessage } from '@langchain/core/messages';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { GraphState } from '../scheduler/types';
import { prepareContext } from '../scheduler/utils/context';
import { buildFinalRequestMessages } from '../scheduler/utils/message';
import { processQuery } from '../scheduler/utils/queryProcessor';

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

  // MCP client instances cache - store clients by server URL
  private mcpClients: Record<string, Client> = {};

  // MCP server capabilities cache - store detailed capabilities by server URL
  private serverCapabilitiesCache: Record<string, any> = {};

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
        key: 'retryCount',
        inputMode: 'inputNumber',
        defaultValue: 2,
        labelDict: {
          en: 'Retry Count',
          'zh-CN': '重试次数',
        },
        descriptionDict: {
          en: 'Number of times to retry failed MCP calls',
          'zh-CN': '失败的 MCP 调用重试次数',
        },
        inputProps: {
          min: 0,
          max: 5,
          step: 1,
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
      reducer: (left, right) => right,
      default: () => undefined,
    },
  };

  /**
   * Connect to a single MCP server and discover its capabilities
   * @param serverUrl The URL of the MCP server to connect to
   * @returns A promise resolving to client, capabilities, and any error
   */
  private async connectToMCPServer(serverUrl: string): Promise<{
    client: Client | null;
    capabilities: any;
    error?: string;
  }> {
    try {
      // Create client instance
      const client = new Client({
        name: 'refly-mcp-connector',
        version: '1.0.0',
      });

      const baseUrl = new URL(serverUrl);

      try {
        // First try using the modern StreamableHTTP transport
        const transport = new StreamableHTTPClientTransport(baseUrl);
        await client.connect(transport);
        this.engine.logger.log(`Connected to MCP server at ${serverUrl} using StreamableHTTP`);
      } catch (error) {
        // Fall back to SSE transport for older servers
        this.engine.logger.log(`Failed to connect using StreamableHTTP, trying SSE: ${error}`);
        const sseTransport = new SSEClientTransport(baseUrl);
        await client.connect(sseTransport);
        this.engine.logger.log(`Connected to MCP server at ${serverUrl} using SSE`);
      }

      // Instead of using getServerCapabilities, directly initialize an empty capabilities object

      // Cache the client instance
      this.mcpClients[serverUrl] = client;

      // Explore detailed capabilities (async, will be updated later)
      const basicCapabilities = await this.exploreServerCapabilities(serverUrl, client)
        .then((detailedCapabilities) => {
          this.serverCapabilitiesCache[serverUrl] = detailedCapabilities;
          return detailedCapabilities;
        })
        .catch((error) => {
          this.engine.logger.error(`Failed to explore capabilities for ${serverUrl}: ${error}`);
        });

      return {
        client,
        capabilities: basicCapabilities,
      };
    } catch (error: any) {
      this.engine.logger.error(`Failed to connect to MCP server at ${serverUrl}: ${error}`);
      return {
        client: null,
        capabilities: {},
        error: `Failed to connect to ${serverUrl}: ${error.message}`,
      };
    }
  }

  /**
   * Explore detailed capabilities of an MCP server
   * @param serverUrl The URL of the MCP server
   * @param client The connected MCP client
   * @returns A promise resolving to detailed capabilities
   */
  private async exploreServerCapabilities(serverUrl: string, client: Client) {
    const capabilities: Record<string, any> = {
      serverInfo: client.getServerVersion(),
    };

    try {
      // Directly try to list tools without checking capabilities first
      try {
        const toolsResult = await client.listTools();
        // 确保我们有一个工具数组，即使API返回格式变化
        const toolsList = Array.isArray(toolsResult) ? toolsResult : toolsResult?.tools || [];

        capabilities.tools = toolsList;

        // 尝试获取每个工具的详细信息
        if (toolsList.length > 0) {
          const toolDetails = [];

          for (const tool of toolsList) {
            try {
              // 不再尝试使用getToolSchema方法，因为当前SDK不支持
              // 直接从工具对象获取可用的信息
              toolDetails.push({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters || tool.inputSchema || [],
              });
            } catch (error) {
              // 如果处理失败，使用基本信息
              this.engine.logger.warn(`Failed to process tool ${tool.name}: ${error}`);
              toolDetails.push({
                name: tool.name,
                description: tool.description || 'No description available',
                parameters: [],
              });
            }
          }
          capabilities.toolDetails = toolDetails;
        }
      } catch (error) {
        this.engine.logger.warn(`Failed to list tools for ${serverUrl}: ${error}`);
      }

      // Directly try to list resources without checking capabilities first
      try {
        const resourcesResult = await client.listResources();
        // 确保我们有一个资源数组，即使API返回格式变化
        const resourcesList = Array.isArray(resourcesResult)
          ? resourcesResult
          : resourcesResult?.resources || [];

        capabilities.resources = resourcesList;
      } catch (error) {
        this.engine.logger.warn(`Failed to list resources for ${serverUrl}: ${error}`);
      }

      // Directly try to list prompts without checking capabilities first
      try {
        const promptsResult = await client.listPrompts();
        // 确保我们有一个提示数组，即使API返回格式变化
        const promptsList = Array.isArray(promptsResult)
          ? promptsResult
          : promptsResult?.prompts || [];

        capabilities.prompts = promptsList;
      } catch (error) {
        this.engine.logger.warn(`Failed to list prompts for ${serverUrl}: ${error}`);
      }

      return capabilities;
    } catch (error) {
      this.engine.logger.error(
        `Error exploring MCP server capabilities for ${serverUrl}: ${error}`,
      );
      return capabilities; // 返回已收集的能力信息，而不是空对象
    }
  }

  /**
   * Connect to all specified MCP servers
   * @param serverUrls Array of server URLs to connect to
   * @returns A promise resolving to connections and errors
   */
  private async connectToAllServers(serverUrls: string[]): Promise<{
    connections: Array<{ url: string; client: Client; capabilities: any }>;
    errors: Array<{ url: string; error: string }>;
  }> {
    const connections = [];
    const errors = [];

    // Connect to each server concurrently
    const connectionResults = await Promise.all(
      serverUrls.map(async (url) => {
        const trimmedUrl = url.trim();
        const { client, capabilities, error } = await this.connectToMCPServer(trimmedUrl);
        return { url: trimmedUrl, client, capabilities, error };
      }),
    );

    // Process results
    for (const { url, client, capabilities, error } of connectionResults) {
      if (client) {
        connections.push({ url, client, capabilities });
      } else if (error) {
        errors.push({ url, error });
      }
    }

    return { connections, errors };
  }

  /**
   * Reload an MCP client connection
   * @param serverUrl The URL of the MCP server to reload
   * @returns A promise resolving to a boolean indicating success
   */
  async reloadMCPClient(serverUrl: string): Promise<boolean> {
    // Disconnect existing client if any
    const existingClient = this.mcpClients[serverUrl];
    if (existingClient) {
      // 移除客户端引用而不是尝试关闭它，因为SDK未提供直接关闭的方法
      delete this.mcpClients[serverUrl];
      this.engine.logger.warn(`Removed client for ${serverUrl}`);

      delete this.serverCapabilitiesCache[serverUrl];
    }

    // Reconnect
    const { client } = await this.connectToMCPServer(serverUrl);
    return !!client;
  }

  /**
   * Clean up all MCP client sessions
   */
  cleanupSessions(): void {
    // Close all client connections
    for (const [url, _] of Object.entries(this.mcpClients)) {
      try {
        // 移除客户端引用而不是尝试关闭它，因为SDK未提供直接关闭的方法
        delete this.mcpClients[url];
        this.engine.logger.log(`Disconnected MCP client for ${url}`);
      } catch (error) {
        this.engine.logger.warn(`Failed to clean up MCP client for ${url}: ${error}`);
      }
    }

    // Clear caches
    this.mcpClients = {};
    this.serverCapabilitiesCache = {};
  }

  /**
   * Format MCP capabilities into a prompt-friendly format
   * @param capabilities The raw capabilities object
   * @returns Formatted capabilities
   */
  private formatCapabilities(capabilities: any): any {
    const formatted: Record<string, any> = {};

    // Format tools
    if (capabilities.tools && Array.isArray(capabilities.tools)) {
      formatted.tools = capabilities.tools.map((tool: any) => {
        // 获取工具详情（如果存在）
        const toolDetail = capabilities.toolDetails?.find((t: any) => t.name === tool.name);

        return {
          name: tool.name,
          description: tool.description || 'No description available',
          parameters: toolDetail?.parameters || tool.parameters || tool.inputSchema || [],
        };
      });
    }

    // Format resources
    if (capabilities.resources && Array.isArray(capabilities.resources)) {
      formatted.resources = capabilities.resources.map((resource: any) => ({
        name: resource.name,
        description: resource.description || 'No description available',
        uriTemplates: resource.uriTemplates || [],
      }));
    }

    // Format prompts
    if (capabilities.prompts && Array.isArray(capabilities.prompts)) {
      formatted.prompts = capabilities.prompts.map((prompt: any) => ({
        name: prompt.name,
        description: prompt.description || 'No description available',
        arguments: prompt.arguments || [],
      }));
    }

    return formatted;
  }

  /**
   * Build the system prompt for MCP decision making
   * @param connectionInfo Information about available MCP connections
   * @param useAdvancedPrompting Whether to use advanced prompting
   * @param locale The locale to use for the prompt
   * @returns The system prompt string
   */
  private buildMCPSystemPrompt(
    connectionInfo: any[],
    useAdvancedPrompting: boolean,
    locale: string,
  ): string {
    // Base prompt
    let systemPrompt = `You are an AI assistant that can determine whether to use Model Context Protocol (MCP) servers to help answer user queries.
Your job is to analyze the user's query and decide if any of the available MCP capabilities would be beneficial.`;

    // If no connections, return basic prompt
    if (connectionInfo.length === 0) {
      return `${systemPrompt}\n\nNo MCP servers are currently available. Please answer the user query directly using your knowledge.`;
    }

    // Add MCP capability information
    systemPrompt += `\n\nThe following MCP servers are available with these capabilities:`;

    // Add each server's information
    for (const { url, capabilities } of connectionInfo) {
      systemPrompt += `\n\n## ${url}\n`;

      if (capabilities.tools && capabilities.tools.length > 0) {
        systemPrompt += '\n### Tools:\n';
        for (const tool of capabilities.tools) {
          systemPrompt += `- ${tool.name}: ${tool.description}\n`;

          if (tool.parameters && tool.parameters.length > 0) {
            systemPrompt += '  Parameters:\n';
            for (const param of tool.parameters) {
              systemPrompt += `    - ${param.name}${param.required ? ' (required)' : ''}: ${param.description || 'No description'}\n`;
            }
          }
        }
      }

      if (capabilities.resources && capabilities.resources.length > 0) {
        systemPrompt += '\n### Resources:\n';
        for (const resource of capabilities.resources) {
          systemPrompt += `- ${resource.name}: ${resource.description}\n`;

          if (resource.uriTemplates && resource.uriTemplates.length > 0) {
            systemPrompt += '  URI Templates:\n';
            for (const template of resource.uriTemplates) {
              systemPrompt += `    - ${template}\n`;
            }
          }
        }
      }

      if (capabilities.prompts && capabilities.prompts.length > 0) {
        systemPrompt += '\n### Prompts:\n';
        for (const prompt of capabilities.prompts) {
          systemPrompt += `- ${prompt.name}: ${prompt.description}\n`;

          if (prompt.arguments && prompt.arguments.length > 0) {
            systemPrompt += '  Arguments:\n';
            for (const arg of prompt.arguments) {
              systemPrompt += `    - ${arg.name}${arg.required ? ' (required)' : ''}: ${arg.description || 'No description'}\n`;
            }
          }
        }
      }
    }

    // Add decision guidelines
    systemPrompt += `\n\n## Analysis Steps:
1. Analyze the user's query to understand what they're asking
2. Determine if any available MCP capabilities would be helpful for answering
3. If using MCP is beneficial, specify which server, capability, and parameters to use
4. If MCP is not needed, answer the query directly using your knowledge

## Response Format:
Please indicate your decision using the following JSON format:

\`\`\`json
{
  "action": "use_mcp" or "none",
  "reasoning": "Your reason for using or not using MCP",
  "server": "The server URL you've chosen (only if action is use_mcp)",
  "capability": "tools", "resources", or "prompts" (only if action is use_mcp),
  "function": "The specific function name to call (only if action is use_mcp)",
  "parameters": {
    // Any required parameters (only if action is use_mcp)
  }
}
\`\`\`

After the JSON, provide your answer to the user's query. If you chose to use MCP,
explain that you'll be using an external service to help answer their question.
If you chose not to use MCP, provide a comprehensive answer based on your knowledge.`;

    // Add advanced guidelines if enabled
    if (useAdvancedPrompting) {
      systemPrompt += `\n\n## Advanced Decision Guidelines:
- Only use MCP when its capabilities clearly add value beyond your existing knowledge
- Consider whether the query really needs external computation, data, or functionality
- For queries requiring up-to-date information, code execution, or specialized tools, prioritize relevant MCP capabilities
- Choose the most appropriate server and capability when multiple options exist
- Make sure to properly format parameters according to the capability's requirements
- If uncertain, prefer answering directly rather than using MCP incorrectly
- Always provide a clear explanation of your decision process`;
    }

    return systemPrompt;
  }

  /**
   * Parse the model output to extract the MCP action decision
   * @param content The model response content
   * @returns The parsed MCP action or null if parsing failed
   */
  private parseMCPAction(content: string): {
    action: 'use_mcp' | 'none';
    reasoning?: string;
    server?: string;
    capability?: 'tools' | 'resources' | 'prompts';
    function?: string;
    parameters?: any;
  } | null {
    try {
      // Extract JSON part from the response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/({[\s\S]*})/);

      if (!jsonMatch) {
        this.engine.logger.warn('No JSON found in model response');
        return null;
      }

      const jsonString = jsonMatch[1];
      const parsedAction = JSON.parse(jsonString);

      // Validate action field
      if (!parsedAction.action || !['use_mcp', 'none'].includes(parsedAction.action)) {
        this.engine.logger.warn(`Invalid action in parsed response: ${parsedAction.action}`);
        return null;
      }

      // If action is 'none', just return that
      if (parsedAction.action === 'none') {
        return {
          action: 'none',
          reasoning: parsedAction.reasoning || 'No specific reason provided',
        };
      }

      // Validate required fields for MCP action
      if (!parsedAction.server || !parsedAction.capability || !parsedAction.function) {
        this.engine.logger.warn('Missing required fields for MCP action');
        return null;
      }

      // Return the validated action
      return {
        action: 'use_mcp',
        reasoning: parsedAction.reasoning || 'No specific reason provided',
        server: parsedAction.server,
        capability: parsedAction.capability,
        function: parsedAction.function,
        parameters: parsedAction.parameters || {},
      };
    } catch (error) {
      this.engine.logger.error(`Error parsing MCP action: ${error}`);
      return null;
    }
  }

  /**
   * Enhanced decision making process for MCP usage
   * Uses a multi-stage approach to improve decision quality
   * @param query The user query
   * @param connectionInfo Information about available connections
   * @param config Skill configuration
   * @returns Decision about whether and how to use MCP
   */
  private async enhancedDecisionProcess(
    query: string,
    connectionInfo: any[],
    config: SkillRunnableConfig,
  ): Promise<{
    shouldUseMCP: boolean;
    mcpAction?: {
      server: string;
      capability: 'tools' | 'resources' | 'prompts';
      function: string;
      parameters: any;
    };
    reasoning: string;
  }> {
    const temperature = (config.configurable.tplConfig?.modelTemperature?.value as number) || 0.2;

    // STAGE 1: Initial decision about whether to use MCP
    const initialPrompt = `
# User Query Analysis
Analyze this user query to determine if any MCP capabilities would be helpful:
"${query}"

## Available MCP Capabilities
${JSON.stringify(connectionInfo, null, 2)}

## Task
Determine if any MCP server capabilities would be valuable for answering this query.
First, analyze what information or functionality is needed to answer properly.
Then check if any available MCP capabilities precisely match this need.

## Response Format
Respond with a JSON object containing:
- "requiresMCP": boolean - whether MCP capabilities would be helpful
- "reasoning": string - detailed reasoning for your decision
- "relevantCapabilities": array of objects with "server", "capability", "function" that might be relevant (if requiresMCP is true)

Be very selective - only use MCP if it provides significant value beyond your knowledge.

\`\`\`json
{
  "requiresMCP": true|false,
  "reasoning": "string",
  "relevantCapabilities": [
    {
      "server": "server URL",
      "capability": "tools|resources|prompts",
      "function": "function name"
    }
  ]
}
\`\`\`
`;

    // Call model for initial decision
    const model = this.engine.chatModel({
      temperature: temperature * 0.5, // Lower temperature for decision making
    });

    const initialResponse = await model.invoke([{ role: 'system', content: initialPrompt }], {
      ...config,
      metadata: {
        ...config.metadata,
        suppressOutput: true,
      },
    });

    // Parse initial decision
    let initialDecision;
    try {
      const jsonMatch =
        (typeof initialResponse.content === 'string' &&
          initialResponse.content.match(/```json\s*([\s\S]*?)\s*```/)) ||
        (typeof initialResponse.content === 'string' &&
          initialResponse.content.match(/({[\s\S]*})/));
      if (jsonMatch) {
        initialDecision = JSON.parse(jsonMatch[1]);
      }
    } catch (error) {
      this.engine.logger.warn(`Failed to parse initial decision: ${error}`);
      // Conservative default
      initialDecision = {
        requiresMCP: false,
        reasoning: 'Failed to parse decision',
        relevantCapabilities: [],
      };
    }

    // If MCP not required or no relevant capabilities found, return early
    if (!initialDecision.requiresMCP || !initialDecision.relevantCapabilities?.length) {
      return {
        shouldUseMCP: false,
        reasoning: initialDecision.reasoning || 'No relevant MCP capabilities found',
      };
    }

    // STAGE 2: Select the best capability and build parameters
    const relevantCapability = initialDecision.relevantCapabilities[0]; // Take the first/most relevant capability

    // Get the server and capability
    const serverUrl = relevantCapability.server;
    const capability = relevantCapability.capability;
    const functionName = relevantCapability.function;

    // Get detailed capability information
    let capabilityDetail = null;

    try {
      const client = this.mcpClients[serverUrl];
      if (client) {
        // Get specific capability details based on type
        switch (capability) {
          case 'tools':
            capabilityDetail = await client.callTool({
              name: 'tool.describe',
              arguments: { name: functionName },
            });
            break;
          case 'resources':
            // For resources, we don't have a direct "describe" method,
            // so use information from our cached capabilities
            capabilityDetail = this.serverCapabilitiesCache[serverUrl]?.resources?.resources?.find(
              (r: any) => r.name === functionName,
            );
            break;
          case 'prompts':
            // For prompts, we could try to get the prompt, but that would execute it
            // Instead, use the information from listPrompts
            capabilityDetail = this.serverCapabilitiesCache[serverUrl]?.prompts?.prompts?.find(
              (p: any) => p.name === functionName,
            );
            break;
        }
      }
    } catch (error) {
      this.engine.logger.warn(`Failed to get capability details: ${error}`);
    }

    // Build parameter construction prompt
    const parameterPrompt = `
# Parameter Construction for MCP Call
User query: "${query}"

## Selected MCP Capability
Server: ${serverUrl}
Capability: ${capability}
Function: ${functionName}

## Capability Details
${JSON.stringify(capabilityDetail, null, 2)}

## Task
Construct the appropriate parameters to call this function based on the user query.
Be precise and follow the parameter schema exactly as defined in the capability details.
Omit any parameters that cannot be determined from the user query or context.

## Response Format
JSON object containing only the parameters:
\`\`\`json
{
  // parameter key-value pairs here
}
\`\`\`
`;

    // Call model to construct parameters
    const parameterResponse = await model.invoke([{ role: 'system', content: parameterPrompt }], {
      ...config,
      metadata: {
        ...config.metadata,
        suppressOutput: true,
      },
    });

    // Parse parameters
    let parameters = {};
    try {
      const jsonMatch =
        (typeof parameterResponse.content === 'string' &&
          parameterResponse.content.match(/```json\s*([\s\S]*?)\s*```/)) ||
        (typeof parameterResponse.content === 'string' &&
          parameterResponse.content.match(/({[\s\S]*})/));
      if (jsonMatch) {
        parameters = JSON.parse(jsonMatch[1]);
      }
    } catch (error) {
      this.engine.logger.warn(`Failed to parse parameters: ${error}`);
    }

    // Return final decision
    return {
      shouldUseMCP: true,
      mcpAction: {
        server: serverUrl,
        capability: capability as 'tools' | 'resources' | 'prompts',
        function: functionName,
        parameters,
      },
      reasoning: initialDecision.reasoning || 'MCP capability matches user needs',
    };
  }

  /**
   * Execute an MCP action
   * @param action The MCP action to execute
   * @param config Skill configuration
   * @returns Result of the MCP action
   */
  private async executeMCPAction(
    action: {
      server: string;
      capability: 'tools' | 'resources' | 'prompts';
      function: string;
      parameters: any;
    },
    config: SkillRunnableConfig,
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const { server, capability, function: funcName, parameters } = action;

    // Get client (or try to connect if not already connected)
    let client = this.mcpClients[server];
    if (!client) {
      this.engine.logger.log(`Client not found for ${server}, attempting to connect`);
      const { client: newClient, error } = await this.connectToMCPServer(server);
      if (!newClient) {
        return {
          success: false,
          error: `Failed to connect to MCP server at ${server}: ${error}`,
        };
      }
      client = newClient;
      this.mcpClients[server] = newClient;
    }

    try {
      // Execute the appropriate MCP action based on capability type
      switch (capability) {
        case 'tools':
          // Call a tool
          this.engine.logger.log(
            `Calling tool ${funcName} on ${server} with parameters:`,
            parameters,
          );
          const toolResult = await client.callTool({
            name: funcName,
            arguments: parameters,
          });
          return {
            success: true,
            result: toolResult,
          };

        case 'resources':
          // Read a resource
          // For resources, parameters might be parts of the URI
          let resourceUri = funcName;

          // If the function name is a URI template, we need to replace parameters
          if (resourceUri.includes('{') && resourceUri.includes('}')) {
            // Simple template substitution
            Object.entries(parameters).forEach(([key, value]) => {
              resourceUri = resourceUri.replace(`{${key}}`, String(value));
            });
          } else if (parameters.uri) {
            // If a complete URI is provided in parameters
            resourceUri = parameters.uri;
          }

          this.engine.logger.log(`Reading resource ${resourceUri} from ${server}`);
          const resourceResult = await client.readResource({
            uri: resourceUri,
          });
          return {
            success: true,
            result: resourceResult,
          };

        case 'prompts':
          // Get and execute a prompt
          this.engine.logger.log(
            `Getting prompt ${funcName} from ${server} with arguments:`,
            parameters,
          );
          const promptResult = await client.getPrompt({
            name: funcName,
            arguments: parameters,
          });
          return {
            success: true,
            result: promptResult,
          };

        default:
          return {
            success: false,
            error: `Unsupported capability: ${capability}`,
          };
      }
    } catch (error: any) {
      this.engine.logger.error(`Error executing MCP action: ${error}`);
      return {
        success: false,
        error: `Failed to execute MCP action: ${error.message}`,
      };
    }
  }

  /**
   * Execute an MCP action with retries
   * @param action The MCP action to execute
   * @param config Skill configuration
   * @param maxRetries Maximum number of retries
   * @returns Result of the MCP action
   */
  private async executeMCPActionWithRetry(
    action: {
      server: string;
      capability: 'tools' | 'resources' | 'prompts';
      function: string;
      parameters: any;
    },
    config: SkillRunnableConfig,
    maxRetries = 2,
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    let lastError = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // If not the first attempt, log retry information
        if (attempt > 0) {
          this.engine.logger.log(`Retry attempt ${attempt} for MCP action`);
          this.emitEvent(
            {
              log: {
                key: 'mcp_retry',
                titleArgs: {
                  attempt,
                  maxRetries,
                },
              },
            },
            config,
          );

          // If previous failure was connection-related, try to refresh the connection
          if (lastError.includes('connect') || lastError.includes('network')) {
            await this.reloadMCPClient(action.server);
          }
        }

        // Execute the action
        const result = await this.executeMCPAction(action, config);

        // If successful, return the result
        if (result.success) {
          return result;
        }

        // Otherwise, record the error for the next retry
        lastError = result.error || 'Unknown error';

        // Don't retry certain types of errors (permission, parameter issues)
        if (
          lastError.includes('permission') ||
          lastError.includes('unauthorized') ||
          lastError.includes('parameter') ||
          lastError.includes('invalid argument') ||
          lastError.includes('not found')
        ) {
          return result;
        }
      } catch (error: any) {
        lastError = error.message;
      }

      // Wait briefly before the next retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = 1000 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries failed
    return {
      success: false,
      error: `Failed after ${maxRetries + 1} attempts. Last error: ${lastError}`,
    };
  }

  /**
   * Process and format the MCP action result
   * @param result The raw MCP action result
   * @param query The original user query
   * @param config Skill configuration
   * @returns Processed result suitable for returning to the user
   */
  private async processMCPResult(
    result: { success: boolean; result?: any; error?: string },
    query: string,
    config: SkillRunnableConfig,
  ): Promise<BaseMessage> {
    const { locale = 'en' } = config.configurable;

    // If execution failed, generate an error message
    if (!result.success) {
      const errorPrompt = `
# Error Processing
You attempted to use an MCP server to help answer this user query:
"${query}"

However, there was an error: ${result.error}

## Task
Create a helpful response that:
1. Acknowledges the error
2. Explains what happened in user-friendly terms
3. Attempts to answer the original query using your knowledge
4. The response should be in ${locale === 'zh-CN' ? 'Chinese' : 'English'}

## Response Format
Your complete response to the user.
`;

      const model = this.engine.chatModel({
        temperature: 0.7, // Higher temperature for creative recovery
      });

      const errorResponse = await model.invoke([{ role: 'system', content: errorPrompt }]);

      return errorResponse;
    }

    // For successful execution, format the result
    let rawContent = '';

    // Extract content based on result type
    if (typeof result.result === 'string') {
      rawContent = result.result;
    } else if (typeof result.result === 'object') {
      if (result.result.content) {
        // Handle content array (typical for tool responses)
        if (Array.isArray(result.result.content)) {
          rawContent = result.result.content
            .map((item: any) => {
              if (item.type === 'text') return item.text || '';
              if (item.type === 'image') return `[Image: ${item.alt || 'No description'}]`;
              return JSON.stringify(item);
            })
            .join('\n');
        } else {
          rawContent = String(result.result.content);
        }
      } else if (result.result.contents) {
        // Handle contents array (typical for resource responses)
        if (Array.isArray(result.result.contents)) {
          rawContent = result.result.contents
            .map((item: any) => item.text || JSON.stringify(item))
            .join('\n\n');
        }
      } else if (result.result.messages) {
        // Handle messages array (typical for prompt responses)
        if (Array.isArray(result.result.messages)) {
          rawContent = result.result.messages
            .map((msg: any) => {
              const role = msg.role || 'system';
              if (typeof msg.content === 'string') {
                return `${role}: ${msg.content}`;
              } else if (Array.isArray(msg.content)) {
                return `${role}: ${msg.content
                  .map((c: any) => {
                    if (c.type === 'text') return c.text;
                    return JSON.stringify(c);
                  })
                  .join('\n')}`;
              } else if (typeof msg.content === 'object' && msg.content.type === 'text') {
                return `${role}: ${msg.content.text}`;
              }
              return `${role}: ${JSON.stringify(msg.content)}`;
            })
            .join('\n\n');
        }
      } else {
        // Fall back to stringifying the entire object
        rawContent = JSON.stringify(result.result, null, 2);
      }
    } else {
      // For any other type
      rawContent = String(result.result);
    }

    // Use the model to process and format the raw result
    const processingPrompt = `
# Format MCP Result
You used an MCP server to help answer this user query:
"${query}"

## Raw MCP Result
${rawContent}

## Task
Create a helpful response that:
1. Incorporates the information from the MCP result
2. Presents it in a clear, well-structured format
3. Adds any necessary context or explanations
4. Directly answers the user's original query
5. The response should be in ${locale === 'zh-CN' ? 'Chinese' : 'English'}

## Response Format
Your complete response to the user.
`;

    const model = this.engine.chatModel({
      temperature: 0.5, // Balanced temperature for formatting
    });

    const formattedResponse = await model.invoke([{ role: 'system', content: processingPrompt }]);

    return formattedResponse;
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
  ): Promise<Partial<GraphState>> => {
    const { messages = [], images = [] } = state;
    const { locale = 'en', tplConfig } = config.configurable;

    // Get configuration values
    const mcpServersString =
      (tplConfig?.mcpServers?.value as string) ||
      'https://mcp.semgrep.ai/sse,https://remote.mcpservers.org/sequentialthinking/mcp,https://remote.mcpservers.org/edgeone-pages/mcp,https://remote.mcpservers.org/fetch/mcp';
    const serverUrls = mcpServersString
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    const autoConnect = tplConfig?.autoConnect?.value !== false;
    const useAdvancedPrompting = tplConfig?.useAdvancedPrompting?.value !== false;
    const retryCount = Number(tplConfig?.retryCount?.value) || 2;
    const modelTemperature = Number(tplConfig?.modelTemperature?.value) || 0.2;

    // Set initial step
    config.metadata.step = { name: 'analyzeQuery' };

    // Process the query
    const { optimizedQuery, query, usedChatHistory, mentionedContext, remainingTokens } =
      await processQuery({
        config,
        ctxThis: this,
        state,
      });

    // Track connection information
    let connectionInfo = [];

    // Connect to servers if auto-connect is enabled
    if (autoConnect && serverUrls.length > 0) {
      config.metadata.step = { name: 'connectToMCPServers' };

      // Notify about connection
      this.emitEvent(
        {
          log: {
            key: 'connecting_mcp_servers',
            titleArgs: {
              count: serverUrls.length,
            },
          },
        },
        config,
      );

      // Connect to all servers
      const { connections, errors } = await this.connectToAllServers(serverUrls);

      // Format connection information for prompts
      connectionInfo = connections.map(({ url, capabilities }) => ({
        url,
        capabilities: this.formatCapabilities(capabilities),
      }));

      // Log connection errors
      if (errors.length > 0) {
        const errorMessage = `Failed to connect to ${errors.length} MCP server(s): ${errors.map((e) => e.url).join(', ')}`;
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

      this.engine.logger.log(`Successfully connected to ${connections.length} MCP server(s)`);
    }

    // If no servers are connected, answer directly
    if (connectionInfo.length === 0) {
      this.emitEvent(
        {
          log: {
            key: 'no_mcp_servers',
          },
        },
        config,
      );

      // Prepare context for direct answering
      config.metadata.step = { name: 'prepareContext' };

      const { contextStr, sources } = await prepareContext(
        {
          query: optimizedQuery,
          mentionedContext,
          maxTokens: remainingTokens,
          enableMentionedContext: true,
        },
        {
          config,
          ctxThis: this,
          state,
          tplConfig: config.configurable.tplConfig,
        },
      );

      // Use simple module for direct answering
      const module = {
        buildSystemPrompt: (locale, needPrepareContext, customInstructions) =>
          'You are a helpful assistant. Answer the user query based on your knowledge and the provided context if any.',
        buildContextUserPrompt: (context, needPrepareContext) => context,
        buildUserPrompt: ({
          originalQuery,
          optimizedQuery,
          rewrittenQueries,
          locale,
          customInstructions,
        }) => originalQuery,
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
        },
      });

      return { messages: [responseMessage] };
    }

    // Set decision step
    config.metadata.step = { name: 'decideOnMCPUsage' };

    // Use enhanced decision process for better accuracy
    const decision = await this.enhancedDecisionProcess(query, connectionInfo, config);

    // If decided not to use MCP, answer directly
    if (!decision.shouldUseMCP || !decision.mcpAction) {
      this.emitEvent(
        {
          log: {
            key: 'mcp_decision_not_using',
            titleArgs: {
              reason: decision.reasoning,
            },
          },
        },
        config,
      );

      // Prepare context for direct answering
      config.metadata.step = { name: 'prepareContext' };

      const { contextStr, sources } = await prepareContext(
        {
          query: optimizedQuery,
          mentionedContext,
          maxTokens: remainingTokens,
          enableMentionedContext: true,
        },
        {
          config,
          ctxThis: this,
          state,
          tplConfig: config.configurable.tplConfig,
        },
      );

      // Use simple module for direct answering
      const module = {
        buildSystemPrompt: (locale, needPrepareContext, customInstructions) =>
          'You are a helpful assistant. Answer the user query based on your knowledge and the provided context if any.',
        buildContextUserPrompt: (context, needPrepareContext) => context,
        buildUserPrompt: ({
          originalQuery,
          optimizedQuery,
          rewrittenQueries,
          locale,
          customInstructions,
        }) => originalQuery,
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
      const model = this.engine.chatModel({
        temperature: modelTemperature,
      });
      const responseMessage = await model.invoke(requestMessages, {
        ...config,
        metadata: {
          ...config.metadata,
        },
      });

      return { messages: [responseMessage] };
    }

    // If using MCP, execute the action
    this.emitEvent(
      {
        log: {
          key: 'mcp_decision_using',
          titleArgs: {
            server: decision.mcpAction.server,
            capability: decision.mcpAction.capability,
            function: decision.mcpAction.function,
          },
        },
      },
      config,
    );

    // Set execution step
    config.metadata.step = { name: 'executeMCPAction' };

    // Execute MCP action with retries
    const result = await this.executeMCPActionWithRetry(decision.mcpAction, config, retryCount);

    // Store result in state for potential later use
    const mcpActionResult = {
      success: result.success,
      result: result.result,
      error: result.error,
      action: decision.mcpAction,
    };

    // Set processing step
    config.metadata.step = { name: 'processMCPResult' };

    // Process and format the result
    const responseMessage = await this.processMCPResult(result, query, config);

    return {
      messages: [responseMessage],
      ...(mcpActionResult ? { result: mcpActionResult } : {}),
    };
  };

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
