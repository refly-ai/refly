import { toolsetInventory } from '@refly/agent-tools';
import { GenericToolset, ToolsetAuthType, ToolsetInstance } from '@refly/openapi-schema';
import { pick, safeParseJSON } from '@refly/utils';
import { McpServer as McpServerPO, Toolset as ToolsetPO } from '../../generated/client';
import { mcpServerPO2DTO } from '../mcp-server/mcp-server.dto';

export const toolsetPO2DTO = (toolset: ToolsetPO): ToolsetInstance => {
  const inventoryItem = toolsetInventory[toolset.key];
  return {
    ...pick(toolset, ['toolsetId', 'name', 'key', 'isGlobal', 'enabled']),
    authType: toolset.authType as ToolsetAuthType,
    config: safeParseJSON(toolset.config),
    definition: inventoryItem?.definition,
    createdAt: toolset.createdAt.toJSON(),
    updatedAt: toolset.updatedAt.toJSON(),
  };
};

export const populateToolsetsWithDefinition = (toolsets: GenericToolset[]): GenericToolset[] => {
  const populateSingleToolset = (toolset: GenericToolset): GenericToolset => {
    if (!toolset.toolset?.key) {
      return toolset;
    }

    const inventoryItem = toolsetInventory[toolset.toolset.key];
    return {
      ...toolset,
      toolset: {
        ...toolset.toolset,
        definition: inventoryItem?.definition,
      },
    };
  };

  if (Array.isArray(toolsets)) {
    return toolsets.map(populateSingleToolset);
  }

  return [];
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

export const toolsetPo2GenericOAuthToolset = (toolset: ToolsetPO): GenericToolset => {
  return {
    type: 'external_oauth',
    id: toolset.toolsetId,
    name: toolset.name,
    toolset: toolsetPO2DTO(toolset),
  };
};
