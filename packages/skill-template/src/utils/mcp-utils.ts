/**
 * MCP utilities for client configuration
 */
import { Connection } from '../adapters';
import { ListMcpServersResponse, UpsertMcpServerRequest } from '@refly/openapi-schema';

/**
 * Server configuration interface for creating MCP connections
 */
interface ServerConfig {
  name: string;
  type: string;
  url?: string;
  command?: string;
  args?: string[];
  env?: any;
  headers?: any;
  reconnect?: any;
}

/**
 * Create a connection configuration for a single server
 * @param server - Server configuration
 * @returns Connection configuration or undefined if invalid
 */
function createConnectionConfig(server: ServerConfig): Connection | undefined {
  // Process parameters based on server type
  switch (server.type) {
    case 'sse':
      if (server.url) {
        // Handle headers and reconnect
        const headers =
          typeof server.headers === 'string' ? JSON.parse(server.headers) : server.headers;

        const reconnect =
          typeof server.reconnect === 'string' ? JSON.parse(server.reconnect) : server.reconnect;

        return {
          type: 'sse',
          url: server.url,
          headers,
          reconnect,
        } as Connection;
      }
      break;
    case 'streamable':
      if (server.url) {
        // Handle headers and reconnect
        const headers =
          typeof server.headers === 'string' ? JSON.parse(server.headers) : server.headers;

        const reconnect =
          typeof server.reconnect === 'string' ? JSON.parse(server.reconnect) : server.reconnect;

        return {
          type: 'streamable',
          url: server.url,
          headers,
          reconnect,
        } as Connection;
      }
      break;
    case 'stdio':
      if (server.command) {
        // Handle env and reconnect
        const env = typeof server.env === 'string' ? JSON.parse(server.env) : server.env;

        const reconnect =
          typeof server.reconnect === 'string' ? JSON.parse(server.reconnect) : server.reconnect;

        return {
          type: 'stdio',
          command: server.command,
          args: server.args,
          env: { ...process.env, ...env },
          restart: reconnect,
        } as Connection;
      }
      break;
  }

  return undefined;
}

/**
 * Convert MCP server response to client configuration
 * @param response - The response from listMcpServers API
 * @returns A record mapping server names to their connection configurations
 */
export function convertMcpServersToClientConfig(
  response: ListMcpServersResponse,
): Record<string, Connection> {
  const mcpServers = response.data || [];
  const config: Record<string, Connection> = {};

  for (const server of mcpServers) {
    // Skip servers without a name
    if (!server.name) continue;

    // Create connection config for this server
    const connectionConfig = createConnectionConfig(server);

    // Add to config if valid
    if (connectionConfig) {
      config[server.name] = connectionConfig;
    }
  }

  return config;
}

/**
 * Create MCP client configuration from server parameters
 * @param param - MCP server parameters
 * @returns MCP client configuration
 */
export function createMcpClientConfig(param: UpsertMcpServerRequest): Record<string, Connection> {
  const { name, type, url, command, args, env, headers, reconnect } = param;
  const serverName = name || 'temp-validation-server';
  const config: Record<string, Connection> = {};

  // Create a server config object from parameters
  const serverConfig: ServerConfig = {
    name: serverName,
    type,
    url,
    command,
    args,
    env,
    headers,
    reconnect,
  };

  // Create connection config using the shared helper function
  const connectionConfig = createConnectionConfig(serverConfig);

  // Add to config if valid
  if (connectionConfig) {
    config[serverName] = connectionConfig;
  }

  return config;
}
