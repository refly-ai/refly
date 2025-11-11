import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { type WorkflowPlan } from '@refly/canvas-common';
import { NewConversation, Mcp } from 'refly-icons';
import { InputParameterRow } from '@refly-packages/ai-workspace-common/components/canvas/nodes/start';
import { LabelWrapper } from './label-wrapper';
import { useTranslation } from 'react-i18next';
import { Typography, Dropdown, Divider } from 'antd';
import { useListTools } from '@refly-packages/ai-workspace-common/queries';
import { GenericToolset } from '@refly/openapi-schema';
import { processQueryWithMentions } from '@refly/utils/query-processor';

const { Paragraph } = Typography;

// Component for displaying toolset labels with ellipsis when overflow
const LabelsDisplay = memo(({ toolsets }: { toolsets: GenericToolset[] }) => {
  const labelsContainerRef = useRef<HTMLDivElement>(null);
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(toolsets.length);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Calculate how many labels can fit in the container
  const calculateVisibleCount = useCallback(() => {
    if (!labelsContainerRef.current || toolsets.length === 0) return;

    const labelsContainer = labelsContainerRef.current;
    const containerWidth = labelsContainer.offsetWidth;
    if (containerWidth === 0) {
      return;
    }

    const gapWidth = 4; // gap-1 = 4px
    const ellipsisWidth = 16; // Approximate width of "..."

    // Measure labels in the hidden measurement container
    const measureContainer = measureContainerRef.current;
    const labelElements = measureContainer?.querySelectorAll(
      '.label-measure-item',
    ) as NodeListOf<HTMLElement> | null;

    if (!labelElements || labelElements.length === 0) return;

    let totalWidth = 0;
    let fitCount = 0;

    for (let i = 0; i < toolsets.length; i++) {
      const currentLabelElement = labelElements[i];
      if (!currentLabelElement) break;

      const labelWidth = currentLabelElement.offsetWidth + (i > 0 ? gapWidth : 0);

      // Check if adding this label plus ellipsis (if needed) would fit
      const wouldFit =
        totalWidth + labelWidth + (i < toolsets.length - 1 ? ellipsisWidth + gapWidth : 0) <=
        containerWidth;

      if (wouldFit) {
        totalWidth += labelWidth;
        fitCount = i + 1;
      } else {
        break;
      }
    }

    setVisibleCount(Math.max(0, fitCount));
    setIsOverflowing(fitCount < toolsets.length);
  }, [toolsets]);

  // Calculate on mount and when toolsets change
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      calculateVisibleCount();
    });

    return () => cancelAnimationFrame(timer);
  }, [calculateVisibleCount]);

  // Listen to container resize
  useEffect(() => {
    if (!labelsContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleCount();
    });

    resizeObserver.observe(labelsContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateVisibleCount]);

  if (toolsets.length === 0) return null;

  const visibleToolsets = toolsets.slice(0, visibleCount);
  const hiddenToolsets = toolsets.slice(visibleCount);

  // Create dropdown menu items for hidden toolsets
  const dropdownMenuItems = hiddenToolsets.map((toolset, index) => ({
    key: `hidden-${toolset.id}-${index}`,
    label: (
      <div className="flex items-center">
        <LabelWrapper source="toolsets" toolset={toolset} />
      </div>
    ),
  }));

  return (
    <div className="flex items-center gap-1 min-w-0 flex-1">
      <Mcp size={14} color="var(--refly-text-3)" className="flex-shrink-0" />
      <div
        ref={labelsContainerRef}
        className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden"
      >
        {visibleToolsets.map((toolset, index) => (
          <LabelWrapper key={`${toolset.id}-${index}`} source="toolsets" toolset={toolset} />
        ))}
        {isOverflowing && (
          <Dropdown
            menu={{ items: dropdownMenuItems, className: 'max-h-[200px] overflow-y-auto' }}
            placement="top"
            trigger={['hover']}
          >
            <div className="text-refly-text-2 text-xs flex-shrink-0 leading-[18px] cursor-pointer hover:text-refly-text-0">
              ...
            </div>
          </Dropdown>
        )}
      </div>
      {/* Hidden measurement container for accurate width calculation */}
      <div
        ref={measureContainerRef}
        aria-hidden="true"
        className="absolute left-[-9999px] top-[-9999px] whitespace-nowrap pointer-events-none flex items-center gap-1"
      >
        {toolsets.map((toolset) => (
          <div key={`measure-${toolset.id}`} className="label-measure-item">
            <LabelWrapper source="toolsets" toolset={toolset} />
          </div>
        ))}
      </div>
    </div>
  );
});

LabelsDisplay.displayName = 'LabelsDisplay';

interface CopilotWorkflowPlanProps {
  data: WorkflowPlan;
}

const findToolsetById = (toolsets: GenericToolset[], id: string) => {
  return (
    toolsets.find((toolset) => toolset.id === id) ||
    toolsets.find((toolset) => toolset.toolset?.key === id)
  );
};

export const CopilotWorkflowPlan = memo(({ data }: CopilotWorkflowPlanProps) => {
  const { t } = useTranslation();
  const { tasks = [], variables = [] } = data ?? {};
  const { data: toolsData } = useListTools({ query: { enabled: true } });

  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex flex-col gap-3 p-4 rounded-xl border-solid border-[1px] border-refly-Card-Border bg-refly-bg-canvas">
        <div className="flex items-center gap-1.5">
          <NodeIcon type="start" small />
          <div className="text-refly-text-caption font-medium leading-5 flex-1 truncate text-sm">
            {t('canvas.nodeTypes.start')}
          </div>
        </div>

        {variables?.length > 0 && (
          <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
            {variables?.map((variable) => (
              <InputParameterRow
                key={variable.name}
                variableType={variable.variableType}
                label={variable.name}
                isRequired={true}
                isSingle={true}
              />
            ))}
          </div>
        )}
      </div>

      {tasks.map((task) => (
        <div
          className="flex flex-col gap-3 p-4 rounded-xl border-solid border-[1px] border-refly-Card-Border bg-refly-bg-canvas"
          key={task.id}
        >
          <div className="flex items-center gap-1.5">
            <NodeIcon type="skillResponse" small />
            <div className="text-refly-text-caption font-medium leading-5 flex-1 truncate text-sm">
              {task.title}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <NewConversation size={14} color="var(--refly-text-3)" />
            <Paragraph
              className="text-refly-text-2 flex-1 truncate text-xs leading-4 !m-0"
              ellipsis={{
                rows: 1,
                tooltip: (
                  <div className="max-w-[300px] max-h-[200px] overflow-y-auto text-xs">
                    {processQueryWithMentions(task.prompt).processedQuery || task.prompt}
                  </div>
                ),
              }}
            >
              {processQueryWithMentions(task.prompt).processedQuery || task.prompt}
            </Paragraph>
          </div>
          <LabelsDisplay
            toolsets={
              task.toolsets
                ?.map((toolsetId) => findToolsetById(toolsData?.data ?? [], toolsetId))
                .filter(Boolean) ?? []
            }
          />
        </div>
      ))}

      <Divider className="m-0 mt-1" />
    </div>
  );
});

CopilotWorkflowPlan.displayName = 'CopilotWorkflowPlan';
