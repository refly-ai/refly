import { memo, useMemo } from 'react';
import { getVariableIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import type { GenericToolset, WorkflowVariable } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { useTranslation } from 'react-i18next';
import { useListToolsetInventory } from '@refly-packages/ai-workspace-common/queries';

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
    return <ToolsetIcon toolset={toolset} config={TOOLSET_ICON_CONFIG} />;
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
    const { i18n } = useTranslation();
    const currentLanguage = i18n.language || 'en';

    const variableType = variable?.variableType;
    const { data } = useListToolsetInventory({}, null, {
      enabled: true,
    });

    const labelText = useMemo(() => {
      if (source === 'variables') {
        return variable?.name ?? '';
      }

      const toolsetDefinition = data?.data?.find((t) => t.key === toolset?.toolset?.key);
      return (
        (toolsetDefinition?.labelDict?.[currentLanguage] as string | undefined) ??
        toolset?.name ??
        ''
      );
    }, [source, variable, toolset, currentLanguage, data]);

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
