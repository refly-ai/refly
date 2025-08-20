import { pick } from '@refly/utils';
import { McpServer as McpServerPO, Toolset as ToolsetPO } from '../../generated/client';
import { GenericToolset, Toolset, ToolsetAuthType } from '@refly/openapi-schema';
import { mcpServerPO2DTO } from '../mcp-server/mcp-server.dto';

export const toolsetPO2DTO = (toolset: ToolsetPO): Toolset => ({
  ...pick(toolset, ['toolsetId', 'name', 'key', 'isGlobal']),
  authType: toolset.authType as ToolsetAuthType,
  createdAt: toolset.createdAt.toJSON(),
  updatedAt: toolset.updatedAt.toJSON(),
});

export const toolsetPo2GenericToolset = (toolset: ToolsetPO): GenericToolset => ({
  type: 'regular',
  toolset: toolsetPO2DTO(toolset),
});

export const mcpServerPo2GenericToolset = (server: McpServerPO): GenericToolset => ({
  type: 'mcp',
  mcpServer: mcpServerPO2DTO(server),
});
