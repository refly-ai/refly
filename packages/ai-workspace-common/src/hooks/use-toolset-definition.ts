import { useMemo, useCallback } from 'react';
import { GenericToolset, ToolsetDefinition } from '@refly/openapi-schema';
import {
  useListToolsetInventory,
  useListUserTools,
} from '@refly-packages/ai-workspace-common/queries/queries';

export const useToolsetDefinition = () => {
  const { data: toolsetInventoryData } = useListToolsetInventory();
  const toolsetInventory = toolsetInventoryData?.data ?? [];

  const { data: userToolsData } = useListUserTools({}, [], {
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  });
  const userTools = userToolsData?.data ?? [];

  const inventoryMap = useMemo(() => {
    return toolsetInventory.reduce(
      (acc, item) => {
        acc[item.key] = item;
        return acc;
      },
      {} as Record<string, ToolsetDefinition>,
    );
  }, [toolsetInventory]);

  const populateToolsetDefinition = (toolsets: GenericToolset[]) => {
    return toolsets.map((toolset) => {
      return {
        ...toolset,
        definition: inventoryMap[toolset.toolset?.key],
      };
    });
  };

  const lookupToolsetDefinitionByKey = useCallback(
    (key: string): ToolsetDefinition => {
      return inventoryMap[key];
    },
    [inventoryMap],
  );

  const lookupToolsetDefinitionById = useCallback(
    (id: string): ToolsetDefinition => {
      const userTool = userTools.find((tool) => tool.toolsetId === id);
      if (userTool?.key) {
        return inventoryMap[userTool.key];
      }
      return undefined;
    },
    [userTools, inventoryMap],
  );

  return {
    populateToolsetDefinition,
    lookupToolsetDefinitionByKey,
    lookupToolsetDefinitionById,
  };
};
