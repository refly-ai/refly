# MCP 集成 Skill 开发详细指南

根据需求，本文档详细介绍如何开发一个能够与 MCP 服务器交互的 Skill，使大模型能够智能决策是否调用特定的 MCP 服务来解决用户问题。

## 一、MCP 集成 Skill 的总体架构

首先，让我们了解整体架构：

```
用户查询 → Skill 分析 → MCP 服务器发现 → 模型决策 → MCP 客户端调用 → 结果处理 → 返回响应
```

这个 Skill 将负责：
1. 分析用户查询
2. 发现并连接到可用的 MCP 服务器
3. 让大模型决策是否及如何调用 MCP 服务
4. 执行调用并处理结果
5. 返回格式化的响应

## 二、MCP 集成 Skill 的详细实现

### 1. 创建基本 Skill 结构

首先创建一个新文件 `packages/skill-template/src/skills/mcp-connector.ts`：

```typescript
import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';
import { GraphState } from '../scheduler/types';

// 导入 MCP SDK
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// 工具函数
import { buildFinalRequestMessages } from '../scheduler/utils/message';
import { processQuery } from '../scheduler/utils/queryProcessor';

/**
 * MCP 连接器技能
 * 连接到 MCP 服务器并调用适当的功能来解决用户查询
 */
export class MCPConnector extends BaseSkill {
  name = 'mcpConnector';
  
  icon: Icon = { type: 'emoji', value: '🔌' };
  
  displayName = {
    en: 'MCP Connector',
    'zh-CN': 'MCP 连接器'
  };
  
  description = 'Connect to MCP servers and use their capabilities to solve user queries';
  
  // MCP 客户端实例缓存
  private mcpClients: Record<string, Client> = {};
  
  // 配置项
  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'mcpServers',
        inputMode: 'inputTextArea',
        defaultValue: '',
        labelDict: {
          en: 'MCP Servers',
          'zh-CN': 'MCP 服务器'
        },
        descriptionDict: {
          en: 'Comma-separated list of MCP server URLs',
          'zh-CN': '以逗号分隔的 MCP 服务器 URL 列表'
        }
      },
      {
        key: 'autoConnect',
        inputMode: 'switch',
        defaultValue: true,
        labelDict: {
          en: 'Auto Connect',
          'zh-CN': '自动连接'
        },
        descriptionDict: {
          en: 'Automatically connect to MCP servers',
          'zh-CN': '自动连接到 MCP 服务器'
        }
      },
      {
        key: 'useAdvancedPrompting',
        inputMode: 'switch',
        defaultValue: true,
        labelDict: {
          en: 'Use Advanced Prompting',
          'zh-CN': '使用高级提示'
        }
      }
    ]
  };
  
  // 调用配置
  invocationConfig: SkillInvocationConfig = {};
  
  // 输入模式定义
  schema = z.object({
    query: z.string().optional().describe('User query for MCP interaction'),
    images: z.array(z.string()).optional().describe('Images that might be relevant')
  });
  
  // 状态图定义
  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs
  };
  
  // 核心方法实现...
  
  toRunnable(): Runnable<any, any, RunnableConfig> {
    // 工作流定义...
  }
}
```

### 2. 实现 MCP 客户端连接逻辑

添加 MCP 客户端连接和功能发现逻辑：

```typescript
/**
 * 连接到 MCP 服务器并发现其功能
 */
private async connectToMCPServer(serverUrl: string): Promise<{
  client: Client;
  capabilities: any;
  error?: string;
}> {
  try {
    // 首先尝试使用 StreamableHTTP 传输 (新版)
    const client = new Client({
      name: 'refly-mcp-connector',
      version: '1.0.0'
    });

    const baseUrl = new URL(serverUrl);
    
    try {
      // 尝试使用新的 StreamableHTTP 传输
      const transport = new StreamableHTTPClientTransport(baseUrl);
      await client.connect(transport);
      this.engine.logger.log(`Connected to MCP server at ${serverUrl} using StreamableHTTP`);
    } catch (error) {
      // 降级到 SSE 传输 (旧版)
      this.engine.logger.log(`Failed to connect using StreamableHTTP, trying SSE: ${error}`);
      const sseTransport = new SSEClientTransport(baseUrl);
      await client.connect(sseTransport);
      this.engine.logger.log(`Connected to MCP server at ${serverUrl} using SSE`);
    }
    
    // 获取服务器功能
    const capabilities = client.serverInfo?.capabilities || {};
    
    // 缓存客户端实例
    this.mcpClients[serverUrl] = client;
    
    return { client, capabilities };
  } catch (error) {
    this.engine.logger.error(`Failed to connect to MCP server at ${serverUrl}: ${error}`);
    return {
      client: null,
      capabilities: {},
      error: `Failed to connect to ${serverUrl}: ${error.message}`
    };
  }
}

/**
 * 连接到所有配置的 MCP 服务器
 */
private async connectToAllServers(serverUrls: string[]): Promise<{
  connections: Array<{ url: string; client: Client; capabilities: any }>;
  errors: Array<{ url: string; error: string }>;
}> {
  const connections = [];
  const errors = [];
  
  for (const url of serverUrls) {
    const { client, capabilities, error } = await this.connectToMCPServer(url.trim());
    
    if (client) {
      connections.push({ url, client, capabilities });
    } else if (error) {
      errors.push({ url, error });
    }
  }
  
  return { connections, errors };
}
```

### 3. 实现核心分析和处理逻辑

添加主要的处理逻辑，使大模型能够做出是否调用 MCP 服务的决策：

```typescript
/**
 * 主要处理方法
 */
callMCPConnector = async (
  state: GraphState,
  config: SkillRunnableConfig
): Promise<Partial<GraphState>> => {
  const { messages = [], images = [] } = state;
  const { locale = 'en', tplConfig } = config.configurable;
  
  // 设置当前步骤
  config.metadata.step = { name: 'analyzeQuery' };
  
  // 处理查询
  const {
    optimizedQuery,
    query,
    usedChatHistory
  } = await processQuery({
    config,
    ctxThis: this,
    state
  });
  
  // 解析配置的 MCP 服务器
  const mcpServersString = (tplConfig?.mcpServers?.value as string) || '';
  const serverUrls = mcpServersString.split(',')
    .map(url => url.trim())
    .filter(url => url.length > 0);
  
  const autoConnect = tplConfig?.autoConnect?.value !== false;
  const useAdvancedPrompting = tplConfig?.useAdvancedPrompting?.value !== false;
  
  // 连接信息
  let connectionInfo = [];
  let serverCapabilities = {};
  
  // 如果设置了自动连接，连接到所有服务器
  if (autoConnect && serverUrls.length > 0) {
    config.metadata.step = { name: 'connectToMCPServers' };
    
    // 连接到所有服务器
    const { connections, errors } = await this.connectToAllServers(serverUrls);
    
    // 将连接信息转换为用于提示的格式
    connectionInfo = connections.map(({ url, capabilities }) => ({
      url,
      capabilities: this.formatCapabilities(capabilities)
    }));
    
    // 记录错误
    if (errors.length > 0) {
      this.engine.logger.warn(`Failed to connect to some MCP servers: ${JSON.stringify(errors)}`);
      this.emitEvent({
        log: {
          message: `Failed to connect to ${errors.length} MCP servers`,
          level: 'warn'
        }
      }, config);
    }
    
    // 保存服务器功能用于后续处理
    serverCapabilities = Object.fromEntries(
      connections.map(({ url, capabilities }) => [url, capabilities])
    );
  }
  
  // 设置分析步骤
  config.metadata.step = { name: 'analyzeCapabilities' };
  
  // 构建系统提示词
  const systemPromptContent = this.buildMCPSystemPrompt(
    connectionInfo,
    useAdvancedPrompting,
    locale
  );
  
  // 构建提示模板
  const module = {
    buildSystemPrompt: () => systemPromptContent,
    buildContextUserPrompt: (context: string) => context,
    buildUserPrompt: (query: string) => query
  };
  
  // 构建最终请求消息
  const requestMessages = buildFinalRequestMessages({
    module,
    locale,
    chatHistory: usedChatHistory,
    messages,
    needPrepareContext: false,
    context: '',
    images,
    originalQuery: query,
    optimizedQuery,
    modelInfo: config?.configurable?.modelInfo
  });
  
  // 设置分析步骤
  config.metadata.step = { name: 'analyzeWithLLM' };
  
  // 调用模型
  const model = this.engine.chatModel({
    temperature: 0.2,  // 低温度以获得更确定的决策
    maxTokens: 2500
  });
  
  const responseMessage = await model.invoke(requestMessages, {
    ...config,
    metadata: {
      ...config.metadata,
      suppressOutput: true  // 抑制输出，因为我们需要解析并执行指令
    }
  });
  
  // 设置执行步骤
  config.metadata.step = { name: 'executeMCPAction' };
  
  // 解析模型的决策
  const mcpAction = await this.parseMCPAction(responseMessage.content);
  
  // 如果模型决定不使用 MCP，返回原始响应
  if (!mcpAction || mcpAction.action === 'none') {
    return { messages: [responseMessage] };
  }
  
  // 执行 MCP 操作
  const result = await this.executeMCPAction(
    mcpAction,
    serverCapabilities,
    config
  );
  
  // 设置结果处理步骤
  config.metadata.step = { name: 'processMCPResult' };
  
  // 处理并格式化结果
  const finalResponse = await this.formatMCPResult(
    result,
    responseMessage.content,
    query,
    config
  );
  
  return { messages: [finalResponse] };
};
```

### 4. 实现 MCP 功能解析和提示词构建

添加提示词构建和功能解析功能：

```typescript
/**
 * 格式化 MCP 服务器功能为提示词友好的格式
 */
private formatCapabilities(capabilities: any): any {
  const formatted = { ...capabilities };
  
  // 格式化工具信息
  if (capabilities.tools) {
    formatted.tools = Object.entries(capabilities.tools || {}).map(([name, tool]) => ({
      name,
      ...tool
    }));
  }
  
  // 格式化资源信息
  if (capabilities.resources) {
    formatted.resources = Object.entries(capabilities.resources || {}).map(([name, resource]) => ({
      name,
      ...resource
    }));
  }
  
  // 格式化提示词信息
  if (capabilities.prompts) {
    formatted.prompts = true;  // 简化，仅表明提示词功能可用
  }
  
  return formatted;
}

/**
 * 构建 MCP 系统提示词
 */
private buildMCPSystemPrompt(
  connectionInfo: any[],
  useAdvancedPrompting: boolean,
  locale: string
): string {
  const isZhCN = locale === 'zh-CN';
  
  // 基础提示词
  let systemPrompt = isZhCN
    ? `你是一个专业的 AI 助手，能够决定是否使用 Model Context Protocol (MCP) 服务器来帮助回答用户的查询。`
    : `You are an AI assistant that can determine whether to use Model Context Protocol (MCP) servers to help answer user queries.`;
  
  // 如果没有连接信息，返回基础提示词
  if (connectionInfo.length === 0) {
    return systemPrompt + (isZhCN
      ? `\n\n目前没有可用的 MCP 服务器。请直接回答用户的查询。`
      : `\n\nNo MCP servers are currently available. Please answer the user query directly.`);
  }
  
  // 添加 MCP 功能信息
  systemPrompt += isZhCN
    ? `\n\n以下是可用的 MCP 服务器及其功能：`
    : `\n\nThe following MCP servers are available with these capabilities:`;
  
  // 添加每个服务器的信息
  connectionInfo.forEach(({ url, capabilities }) => {
    systemPrompt += `\n\n## ${url}\n`;
    
    if (capabilities.tools && capabilities.tools.length > 0) {
      systemPrompt += isZhCN ? '\n### 工具：\n' : '\n### Tools:\n';
      capabilities.tools.forEach(tool => {
        systemPrompt += `- ${tool.name}: ${tool.description || 'No description'}\n`;
      });
    }
    
    if (capabilities.resources && capabilities.resources.length > 0) {
      systemPrompt += isZhCN ? '\n### 资源：\n' : '\n### Resources:\n';
      capabilities.resources.forEach(resource => {
        systemPrompt += `- ${resource.name}: ${resource.description || 'No description'}\n`;
      });
    }
    
    if (capabilities.prompts) {
      systemPrompt += isZhCN ? '\n### 提示词功能可用\n' : '\n### Prompts capability available\n';
    }
  });
  
  // 添加决策指南
  systemPrompt += isZhCN
    ? `\n\n## 分析步骤：
1. 分析用户的查询
2. 决定是否使用任何可用的 MCP 功能来回答
3. 如果决定使用 MCP 功能，指定要使用的服务器、功能和参数
4. 如果决定不使用 MCP 功能，直接回答用户的查询

## 响应格式：
请使用以下 JSON 格式指示你的决定：

\`\`\`json
{
  "action": "use_mcp" 或 "none",
  "reasoning": "你选择使用或不使用 MCP 的原因",
  "server": "你选择的服务器 URL",
  "capability": "tools", "resources" 或 "prompts",
  "function": "要调用的特定功能名称",
  "parameters": {
    // 所需的任何参数
  }
}
\`\`\`

然后，在 JSON 下方提供你对用户查询的回答。`
    : `\n\n## Analysis Steps:
1. Analyze the user's query
2. Decide whether to use any available MCP capabilities to answer
3. If using MCP, specify which server, capability, and parameters to use
4. If not using MCP, answer the query directly

## Response Format:
Please indicate your decision using the following JSON format:

\`\`\`json
{
  "action": "use_mcp" or "none",
  "reasoning": "Your reason for using or not using MCP",
  "server": "The server URL you've chosen",
  "capability": "tools", "resources", or "prompts",
  "function": "The specific function name to call",
  "parameters": {
    // Any required parameters
  }
}
\`\`\`

Then, below the JSON, provide your answer to the user's query.`;

  // 如果启用高级提示，添加更详细的指导
  if (useAdvancedPrompting) {
    systemPrompt += isZhCN
      ? `\n\n## 高级决策指南：
- 仅在 MCP 服务器提供的功能明确与用户查询相关时才使用
- 考虑所需功能的真实价值 - 如果你能直接回答，不要使用 MCP
- 对于需要最新信息、代码执行或特定工具的查询，优先考虑 MCP
- 当使用 MCP 时，选择最适合任务的服务器和功能
- 始终清晰解释你为什么选择使用或不使用 MCP`
      : `\n\n## Advanced Decision Guidelines:
- Only use MCP when the capabilities provided by the servers are clearly relevant to the query
- Consider the true value of the capability needed - if you can answer directly, don't use MCP
- For queries requiring up-to-date information, code execution, or specific tools, prioritize MCP
- When using MCP, select the server and capability that best fits the task
- Always clearly explain why you chose to use or not use MCP`;
  }
  
  return systemPrompt;
}
```

### 5. 实现 MCP 动作解析和执行

添加解析模型输出和执行 MCP 调用的功能：

```typescript
/**
 * 解析模型输出中的 MCP 动作
 */
private async parseMCPAction(content: string): Promise<{
  action: 'use_mcp' | 'none';
  reasoning?: string;
  server?: string;
  capability?: 'tools' | 'resources' | 'prompts';
  function?: string;
  parameters?: any;
} | null> {
  try {
    // 尝试提取 JSON 部分
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      this.engine.logger.warn('No JSON found in model response');
      return null;
    }
    
    const jsonString = jsonMatch[1];
    const parsedAction = JSON.parse(jsonString);
    
    // 验证必要字段
    if (!parsedAction.action || !['use_mcp', 'none'].includes(parsedAction.action)) {
      this.engine.logger.warn(`Invalid action in parsed response: ${parsedAction.action}`);
      return null;
    }
    
    // 如果是 'none'，则直接返回
    if (parsedAction.action === 'none') {
      return { action: 'none', reasoning: parsedAction.reasoning };
    }
    
    // 验证必要字段用于 MCP 调用
    if (!parsedAction.server || !parsedAction.capability || !parsedAction.function) {
      this.engine.logger.warn('Missing required fields for MCP action');
      return null;
    }
    
    return {
      action: 'use_mcp',
      reasoning: parsedAction.reasoning,
      server: parsedAction.server,
      capability: parsedAction.capability,
      function: parsedAction.function,
      parameters: parsedAction.parameters || {}
    };
  } catch (error) {
    this.engine.logger.error(`Error parsing MCP action: ${error}`);
    return null;
  }
}

/**
 * 执行 MCP 动作
 */
private async executeMCPAction(
  action: {
    action: 'use_mcp';
    server: string;
    capability: 'tools' | 'resources' | 'prompts';
    function: string;
    parameters: any;
  },
  serverCapabilities: Record<string, any>,
  config: SkillRunnableConfig
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  const { server, capability, function: funcName, parameters } = action;
  
  // 获取客户端
  const client = this.mcpClients[server];
  if (!client) {
    // 尝试连接
    const { client: newClient, error } = await this.connectToMCPServer(server);
    if (!newClient) {
      return {
        success: false,
        error: `Failed to connect to MCP server at ${server}: ${error}`
      };
    }
    this.mcpClients[server] = newClient;
  }
  
  try {
    // 基于功能类型执行调用
    switch (capability) {
      case 'tools':
        // 调用工具
        const toolResult = await client.callTool({
          name: funcName,
          arguments: parameters
        });
        return { success: true, result: toolResult };
        
      case 'resources':
        // 读取资源
        const resourceResult = await client.readResource({
          uri: parameters.uri || funcName
        });
        return { success: true, result: resourceResult };
        
      case 'prompts':
        // 获取提示词
        const promptResult = await client.getPrompt({
          name: funcName,
          arguments: parameters
        });
        return { success: true, result: promptResult };
        
      default:
        return {
          success: false,
          error: `Unsupported capability: ${capability}`
        };
    }
  } catch (error) {
    this.engine.logger.error(`Error executing MCP action: ${error}`);
    return {
      success: false,
      error: `Failed to execute MCP action: ${error.message}`
    };
  }
}

/**
 * 格式化 MCP 结果
 */
private async formatMCPResult(
  result: { success: boolean; result?: any; error?: string },
  originalResponse: string,
  query: string,
  config: SkillRunnableConfig
): Promise<any> {
  const { locale = 'en' } = config.configurable;
  const isZhCN = locale === 'zh-CN';
  
  // 如果执行失败，向用户解释错误
  if (!result.success) {
    const errorMessage = isZhCN
      ? `我尝试使用 MCP 服务来回答你的问题，但遇到了错误：${result.error}`
      : `I attempted to use an MCP service to answer your question, but encountered an error: ${result.error}`;
    
    // 从原始响应中提取非 JSON 部分
    const nonJsonResponse = originalResponse.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
    
    // 构建新的响应消息
    return {
      role: 'assistant',
      content: `${errorMessage}\n\n${nonJsonResponse || (isZhCN ? '我将尝试直接回答你的问题。' : "I'll try to answer your question directly.")}`
    };
  }
  
  // 从原始响应中提取非 JSON 部分
  const nonJsonResponse = originalResponse.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
  
  // 格式化 MCP 结果
  let formattedResult = '';
  
  // 根据结果类型格式化
  if (typeof result.result === 'string') {
    formattedResult = result.result;
  } else if (typeof result.result === 'object') {
    if (result.result.content) {
      // 处理包含内容的结果
      if (Array.isArray(result.result.content)) {
        // 处理内容数组
        formattedResult = result.result.content
          .map(item => {
            if (item.type === 'text') return item.text;
            if (item.type === 'image') return `[Image: ${item.alt || 'No description'}]`;
            return JSON.stringify(item);
          })
          .join('\n');
      } else {
        formattedResult = String(result.result.content);
      }
    } else {
      // 其他对象类型
      formattedResult = JSON.stringify(result.result, null, 2);
    }
  } else {
    formattedResult = String(result.result);
  }
  
  // 构建最终响应
  const responsePrefix = isZhCN
    ? `我使用 MCP 服务获取了以下信息：\n\n`
    : `I used an MCP service to retrieve the following information:\n\n`;
  
  const responseSuffix = nonJsonResponse
    ? `\n\n${nonJsonResponse}`
    : '';
  
  return {
    role: 'assistant',
    content: `${responsePrefix}${formattedResult}${responseSuffix}`
  };
}
```

### 6. 实现工作流

完成 Skill 的工作流定义：

```typescript
/**
 * 定义工作流
 */
toRunnable(): Runnable<any, any, RunnableConfig> {
  const workflow = new StateGraph<GraphState>({
    channels: this.graphState
  })
    .addNode('callMCPConnector', this.callMCPConnector.bind(this))
    .addEdge(START, 'callMCPConnector')
    .addEdge('callMCPConnector', END);
  
  return workflow.compile();
}
``` 