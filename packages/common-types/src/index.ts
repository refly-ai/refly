export * from './http';
export * from './conversation';
export * from './system-action';
export * from './task';
export * from './session';
export * from './page';
export * from './feed';
export * from './digest';
export * from './content-selector';
export * from './request';
export * from './i18n';
export * from './context-panel';
export * from './env';
export * from './extension-messaging';

/**
 * MCP Server interface defining a Model Context Protocol server configuration
 */
export interface MCPServer {
  /**
   * Unique identifier for the server
   */
  id: string;
  /**
   * Display name of the server
   */
  name: string;
  /**
   * Transport type for the server connection
   */
  type: 'sse' | 'streamableHttp';
  /**
   * Optional description of the server
   */
  description?: string;
  /**
   * Base URL for the server
   */
  baseUrl: string;
  /**
   * Optional HTTP headers to include with requests
   */
  headers?: Record<string, string>;
  /**
   * Whether the server is currently active
   */
  isActive: boolean;
  /**
   * Whether this is a built-in server (cannot be deleted)
   */
  isBuiltin?: boolean;
  /**
   * Array of tool names that are disabled for this server
   */
  disabledTools?: string[];
}

/**
 * MCP Tool interface defining a tool available on an MCP server
 */
export interface MCPTool {
  /**
   * Unique identifier for the tool
   */
  id: string;
  /**
   * Name of the tool
   */
  name: string;
  /**
   * Description of the tool
   */
  description: string;
  /**
   * JSON Schema defining the input parameters
   */
  inputSchema: Record<string, any>;
  /**
   * Server ID this tool belongs to
   */
  serverId: string;
  /**
   * Server name this tool belongs to
   */
  serverName: string;
}

/**
 * MCP Prompt interface defining a prompt template available on an MCP server
 */
export interface MCPPrompt {
  /**
   * Unique identifier for the prompt
   */
  id: string;
  /**
   * Name of the prompt template
   */
  name: string;
  /**
   * Description of the prompt template
   */
  description: string;
  /**
   * JSON Schema defining the input parameters
   */
  inputSchema: Record<string, any>;
  /**
   * Server ID this prompt belongs to
   */
  serverId: string;
  /**
   * Server name this prompt belongs to
   */
  serverName: string;
}

/**
 * MCP Resource interface defining a resource available on an MCP server
 */
export interface MCPResource {
  /**
   * Unique identifier for the resource
   */
  id: string;
  /**
   * URI of the resource
   */
  uri: string;
  /**
   * Type of the resource
   */
  type: string;
  /**
   * Server ID this resource belongs to
   */
  serverId: string;
  /**
   * Server name this resource belongs to
   */
  serverName: string;
}

/**
 * MCP Call Tool Response interface
 */
export interface MCPCallToolResponse {
  /**
   * Result of the tool call
   */
  result: any;
  /**
   * Optional error message
   */
  error?: string;
}

/**
 * MCP Get Prompt Response interface
 */
export interface GetMCPPromptResponse {
  /**
   * Content of the prompt
   */
  content: string;
  /**
   * Optional variables used in the prompt
   */
  variables?: Record<string, any>;
}

/**
 * MCP Get Resource Response interface
 */
export interface GetResourceResponse {
  /**
   * Array of resource contents
   */
  contents: MCPResource[];
}
