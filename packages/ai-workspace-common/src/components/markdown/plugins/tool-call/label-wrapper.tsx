import { memo } from 'react';
import { getVariableIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import type { GenericToolset, WorkflowVariable } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';

const TOOLSET_ICON_CONFIG = {
  size: 14,
  className: 'flex-shrink-0',
  builtinClassName: '!w-3.5 !h-3.5',
} as const;

function renderLabelIcon(source: string, variableType?: string, toolset?: GenericToolset) {
  if (source === 'variables') {
    return getVariableIcon(variableType);
  }

  if (source === 'toolsets' || source === 'tools') {
    return (
      <ToolsetIcon
        toolset={toolset}
        isBuiltin={toolset?.id === 'builtin'}
        config={TOOLSET_ICON_CONFIG}
      />
    );
  }

  return null;
}

interface LabelWrapperProps {
  source: string;
  variable?: WorkflowVariable;
  toolset?: GenericToolset;
}
export const LabelWrapper = memo(
  ({ source = 'variables', variable, toolset }: LabelWrapperProps) => {
    const variableType = variable?.variableType;
    const labelText = source === 'variables' ? (variable?.name ?? '') : (toolset?.name ?? '');

    return (
      <div className="flex items-center gap-1 h-[18px] px-1 rounded-[4px] bg-refly-tertiary-default border-[0.5px] border-solid border-refly-Card-Border">
        {renderLabelIcon(source, variableType, toolset)}
        <div className="text-xs text-refly-text-0 max-w-[100px] truncate leading-[14px]">
          {labelText}
        </div>
      </div>
    );
  },
);

LabelWrapper.displayName = 'LabelWrapper';
