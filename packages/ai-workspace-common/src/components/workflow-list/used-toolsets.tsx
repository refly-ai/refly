import { memo } from 'react';
import { GenericToolset } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { ToolsetPopover } from './toolset-popover';

const MAX_TOOLSETS = 4;

export const UsedToolsets = memo(({ toolsets }: { toolsets: GenericToolset[] }) => {
  if (!toolsets || toolsets?.length === 0) {
    return null;
  }

  return (
    <ToolsetPopover toolsets={toolsets}>
      <div
        className="group w-fit flex items-center flex-wrap gap-1 prevent-hover-action hover:bg-refly-bg-control-z0 rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        {toolsets.slice(0, MAX_TOOLSETS).map((toolset) => (
          <div
            key={toolset.id}
            className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md bg-refly-bg-canvas group-hover:bg-refly-bg-control-z0 overflow-hidden"
          >
            <ToolsetIcon
              toolset={toolset}
              toolsetKey={toolset.toolset?.key ?? toolset.id}
              config={{ size: 16, builtinClassName: 'rounded-full !w-4 !h-4' }}
            />
          </div>
        ))}

        {toolsets.length > MAX_TOOLSETS && (
          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md bg-refly-bg-canvas group-hover:bg-refly-bg-control-z0 text-refly-text-2 text-xs cursor-pointer">
            +{toolsets.length - MAX_TOOLSETS}
          </div>
        )}
      </div>
    </ToolsetPopover>
  );
});

UsedToolsets.displayName = 'UsedToolsets';
