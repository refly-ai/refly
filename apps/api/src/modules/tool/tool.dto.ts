import { pick } from '@refly/utils';
import { McpServer as McpServerPO, Toolset as ToolsetPO } from '../../generated/client';
import { GenericToolset, ToolsetInstance, ToolsetAuthType } from '@refly/openapi-schema';
import { mcpServerPO2DTO } from '../mcp-server/mcp-server.dto';
import { toolsetInventory } from '@refly/agent-tools';

export const toolsetPO2DTO = (toolset: ToolsetPO): ToolsetInstance => {
  const inventoryItem = toolsetInventory[toolset.key];
  return {
    ...pick(toolset, ['toolsetId', 'name', 'key', 'isGlobal', 'enabled']),
    authType: toolset.authType as ToolsetAuthType,
    config: JSON.parse(toolset.config),
    definition: inventoryItem?.definition,
    createdAt: toolset.createdAt.toJSON(),
    updatedAt: toolset.updatedAt.toJSON(),
  };
};

export const toolsetPo2GenericToolset = (toolset: ToolsetPO): GenericToolset => ({
  type: 'regular',
  id: toolset.toolsetId,
  name: toolset.name,
  toolset: toolsetPO2DTO(toolset),
});

export const mcpServerPo2GenericToolset = (server: McpServerPO): GenericToolset => ({
  type: 'mcp',
  id: server.name,
  name: server.name,
  mcpServer: mcpServerPO2DTO(server),
});
