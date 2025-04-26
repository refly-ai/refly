import { MCPClient } from './MCPClient';
import { MCPCallToolResponse, MCPServerConfig, MCPTool } from './types';

/**
 * 助手消息类型
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
}

/**
 * 助手消息接口
 */
export interface Message {
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
}

/**
 * 工具调用提取结果
 */
export interface ToolCallExtraction {
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  arguments: Record<string, any>;
  /** 原始提取文本 */
  rawText: string;
}

/**
 * 工具响应状态
 */
export type ToolResponseStatus = 'pending' | 'invoking' | 'done' | 'error';

/**
 * 工具响应
 */
export interface MCPToolResponse {
  /** 响应ID */
  id: string;
  /** 工具 */
  tool: MCPTool;
  /** 响应状态 */
  status: ToolResponseStatus;
  /** 工具调用响应 */
  response?: MCPCallToolResponse;
}

/**
 * 回调数据
 */
export interface ChunkCallbackData {
  /** 文本内容 */
  text?: string;
  /** 工具响应 */
  mcpToolResponse?: MCPToolResponse[];
}

/**
 * MCP助手选项
 */
export interface MCPAssistantOptions {
  /** 是否自动注入工具 */
  autoInjectTools?: boolean;
  /** 自定义系统提示 */
  customSystemPrompt?: string;
  /** 大模型调用函数 */
  modelProvider: (messages: Message[]) => Promise<string>;
  /** 进度回调函数 */
  onChunk?: (data: ChunkCallbackData) => void;
  /** MCP客户端实例（可选） */
  client?: MCPClient;
}

/**
 * MCP助手
 * 实现与大模型的交互，将工具注入到系统提示中
 */
export class MCPAssistant {
  private client: MCPClient;
  private servers: MCPServerConfig[] = [];
  private tools: MCPTool[] = [];
  private messages: Message[] = [];
  private autoInjectTools: boolean;
  private customSystemPrompt: string | undefined;
  private modelProvider: (messages: Message[]) => Promise<string>;
  private onChunk?: (data: ChunkCallbackData) => void;

  /**
   * 创建MCP助手
   * @param options 助手选项
   */
  constructor(options: MCPAssistantOptions) {
    this.client = options.client || new MCPClient();
    this.autoInjectTools = options.autoInjectTools !== false;
    this.customSystemPrompt = options.customSystemPrompt;
    this.modelProvider = options.modelProvider;
    this.onChunk = options.onChunk;

    // 初始化系统提示
    this.resetMessages();
  }

  /**
   * 重置消息历史
   */
  resetMessages(): void {
    this.messages = [];

    // 添加默认系统提示
    const systemPrompt = this.buildSystemPrompt();
    this.messages.push({
      role: MessageRole.SYSTEM,
      content: systemPrompt,
    });
  }

  /**
   * 添加服务器
   * @param server 服务器配置
   */
  async addServer(server: MCPServerConfig): Promise<void> {
    // 连接服务器
    const connected = await this.client.connect(server);
    if (!connected) {
      throw new Error(`Failed to connect to server: ${server.id}`);
    }

    this.servers.push(server);

    // 如果自动注入工具，则获取工具并重建系统提示
    if (this.autoInjectTools) {
      await this.loadTools();
      this.updateSystemPrompt();
    }
  }

  /**
   * 加载所有服务器的工具
   */
  async loadTools(): Promise<void> {
    this.tools = [];

    for (const server of this.servers) {
      const serverTools = await this.client.listTools(server);
      this.tools.push(...serverTools);
    }
  }

  /**
   * 更新系统提示
   */
  updateSystemPrompt(): void {
    const systemPrompt = this.buildSystemPrompt();

    // 更新现有系统提示或添加新的系统提示
    if (this.messages.length > 0 && this.messages[0].role === MessageRole.SYSTEM) {
      this.messages[0].content = systemPrompt;
    } else {
      this.messages.unshift({
        role: MessageRole.SYSTEM,
        content: systemPrompt,
      });
    }
  }

  /**
   * 构建系统提示
   * @returns 完整的系统提示
   */
  private buildSystemPrompt(): string {
    // 如果没有工具或自定义系统提示，则使用默认提示
    if (this.tools.length === 0 && !this.customSystemPrompt) {
      return "You are a helpful assistant. Answer the user's questions to the best of your ability.";
    }

    // 使用Cherry Studio的提示模板
    const SYSTEM_PROMPT = `In this environment you have access to a set of tools you can use to answer the user's question. \
You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

## Tool Use Formatting

Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_use>
  <name>{tool_name}</name>
  <arguments>{json_arguments}</arguments>
</tool_use>

The tool name should be the exact name of the tool you are using, and the arguments should be a JSON object containing the parameters required by that tool. For example:
<tool_use>
  <name>python_interpreter</name>
  <arguments>{"code": "5 + 3 + 1294.678"}</arguments>
</tool_use>

The user will respond with the result of the tool use, which should be formatted as follows:

<tool_use_result>
  <name>{tool_name}</name>
  <result>{result}</result>
</tool_use_result>

The result should be a string, which can represent a file or any other output type. You can use this result as input for the next action.
For example, if the result of the tool use is an image file, you can use it in the next action like this:

<tool_use>
  <name>image_transformer</name>
  <arguments>{"image": "image_1.jpg"}</arguments>
</tool_use>

Always adhere to this format for the tool use to ensure proper parsing and execution.

## Tool Use Examples
Here are a few examples using notional tools:
---
User: Generate an image of the oldest person in this document.

A: I can use the document_qa tool to find out who the oldest person is in the document.
<tool_use>
  <name>document_qa</name>
  <arguments>{"document": "document.pdf", "question": "Who is the oldest person mentioned?"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>document_qa</name>
  <result>John Doe, a 55 year old lumberjack living in Newfoundland.</result>
</tool_use_result>

A: I can use the image_generator tool to create a portrait of John Doe.
<tool_use>
  <name>image_generator</name>
  <arguments>{"prompt": "A portrait of John Doe, a 55-year-old man living in Canada."}</arguments>
</tool_use>

User: <tool_use_result>
  <name>image_generator</name>
  <result>image.png</result>
</tool_use_result>

A: the image is generated as image.png

---
User: "What is the result of the following operation: 5 + 3 + 1294.678?"

A: I can use the python_interpreter tool to calculate the result of the operation.
<tool_use>
  <name>python_interpreter</name>
  <arguments>{"code": "5 + 3 + 1294.678"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>python_interpreter</name>
  <result>1302.678</result>
</tool_use_result>

A: The result of the operation is 1302.678.

---
User: "Which city has the highest population , Guangzhou or Shanghai?"

A: I can use the search tool to find the population of Guangzhou.
<tool_use>
  <name>search</name>
  <arguments>{"query": "Population Guangzhou"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>search</name>
  <result>Guangzhou has a population of 15 million inhabitants as of 2021.</result>
</tool_use_result>

A: I can use the search tool to find the population of Shanghai.
<tool_use>
  <name>search</name>
  <arguments>{"query": "Population Shanghai"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>search</name>
  <result>26 million (2019)</result>
</tool_use_result>
Assistant: The population of Shanghai is 26 million, while Guangzhou has a population of 15 million. Therefore, Shanghai has the highest population.

## Tool Use Available Tools
Above example were using notional tools that might not exist for you. You only have access to these tools:
${this.formatAvailableTools()}

## Tool Use Rules
Here are the rules you should always follow to solve your task:
1. Always use the right arguments for the tools. Never use variable names as the action arguments, use the value instead.
2. Call a tool only when needed: do not call the search agent if you do not need information, try to solve the task yourself.
3. If no tool call is needed, just answer the question directly.
4. Never re-do a tool call that you previously did with the exact same parameters.
5. For tool use, MARK SURE use XML tag format as shown in the examples above. Do not use any other format.

# User Instructions
${this.customSystemPrompt || "You are a helpful assistant. Answer the user's questions to the best of your ability."}

Now Begin! If you solve the task correctly, you will receive a reward of $1,000,000.`;

    return SYSTEM_PROMPT;
  }

  /**
   * 格式化可用工具为XML字符串
   * @returns 格式化的工具XML字符串
   */
  private formatAvailableTools(): string {
    if (this.tools.length === 0) {
      return '<tools></tools>';
    }

    const toolStrings = this.tools
      .map((tool) => {
        return `
<tool>
  <name>${tool.id}</name>
  <description>${tool.description || ''}</description>
  <arguments>
    ${tool.inputSchema ? JSON.stringify(tool.inputSchema) : ''}
  </arguments>
</tool>`;
      })
      .join('\n');

    return `<tools>
${toolStrings}
</tools>`;
  }

  /**
   * 添加用户消息
   * @param content 消息内容
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: MessageRole.USER,
      content,
    });
  }

  /**
   * 添加助手消息
   * @param content 消息内容
   */
  addAssistantMessage(content: string): void {
    this.messages.push({
      role: MessageRole.ASSISTANT,
      content,
    });
  }

  /**
   * 获取完整对话历史
   * @returns 消息历史
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * 从助手响应中提取所有工具调用
   * @param content 响应内容
   * @returns 工具响应数组
   */
  parseToolUse(content: string): MCPToolResponse[] {
    if (!content || !this.tools || this.tools.length === 0) {
      return [];
    }

    // 使用全局正则表达式匹配所有工具调用
    const toolUsePattern =
      /<tool_use>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<arguments>([\s\S]*?)<\/arguments>[\s\S]*?<\/tool_use>/g;
    const tools: MCPToolResponse[] = [];
    let match: RegExpExecArray | null;
    let idx = 0;
    // 查找所有工具调用块
    while (match = toolUsePattern.exec(content)) {
      const toolName = match[1].trim();
      const toolArgs = match[2].trim();

      // 尝试解析参数为JSON
      let parsedArgs: Record<string, any>;
      try {
        parsedArgs = JSON.parse(toolArgs);
      } catch (error) {
        console.error(`Failed to parse tool arguments for ${toolName}:`, error);
        continue;
      }

      // 查找对应工具
      const mcpTool = this.tools.find((tool) => tool.id === toolName);
      if (!mcpTool) {
        console.error(`Tool "${toolName}" not found in available tools`);
        continue;
      }

      // 添加到工具数组
      tools.push({
        id: `${toolName}-${idx++}`,
        tool: {
          ...mcpTool,
          inputSchema: parsedArgs,
        },
        status: 'pending',
      });
    }

    return tools;
  }

  /**
   * 更新工具响应
   * @param results 结果数组
   * @param resp 响应
   */
  private upsertToolResponse(results: MCPToolResponse[], resp: MCPToolResponse): void {
    const index = results.findIndex((r) => r.id === resp.id);
    if (index !== -1) {
      results[index] = resp;
    } else {
      results.push(resp);
    }

    // 通知进度
    if (this.onChunk) {
      this.onChunk({ mcpToolResponse: results });
    }
  }

  /**
   * 执行助手对话
   * @param userMessage 用户消息
   * @returns 助手响应
   */
  async run(userMessage: string): Promise<string> {
    // 添加用户消息
    this.addUserMessage(userMessage);

    // 开始递归处理过程
    return this.processConversation(0);
  }

  /**
   * 递归处理对话
   * @param depth 递归深度
   * @returns 最终助手响应
   */
  private async processConversation(depth: number): Promise<string> {
    // 防止无限递归
    if (depth > 10) {
      console.warn('Maximum recursion depth reached in processConversation');
      return 'Maximum tool call depth reached. Please continue the conversation.';
    }

    // 调用模型获取响应
    const assistantResponse = await this.modelProvider(this.messages);

    // 添加助手响应
    this.addAssistantMessage(assistantResponse);

    // 通知进度
    if (this.onChunk) {
      this.onChunk({ text: assistantResponse });
    }

    // 解析所有工具调用
    const toolResponses = this.parseToolUse(assistantResponse);

    // 如果没有工具调用，返回助手响应
    if (toolResponses.length === 0) {
      return assistantResponse;
    }

    // 处理所有工具调用
    const toolCallPromises = toolResponses.map(async (toolResponse) => {
      // 更新状态为正在调用
      this.upsertToolResponse(toolResponses, { ...toolResponse, status: 'invoking' });

      try {
        // 执行工具调用
        const result = await this.executeToolCall(
          toolResponse.tool,
          toolResponse.tool.inputSchema as Record<string, any>,
        );

        // 格式化结果
        const formattedResult = this.formatToolResult(toolResponse.tool.id, result);

        // 添加结果到对话
        this.addUserMessage(formattedResult);

        // 更新状态为完成
        this.upsertToolResponse(toolResponses, {
          ...toolResponse,
          status: 'done',
          response: {
            content: [{ type: 'text', text: result }],
          },
        });

        return { success: true, result };
      } catch (error) {
        // 处理错误
        const errorMessage = `Error executing tool ${toolResponse.tool.id}: ${error instanceof Error ? error.message : String(error)}`;
        const formattedError = this.formatToolResult(toolResponse.tool.id, errorMessage);

        // 添加错误到对话
        this.addUserMessage(formattedError);

        // 更新状态为错误
        this.upsertToolResponse(toolResponses, {
          ...toolResponse,
          status: 'error',
          response: {
            isError: true,
            content: [{ type: 'text', text: errorMessage }],
          },
        });

        return { success: false, error: errorMessage };
      }
    });

    // 等待所有工具调用完成
    await Promise.all(toolCallPromises);

    // 递归处理下一轮对话
    return this.processConversation(depth + 1);
  }

  /**
   * 构建工具调用结果
   * @param toolName 工具名称
   * @param result 结果文本
   * @returns 格式化的工具调用结果
   */
  formatToolResult(toolName: string, result: string): string {
    return `<tool_use_result>
  <name>${toolName}</name>
  <result>${result}</result>
</tool_use_result>`;
  }

  /**
   * 执行工具调用
   * @param tool 工具对象
   * @param args 工具参数
   * @returns 工具调用结果文本
   */
  private async executeToolCall(tool: MCPTool, args: Record<string, any>): Promise<string> {
    // 获取服务器配置
    const serverConfig = this.servers.find((s) => s.id === tool.serverId);

    if (!serverConfig) {
      throw new Error(`Server ${tool.serverId} not found`);
    }

    // 调用工具
    const response = await this.client.callTool({
      server: serverConfig,
      name: tool.name,
      args,
    });

    // 提取文本内容
    if (response.isError) {
      throw new Error(response.content?.[0]?.text || 'Unknown error');
    }

    // 将内容转换为文本
    return this.formatToolResponseContent(response);
  }

  /**
   * 将工具响应格式化为文本
   * @param response 工具调用响应
   * @returns 格式化的文本
   */
  private formatToolResponseContent(response: MCPCallToolResponse): string {
    if (!response.content || response.content.length === 0) {
      return '';
    }

    // 将所有文本内容连接起来
    return response.content
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n');
  }

  /**
   * 关闭助手并断开所有连接
   */
  async close(): Promise<void> {
    await this.client.disconnectAll();
  }
}
