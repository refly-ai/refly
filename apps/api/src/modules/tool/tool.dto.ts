import { pick } from '@refly/utils';
import { McpServer as McpServerPO, Toolset as ToolsetPO } from '../../generated/client';
import { GenericToolset, ToolsetInstance, ToolsetAuthType } from '@refly/openapi-schema';
import { mcpServerPO2DTO } from '../mcp-server/mcp-server.dto';
import { toolsetInventory } from '@refly/agent-tools';

export const toolsetPO2DTO = (toolset: ToolsetPO): ToolsetInstance => {
  const inventoryItem = toolsetInventory[toolset.key];
  return {
    ...pick(toolset, ['toolsetId', 'name', 'key', 'isGlobal']),
    authType: toolset.authType as ToolsetAuthType,
    descriptionDict: inventoryItem?.definition.descriptionDict ?? {},
    tools: inventoryItem?.definition.tools ?? [],
    createdAt: toolset.createdAt.toJSON(),
    updatedAt: toolset.updatedAt.toJSON(),
  };
};

export const toolsetPo2GenericToolset = (toolset: ToolsetPO): GenericToolset => ({
  type: 'regular',
  toolset: toolsetPO2DTO(toolset),
});

export const mcpServerPo2GenericToolset = (server: McpServerPO): GenericToolset => ({
  type: 'mcp',
  mcpServer: mcpServerPO2DTO(server),
});
