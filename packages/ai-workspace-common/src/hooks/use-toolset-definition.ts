import { useMemo, useCallback } from 'react';
import { GenericToolset, ToolsetDefinition } from '@refly/openapi-schema';
import { useListToolsetInventory } from '@refly-packages/ai-workspace-common/queries/queries';

export const useToolsetDefinition = () => {
  const { data: toolsetInventoryData } = useListToolsetInventory();
  const toolsetInventory = toolsetInventoryData?.data ?? [];

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

  const lookupToolsetDefinition = useCallback(
    (key: string) => {
      return inventoryMap[key];
    },
    [inventoryMap],
  );

  return { populateToolsetDefinition, lookupToolsetDefinition };
};
