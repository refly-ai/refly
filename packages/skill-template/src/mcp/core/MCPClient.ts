import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

import { StreamableHTTPClientTransport } from '../transport/StreamableHTTPTransport';
import {
  GetMCPPromptResponse,
  GetResourceResponse,
  MCPCallToolResponse,
  MCPPrompt,
  MCPResource,
  MCPServerConfig,
  MCPTool,
} from './types';

/**
 * MCP客户端类
 * 提供与MCP服务器交互的核心功能
 */
export class MCPClient {
  private clients: Map<string, Client> = new Map();
  private config: Map<string, MCPServerConfig> = new Map();
  private serverTools: Map<string, MCPTool[]> = new Map();

  /**
   * 连接到MCP服务器
   * @param serverConfig 服务器配置
   * @returns 连接结果
   */
  async connect(serverConfig: MCPServerConfig): Promise<boolean> {
    try {
      const { id, type } = serverConfig;

      // 检查是否已连接
      if (this.clients.has(id)) {
        console.log(`[MCPClient] Already connected to server ${id}`);
        return true;
      }

      console.log(`[MCPClient] Connecting to server ${id} (${type})`);
      this.config.set(id, serverConfig);

      // Create client instance
      const client = new Client({
        name: 'refly-mcp-connector',
        version: '1.0.0',
      });

      // 根据不同连接类型创建客户端
      switch (type) {
        case 'streamableHttp': {
          if (!serverConfig.baseUrl) {
            throw new Error(`Missing baseUrl for streamableHttp server ${id}`);
          }

          const url = new URL(serverConfig.baseUrl);

          // 创建HTTP传输层
          const transport = new StreamableHTTPClientTransport(url);

          await client.connect(transport);
          break;
        }
        case 'sse': {
          if (!serverConfig.baseUrl) {
            throw new Error(`Missing baseUrl for SSE server ${id}`);
          }

          // 创建SSE传输层
          const transport = new SSEClientTransport(new URL(serverConfig.baseUrl));

          await client.connect(transport);
          break;
        }

        default:
          throw new Error(`Unsupported server type: ${type}`);
      }

      this.clients.set(id, client);

      // 预加载工具列表
      await this.loadServerTools(serverConfig);

      console.log(`[MCPClient] Connected to server ${id} (${type})`);
      return true;
    } catch (error) {
      console.error(`[MCPClient] Error connecting to server ${serverConfig.id}:`, error);
      return false;
    }
  }

  /**
   * 断开与MCP服务器的连接
   * @param serverId 服务器ID
   */
  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.close();
      this.clients.delete(serverId);
      this.serverTools.delete(serverId);
      this.config.delete(serverId);
      console.log(`[MCPClient] Disconnected from server ${serverId}`);
    }
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    for (const [serverId, client] of this.clients.entries()) {
      await client.close();
      console.log(`[MCPClient] Disconnected from server ${serverId}`);
    }
    this.clients.clear();
    this.serverTools.clear();
    this.config.clear();
  }

  /**
   * 列出服务器的工具（内部实现）
   * @param server 服务器配置
   * @returns 工具列表
   */
  private async listToolsInternal(server: MCPServerConfig): Promise<MCPTool[]> {
    const { id, name } = server;
    const client = this.clients.get(id);

    if (!client) {
      throw new Error(`Not connected to server ${id}`);
    }

    try {
      const response = await client.listTools({});

      if (!response.tools) {
        return [];
      }

      // 转换为MCPTool格式
      return response.tools.map((tool) => ({
        id: `${id}:${tool.name}`,
        serverId: id,
        serverName: name,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema || tool.parameters,
      }));
    } catch (error) {
      console.error(`[MCPClient] Error listing tools for server ${id}:`, error);
      return [];
    }
  }

  /**
   * 加载服务器的工具列表
   * @param server 服务器配置
   */
  private async loadServerTools(server: MCPServerConfig): Promise<void> {
    try {
      const tools = await this.listTools(server);
      this.serverTools.set(server.id, tools);
    } catch (error) {
      console.error(`[MCPClient] Error loading tools for server ${server.id}:`, error);
      this.serverTools.set(server.id, []);
    }
  }

  /**
   * 列出服务器的工具
   * @param server 服务器配置
   * @param forceRefresh 是否强制刷新缓存
   * @returns 工具列表
   */
  async listTools(server: MCPServerConfig): Promise<MCPTool[]> {
    const tools = await this.listToolsInternal(server);
    this.serverTools.set(server.id, tools);
    return tools;
  }

  /**
   * 获取所有服务器的工具
   * @returns 所有工具列表
   */
  getAllTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    for (const tools of this.serverTools.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }

  /**
   * 根据工具ID查找工具
   * @param toolId 工具ID (格式: serverId:toolName)
   * @returns 工具对象
   */
  findToolById(toolId: string): MCPTool | undefined {
    for (const tools of this.serverTools.values()) {
      const tool = tools.find((t) => t.id === toolId);
      if (tool) {
        return tool;
      }
    }
    return undefined;
  }

  /**
   * 根据服务器ID和工具名称查找工具
   * @param serverId 服务器ID
   * @param toolName 工具名称
   * @returns 工具对象
   */
  findTool(serverId: string, toolName: string): MCPTool | undefined {
    const tools = this.serverTools.get(serverId);
    if (!tools) {
      return undefined;
    }
    return tools.find((t) => t.name === toolName);
  }

  /**
   * 调用工具
   * @param options 调用选项
   * @returns 调用结果
   */
  async callTool(options: {
    server: MCPServerConfig | string;
    name: string;
    args: Record<string, any>;
  }): Promise<MCPCallToolResponse> {
    const { name, args } = options;

    // 获取服务器配置
    let serverConfig: MCPServerConfig;
    if (typeof options.server === 'string') {
      const config = this.config.get(options.server);
      if (!config) {
        throw new Error(`Unknown server ID: ${options.server}`);
      }
      serverConfig = config;
    } else {
      serverConfig = options.server;
    }

    const { id } = serverConfig;
    const client = this.clients.get(id);

    if (!client) {
      // 尝试连接
      const connected = await this.connect(serverConfig);
      if (!connected) {
        throw new Error(`Failed to connect to server ${id}`);
      }
    }

    try {
      const response = await client!.callTool({
        name,
        arguments: args,
      });

      return {
        isError: !!response.isError,
        content: (response.content as Array<{ type: string; text?: string }>) || [],
      };
    } catch (error) {
      console.error(`[MCPClient] Error calling tool ${name} on server ${id}:`, error);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error calling tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  /**
   * 列出服务器的提示（内部实现）
   * @param server 服务器配置
   * @returns 提示列表
   */
  private async listPromptsInternal(server: MCPServerConfig): Promise<MCPPrompt[]> {
    const { id, name } = server;
    const client = this.clients.get(id);

    if (!client) {
      throw new Error(`Not connected to server ${id}`);
    }

    try {
      const response = await client.listPrompts({});

      if (!response.prompts) {
        return [];
      }

      // 转换为MCPPrompt格式
      return response.prompts.map((prompt) => ({
        id: prompt.id as string,
        serverId: id,
        serverName: name,
        name: prompt.name as string,
        description: prompt.description as string,
        schema: prompt.schema,
      }));
    } catch (error) {
      console.error(`[MCPClient] Error listing prompts for server ${id}:`, error);
      return [];
    }
  }

  /**
   * 列出服务器的提示
   * @param server 服务器配置
   * @param forceRefresh 是否强制刷新缓存
   * @returns 提示列表
   */
  async listPrompts(server: MCPServerConfig): Promise<MCPPrompt[]> {
    return await this.listPromptsInternal(server);
  }

  /**
   * 获取提示（内部实现）
   * @param server 服务器配置
   * @param id 提示ID
   * @returns 提示内容
   */
  private async getPromptInternal(
    server: MCPServerConfig,
    id: string,
  ): Promise<GetMCPPromptResponse> {
    const client = this.clients.get(server.id);

    if (!client) {
      throw new Error(`Not connected to server ${server.id}`);
    }

    try {
      const response = await client.getPrompt({ name: id });

      return {
        content: response.content as string,
        ...response,
      };
    } catch (error) {
      console.error(`[MCPClient] Error getting prompt ${id} from server ${server.id}:`, error);
      throw error;
    }
  }

  /**
   * 获取提示
   * @param server 服务器配置
   * @param id 提示ID
   * @param forceRefresh 是否强制刷新缓存
   * @returns 提示内容
   */
  async getPrompt(server: MCPServerConfig, id: string): Promise<GetMCPPromptResponse> {
    return await this.getPromptInternal(server, id);
  }

  /**
   * 列出服务器的资源（内部实现）
   * @param server 服务器配置
   * @returns 资源列表
   */
  private async listResourcesInternal(server: MCPServerConfig): Promise<MCPResource[]> {
    const { id, name } = server;
    const client = this.clients.get(id);

    if (!client) {
      throw new Error(`Not connected to server ${id}`);
    }

    try {
      const response = await client.listResources({});

      if (!response.resources) {
        return [];
      }

      // 转换为MCPResource格式
      return response.resources.map((resource) => ({
        serverId: id,
        serverName: name,
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        size: resource.size as number,
      }));
    } catch (error) {
      console.error(`[MCPClient] Error listing resources for server ${id}:`, error);
      return [];
    }
  }

  /**
   * 列出服务器的资源
   * @param server 服务器配置
   * @param forceRefresh 是否强制刷新缓存
   * @returns 资源列表
   */
  async listResources(server: MCPServerConfig): Promise<MCPResource[]> {
    return await this.listResourcesInternal(server);
  }

  /**
   * 获取资源（内部实现）
   * @param server 服务器配置
   * @param uri 资源URI
   * @returns 资源内容
   */
  private async getResourceInternal(
    server: MCPServerConfig,
    uri: string,
  ): Promise<GetResourceResponse> {
    const { id, name } = server;
    const client = this.clients.get(id);

    if (!client) {
      throw new Error(`Not connected to server ${id}`);
    }

    try {
      const response = { resources: [] };

      // 转换为MCPResource格式
      const contents: MCPResource[] = response.resources.map((resource) => ({
        serverId: id,
        serverName: name,
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        size: resource.size,
        text: resource.text,
        blob: resource.blob,
      }));

      return { contents };
    } catch (error) {
      console.error(`[MCPClient] Error getting resource ${uri} from server ${id}:`, error);
      throw error;
    }
  }

  /**
   * 获取资源
   * @param server 服务器配置
   * @param uri 资源URI
   * @param forceRefresh 是否强制刷新缓存
   * @returns 资源内容
   */
  async getResource(server: MCPServerConfig, uri: string): Promise<GetResourceResponse> {
    return await this.getResourceInternal(server, uri);
  }
}
