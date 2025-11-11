import { McpServer } from '../../generated/client';
import { McpServerDTO, McpServerType } from '@refly/openapi-schema';
import { pick } from '../../utils';
import { safeParseJSON } from '@refly/utils';

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
    args: server.args ? safeParseJSON(server.args) : null,
    env: server.env ? safeParseJSON(server.env) : null,
    headers: server.headers ? safeParseJSON(server.headers) : null,
    reconnect: server.reconnect ? safeParseJSON(server.reconnect) : null,
    config: server.config ? safeParseJSON(server.config) : null,
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
  };
};
