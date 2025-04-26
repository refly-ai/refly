/**
 * MCP服务器配置
 */
export interface MCPServerConfig {
  /** 服务器唯一ID */
  id: string;
  /** 服务器名称 */
  name: string;
  /** 服务器描述 */
  description?: string;
  /** 连接类型 */
  type: 'inMemory' | 'sse' | 'streamableHttp' | 'stdio';
  /** 服务器基础URL（对于HTTP/SSE连接） */
  baseUrl?: string;
  /** 命令（对于stdio连接） */
  command?: string;
  /** 命令参数（对于stdio连接） */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** HTTP头 */
  headers?: Record<string, string>;
  /** 镜像源URL（对于npm包安装） */
  registryUrl?: string;
  /** 是否活跃 */
  isActive?: boolean;
}

/**
 * MCP工具
 */
export interface MCPTool {
  /** 工具ID */
  id: string;
  /** 服务器ID */
  serverId: string;
  /** 服务器名称 */
  serverName: string;
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description?: string;
  /** 输入模式 */
  inputSchema: any;
}

/**
 * MCP资源
 */
export interface MCPResource {
  /** 服务器ID */
  serverId: string;
  /** 服务器名称 */
  serverName: string;
  /** 资源URI */
  uri: string;
  /** 资源名称 */
  name: string;
  /** 资源描述 */
  description?: string;
  /** MIME类型 */
  mimeType?: string;
  /** 资源大小 */
  size?: number;
  /** 文本内容 */
  text?: string;
  /** 二进制内容 */
  blob?: string;
}

/**
 * MCP提示
 */
export interface MCPPrompt {
  /** 提示ID */
  id: string;
  /** 服务器ID */
  serverId: string;
  /** 服务器名称 */
  serverName: string;
  /** 提示名称 */
  name: string;
  /** 提示描述 */
  description?: string;
  /** 提示模式 */
  schema?: any;
}

/**
 * MCP工具调用响应
 */
export interface MCPCallToolResponse {
  /** 是否发生错误 */
  isError?: boolean;
  /** 内容 */
  content: Array<{
    /** 内容类型 */
    type: string;
    /** 文本内容 */
    text?: string;
    /** 其他属性 */
    [key: string]: any;
  }>;
}

/**
 * 获取MCP提示响应
 */
export interface GetMCPPromptResponse {
  /** 内容 */
  content: string;
  /** 其他属性 */
  [key: string]: any;
}

/**
 * 获取资源响应
 */
export interface GetResourceResponse {
  /** 资源内容 */
  contents: MCPResource[];
}

/**
 * 工作流步骤定义
 */
export interface WorkflowStep {
  /** 服务器ID或名称 */
  server: string;
  /** 工具名称 */
  tool: string;
  /** 工具参数 */
  args: Record<string, any>;
  /** 输出变量名 */
  outputVar: string;
  /** 条件表达式 */
  condition?: string;
  /** 错误处理 */
  onError?: 'continue' | 'abort' | WorkflowStep;
}

/**
 * 工作流上下文
 */
export interface WorkflowContext {
  /** 初始上下文变量 */
  initialContext?: Record<string, any>;
  /** 工作流ID */
  workflowId?: string;
  /** 是否记录历史 */
  recordHistory?: boolean;
}

/**
 * 工作流结果
 */
export interface WorkflowResult {
  /** 是否成功 */
  success: boolean;
  /** 最终上下文 */
  context: Record<string, any>;
  /** 执行历史 */
  history?: Array<{
    step: WorkflowStep;
    result: MCPCallToolResponse;
    timestamp: number;
  }>;
  /** 错误信息 */
  error?: string;
}

/**
 * 缓存项
 */
export interface CacheItem<T> {
  /** 值 */
  value: T;
  /** 过期时间戳 */
  expiry: number;
}
