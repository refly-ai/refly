import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { GenericToolset } from '@refly/openapi-schema';
import { Mcp } from 'refly-icons';
import { Favicon } from '@refly-packages/ai-workspace-common/components/common/favicon';

interface ToolsetIconConfig {
  size?: number;
  className?: string;
}

export const ToolsetIcon = ({
  toolset,
  config,
}: { toolset: GenericToolset; config?: ToolsetIconConfig }) => {
  const { size = 24, className } = config ?? {};

  if (toolset.type === 'mcp') {
    return (
      <div className={cn('flex items-center justify-center overflow-hidden', className)}>
        <Mcp size={size} color="var(--refly-text-1)" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center overflow-hidden', className)}>
      <Favicon url={toolset.toolset?.definition?.domain} size={size} />
    </div>
  );
};
