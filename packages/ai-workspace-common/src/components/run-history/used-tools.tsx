import { memo, useMemo } from 'react';
import { GenericToolset } from '@refly/openapi-schema';
import { UsedToolsets } from '@refly-packages/ai-workspace-common/components/workflow-list/used-toolsets';

export const UsedTools = memo(({ usedTools }: { usedTools?: string }) => {
  // Convert tool keys (string[]) to GenericToolset[] format
  // The toolset.toolset.key is used by ToolsetPopover to lookup definitions
  const toolsets = useMemo((): GenericToolset[] => {
    if (!usedTools) return [];
    try {
      const parsed = JSON.parse(usedTools) as string[];
      if (!Array.isArray(parsed)) return [];

      return parsed.map((toolKey) => ({
        id: toolKey,
        name: toolKey,
        type: 'regular' as const,
        builtin: true,
        toolset: {
          toolsetId: toolKey,
          name: toolKey,
          key: toolKey,
        },
      }));
    } catch {
      return [];
    }
  }, [usedTools]);

  if (toolsets.length === 0) {
    return <span className="text-gray-400">-</span>;
  }

  return <UsedToolsets toolsets={toolsets} />;
});

UsedTools.displayName = 'UsedTools';
