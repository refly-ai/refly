import type { GenericToolset, ToolsetAuthType, ToolsetInstance } from '@refly/openapi-schema';
import { pick, safeParseJSON } from '@refly/utils';
import type { McpServer as McpServerPO, Toolset as ToolsetPO } from '@prisma/client';
import { mcpServerPO2DTO } from '../mcp-server/mcp-server.dto';
import { ToolsetType } from './constant';
import type { ToolsetInventoryItem } from './inventory/inventory.service';

export const toolsetPO2DTO = (
  toolset: ToolsetPO,
  inventoryMap?: Record<string, ToolsetInventoryItem>,
): ToolsetInstance => {
  // Get definition from inventoryMap if provided
  const inventoryItem = inventoryMap?.[toolset.key];

  return {
    ...pick(toolset, ['toolsetId', 'name', 'key', 'isGlobal', 'enabled']),
    authType: toolset.authType as ToolsetAuthType,
    config: safeParseJSON(toolset.config),
    definition: inventoryItem?.definition,
    createdAt: toolset.createdAt.toJSON(),
    updatedAt: toolset.updatedAt.toJSON(),
  };
};

/**
 * Populate toolsets with definitions from inventory (synchronous version with inventoryMap)
 * @param toolsets - Array of generic toolsets to populate
 * @param inventoryMap - Inventory map from ToolInventoryService
 * @returns Populated toolsets with definitions
 */
export const populateToolsets = (
  toolsets: GenericToolset[],
  inventoryMap?: Record<string, ToolsetInventoryItem>,
): GenericToolset[] => {
  if (!Array.isArray(toolsets) || toolsets.length === 0) {
    return [];
  }

  return toolsets.map((toolset) => {
    if (!toolset.toolset?.key) {
      return toolset;
    }
    const inventoryItem = inventoryMap?.[toolset.toolset.key];
    return {
      ...toolset,
      toolset: {
        ...toolset.toolset,
        definition: inventoryItem?.definition,
      },
    };
  });
};

export const toolsetPo2GenericToolset = (
  toolset: ToolsetPO,
  inventoryMap?: Record<string, ToolsetInventoryItem>,
): GenericToolset => ({
  type: 'regular',
  id: toolset.toolsetId,
  name: toolset.name,
  toolset: toolsetPO2DTO(toolset, inventoryMap),
});

export const mcpServerPo2GenericToolset = (server: McpServerPO): GenericToolset => ({
  type: ToolsetType.MCP,
  id: server.name,
  name: server.name,
  mcpServer: mcpServerPO2DTO(server),
});

export const toolsetPo2GenericOAuthToolset = (
  toolset: ToolsetPO,
  inventoryMap?: Record<string, ToolsetInventoryItem>,
): GenericToolset => {
  return {
    type: ToolsetType.EXTERNAL_OAUTH,
    id: toolset.toolsetId,
    name: toolset.name,
    toolset: toolsetPO2DTO(toolset, inventoryMap),
  };
};
