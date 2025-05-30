import { McpServer } from '../../generated/client';
import { McpServerDTO, McpServerType } from '@refly/openapi-schema';
import { pick } from '../../utils';

/**
 * Convert McpServer PO to DTO
 */
export const mcpServerPO2DTO = (server: McpServer): McpServerDTO => {
  if (!server) {
    return undefined;
  }

  return {
    ...pick(server, ['name', 'url', 'command', 'enabled', 'isGlobal']),
    type: server.type as McpServerType,
    args: server.args ? JSON.parse(server.args) : null,
    env: server.env ? JSON.parse(server.env) : null,
    headers: server.headers ? JSON.parse(server.headers) : null,
    reconnect: server.reconnect ? JSON.parse(server.reconnect) : null,
    config: server.config ? JSON.parse(server.config) : null,
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
  };
};
