import { useTranslation } from 'react-i18next';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useMemo, useState, useRef } from 'react';
import { useEffect } from 'react';
import { useCallback } from 'react';
import { CanvasNodeType, ResourceMeta, ResourceType } from '@refly/openapi-schema';
import { ArrowRight, X } from 'refly-icons';
import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries';
import { getStartNodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { cn } from '@refly/utils/cn';

export interface MentionItem {
  name: string;
  description: string;
  source: 'startNode' | 'resourceLibrary' | 'stepRecord' | 'resultRecord' | 'myUpload';
  variableType: string;
  entityId: string;
  nodeId: string;
  metadata?: {
    imageUrl?: string | undefined;
    resourceType?: ResourceType;
    resourceMeta?: ResourceMeta;
  };
}

export const MentionList = ({
  items,
  command,
  placement = 'bottom',
}: {
  items: MentionItem[];
  command: any;
  placement?: 'top' | 'bottom';
}) => {
  const { t } = useTranslation();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>('startNode');
  // Keyboard navigation states
  const [focusLevel, setFocusLevel] = useState<'first' | 'second'>('first');
  const [firstLevelIndex, setFirstLevelIndex] = useState<number>(0);
  const [secondLevelIndex, setSecondLevelIndex] = useState<number>(0);
  // Height tracking states
  const [firstLevelHeight, setFirstLevelHeight] = useState<number>(0);
  const [secondLevelHeight, setSecondLevelHeight] = useState<number>(0);
  const { nodes } = useCanvasData();
  const { canvasId } = useCanvasContext();

  // Refs for measuring panel heights
  const firstLevelRef = useRef<HTMLDivElement>(null);
  const secondLevelRef = useRef<HTMLDivElement>(null);

  // Dynamic alignment based on placement
  const mentionVirtalAlign = placement === 'top' ? 'items-end' : 'items-start';

  // Height comparison logic
  const isFirstLevelTaller = firstLevelHeight > secondLevelHeight;
  const isSecondLevelTaller = secondLevelHeight > firstLevelHeight;

  // Dynamic styling based on height comparison and placement
  const firstLevelClasses = useMemo(() => {
    const baseClasses =
      'flex flex-col gap-1 w-40 p-2 bg-refly-bg-body-z0 border-[1px] border-solid border-refly-Card-Border';

    if (placement === 'top') {
      if (isFirstLevelTaller) {
        // First level is taller: has right border, right bottom no corner radius, other corners have radius
        return cn(baseClasses, 'rounded-tl-xl', 'rounded-tr-xl', 'rounded-bl-xl', 'border-r');
      } else if (isSecondLevelTaller) {
        // First level is shorter or equal: no right border, left has corner radius, right no corner radius
        return cn(baseClasses, 'rounded-tl-xl', 'rounded-bl-xl', 'border-r-0');
      } else {
        return cn(baseClasses, 'rounded-l-xl');
      }
    } else {
      // placement === 'bottom'
      if (isFirstLevelTaller) {
        // First level is taller: has right border, right top no corner radius, other corners have radius
        return cn(baseClasses, 'rounded-tl-xl', 'rounded-bl-xl', 'rounded-br-xl', 'border-r');
      } else if (isSecondLevelTaller) {
        // First level is shorter or equal: no right border, left has corner radius, right no corner radius
        return cn(baseClasses, 'rounded-tl-xl', 'rounded-bl-xl', 'border-r-0');
      } else {
        return cn(baseClasses, 'rounded-l-xl');
      }
    }
  }, [isFirstLevelTaller, isSecondLevelTaller, placement]);

  const secondLevelClasses = useMemo(() => {
    const baseClasses =
      'w-60 p-2 max-h-60 flex box-border overflow-y-auto bg-refly-bg-body-z0 border-[1px] border-solid border-refly-Card-Border';

    if (placement === 'top') {
      if (isSecondLevelTaller) {
        // Second level is taller: has left border, left bottom no corner radius, other corners have radius
        return cn(baseClasses, 'rounded-tr-xl', 'rounded-tl-xl', 'rounded-br-xl', 'border-l');
      } else {
        // Second level is shorter or equal: no left border, left no corner radius, right has corner radius
        return cn(baseClasses, 'rounded-tr-xl', 'rounded-br-xl', 'border-l-0');
      }
    } else {
      // placement === 'bottom'
      if (isSecondLevelTaller) {
        // Second level is taller: has left border, left top no corner radius, other corners have radius
        return cn(baseClasses, 'rounded-r-xl', 'rounded-bl-xl', 'border-l');
      } else {
        // Second level is shorter or equal: no left border, left no corner radius, right has corner radius
        return cn(baseClasses, 'rounded-tr-xl', 'rounded-br-xl', 'border-l-0');
      }
    }
  }, [isSecondLevelTaller, placement]);

  const firstLevels = useMemo(
    () => [
      {
        key: 'startNode',
        name: t('canvas.richChatInput.startNode'),
        source: 'startNode' as const,
        onMouseEnter: () => setHoveredCategory('startNode'),
      },
      {
        key: 'resourceLibrary',
        name: t('canvas.richChatInput.resourceLibrary'),
        source: 'resourceLibrary' as const,
        onMouseEnter: () => {
          setHoveredCategory('resourceLibrary');
        },
      },
      {
        key: 'runningRecord',
        name: t('canvas.richChatInput.runningRecord'),
        source: 'runningRecord' as const,
        onMouseEnter: () => {
          setHoveredCategory('runningRecord');
        },
      },
    ],
    [t],
  );

  // Fetch workflow variables on demand when hovering startNode
  const {
    data: workflowVariablesData,
    refetch: refetchWorkflowVariables,
    isLoading: isLoadingVariables,
  } = useGetWorkflowVariables({ query: { canvasId } }, undefined, {
    enabled: !!canvasId, // Always enable when canvasId is available
  });

  // Group items by source and create canvas-based items
  const groupedItems = useMemo(() => {
    // Use fetched workflow variables for startNode items instead of prop items
    const workflowVariables = workflowVariablesData?.data || [];
    const startNodeItems = workflowVariables.map((variable) => ({
      name: variable.name,
      description: variable.description || '',
      source: 'startNode' as const,
      variableType: variable.variableType || 'string',
      entityId: variable.variableId || '',
      nodeId: variable.variableId || '',
    }));

    // Resource library only contains my upload items
    const myUploadItems = items.filter((item) => item.source === 'myUpload');

    // Get skillResponse nodes for step records
    const stepRecordItems =
      nodes
        ?.filter((node) => node.type === 'skillResponse')
        ?.map((node) => ({
          name: node.data?.title ?? t('canvas.richChatInput.untitledStep'),
          description: t('canvas.richChatInput.stepRecord'),
          source: 'stepRecord' as const,
          variableType: node.type, // Use actual node type
          entityId: node.data?.entityId,
          nodeId: node.id,
        })) ?? [];

    // Get result record nodes - same logic as ResultList component
    const resultRecordItems =
      nodes
        ?.filter(
          (node) =>
            ['document', 'codeArtifact', 'website', 'video', 'audio'].includes(node.type) ||
            (node.type === 'image' && !!node.data?.metadata?.resultId),
        )
        ?.map((node) => ({
          name: node.data?.title ?? t('canvas.richChatInput.untitledResult'),
          description: t('canvas.richChatInput.resultRecord'),
          source: 'resultRecord' as const,
          variableType: node.type, // Use actual node type
          entityId: node.data?.entityId,
          nodeId: node.id,
          metadata: {
            imageUrl: node.data?.metadata?.imageUrl,
            resourceType: node.data?.metadata?.resourceType as ResourceType | undefined,
            resourceMeta: node.data?.metadata?.resourceMeta as ResourceMeta | undefined,
          },
        })) ?? [];

    // Running record combines step records and result records
    const runningRecordItems = [...stepRecordItems, ...resultRecordItems];

    return {
      startNode: startNodeItems,
      resourceLibrary: myUploadItems,
      runningRecord: runningRecordItems,
    };
  }, [workflowVariablesData, items, nodes, t]);

  // Trigger variable fetch when hovering startNode
  useEffect(() => {
    if (hoveredCategory === 'startNode' && canvasId) {
      refetchWorkflowVariables();
    }
  }, [hoveredCategory, canvasId, refetchWorkflowVariables]);

  // Measure panel heights when content changes
  useEffect(() => {
    const measureHeights = () => {
      if (firstLevelRef.current) {
        const height = firstLevelRef.current.offsetHeight;
        setFirstLevelHeight(height);
      }
      if (secondLevelRef.current) {
        const height = secondLevelRef.current.offsetHeight;
        setSecondLevelHeight(height);
      }
    };

    // Measure heights after a short delay to ensure content is rendered
    const timeoutId = setTimeout(measureHeights, 0);

    return () => clearTimeout(timeoutId);
  }, [hoveredCategory, groupedItems, isLoadingVariables]);

  // Also measure heights when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (firstLevelRef.current) {
        setFirstLevelHeight(firstLevelRef.current.offsetHeight);
      }
      if (secondLevelRef.current) {
        setSecondLevelHeight(secondLevelRef.current.offsetHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Derive current second level items based on hovered category
  const currentSecondLevelItems = useMemo<MentionItem[]>(() => {
    if (hoveredCategory === 'startNode') {
      return groupedItems.startNode ?? [];
    }
    if (hoveredCategory === 'resourceLibrary') {
      return groupedItems.resourceLibrary ?? [];
    }
    if (hoveredCategory === 'runningRecord') {
      return groupedItems.runningRecord ?? [];
    }
    return [];
  }, [hoveredCategory, groupedItems]);

  // Function to scroll active item into view
  const scrollActiveItemIntoView = useCallback(() => {
    if (focusLevel === 'second' && secondLevelRef.current) {
      const container = secondLevelRef.current;
      const activeItem = container.querySelector('[data-active="true"]') as HTMLElement;

      if (activeItem) {
        // Use scrollIntoView with more specific options
        activeItem.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [focusLevel]);

  // Sync first level index with hoveredCategory
  useEffect(() => {
    let idx = 0;
    if (hoveredCategory === 'startNode') {
      idx = 0;
    } else if (hoveredCategory === 'resourceLibrary') {
      idx = 1;
    } else if (hoveredCategory === 'runningRecord') {
      idx = 2;
    }
    setFirstLevelIndex(idx);
    // Reset second-level index when category changes
    setSecondLevelIndex(0);
  }, [hoveredCategory]);

  // Clamp second level index to available items
  useEffect(() => {
    const len = currentSecondLevelItems?.length ?? 0;
    if (len === 0) {
      setSecondLevelIndex(0);
      return;
    }
    if (secondLevelIndex > len - 1) {
      setSecondLevelIndex(0);
    }
  }, [currentSecondLevelItems, secondLevelIndex]);

  // Auto-scroll to active item when secondLevelIndex changes
  useEffect(() => {
    if (focusLevel === 'second') {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollActiveItemIntoView();
      });
    }
  }, [secondLevelIndex, focusLevel, scrollActiveItemIntoView]);

  // Configuration for different categories
  const categoryConfigs = useMemo(
    () => ({
      startNode: {
        emptyStateKey: 'noStartNodeVariables',
      },
      resourceLibrary: {
        nodeIconProps: (item: MentionItem) => ({
          type: item.variableType as CanvasNodeType,
          small: true,
          url: item.variableType === 'image' ? item.metadata?.imageUrl : undefined,
          resourceType: item.metadata?.resourceType,
          resourceMeta: item.metadata?.resourceMeta,
        }),
        emptyStateKey: 'noUploadFiles',
      },
      runningRecord: {
        nodeIconProps: (item: MentionItem) => {
          if (item.source === 'stepRecord') {
            return {
              type: 'skillResponse' as CanvasNodeType,
              small: true,
            };
          } else {
            return {
              type: item.variableType as CanvasNodeType,
              small: true,
              url: item.variableType === 'image' ? item.metadata?.imageUrl : undefined,
              resourceType: item.metadata?.resourceType,
              resourceMeta: item.metadata?.resourceMeta,
            };
          }
        },
        emptyStateKey: 'noRunningRecords',
      },
    }),
    [],
  );

  // Generic function to render a single resource item
  const renderResourceItem = useCallback(
    (item: MentionItem, config: any, index: number, isActive: boolean) => (
      <div
        key={`${item.name}-${index}`}
        data-active={isActive}
        className={cn(
          'h-8 p-1.5 flex items-center gap-2 cursor-pointer transition-colors rounded-md',
          isActive ? 'bg-refly-fill-hover' : 'hover:bg-refly-fill-hover',
        )}
        onMouseEnter={() => {
          setSecondLevelIndex(index);
          setFocusLevel('second');
        }}
        onClick={() => selectItem(item)}
      >
        <NodeIcon {...config.nodeIconProps(item)} />
        <div className="flex-1 text-sm text-refly-text-0 leading-5 truncate">{item.name}</div>
      </div>
    ),
    [],
  );

  // Generic function to render empty state
  const renderEmptyState = (emptyStateKey: string) => (
    <div className="px-4 py-8 text-center text-refly-text-2 text-sm">
      {t(`canvas.richChatInput.${emptyStateKey}`)}
    </div>
  );

  const selectItem = (item: MentionItem) => {
    command(item);
  };

  // Keyboard navigation handlers
  const handleArrowUp = useCallback(() => {
    if (focusLevel === 'first') {
      const total = firstLevels?.length ?? 0;
      if (total > 0) {
        const next = (firstLevelIndex + total - 1) % total;
        setFirstLevelIndex(next);
        const nextKey = (firstLevels?.[next] as any)?.key ?? 'startNode';
        setHoveredCategory(nextKey);
      }
    } else {
      const len = currentSecondLevelItems?.length ?? 0;
      if (len > 0) {
        setSecondLevelIndex((secondLevelIndex + len - 1) % len);
      }
    }
  }, [focusLevel, firstLevels, firstLevelIndex, currentSecondLevelItems, secondLevelIndex]);

  const handleArrowDown = useCallback(() => {
    if (focusLevel === 'first') {
      const total = firstLevels?.length ?? 0;
      if (total > 0) {
        const next = (firstLevelIndex + 1) % total;
        setFirstLevelIndex(next);
        const nextKey = (firstLevels?.[next] as any)?.key ?? 'startNode';
        setHoveredCategory(nextKey);
      }
    } else {
      const len = currentSecondLevelItems?.length ?? 0;
      if (len > 0) {
        setSecondLevelIndex((secondLevelIndex + 1) % len);
      }
    }
  }, [focusLevel, firstLevels, firstLevelIndex, currentSecondLevelItems, secondLevelIndex]);

  const handleArrowLeft = useCallback(() => {
    if (focusLevel === 'second') {
      setFocusLevel('first');
    }
  }, [focusLevel]);

  const handleArrowRight = useCallback(() => {
    if (focusLevel === 'first') {
      const len = currentSecondLevelItems?.length ?? 0;
      if (len > 0) {
        setFocusLevel('second');
      }
    }
  }, [focusLevel, currentSecondLevelItems]);

  const handleEnter = useCallback(() => {
    if (focusLevel === 'second') {
      const len = currentSecondLevelItems?.length ?? 0;
      if (len > 0) {
        const item = currentSecondLevelItems?.[secondLevelIndex];
        if (item) {
          selectItem(item);
        }
      }
    }
  }, [focusLevel, currentSecondLevelItems, secondLevelIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      let handled = false;

      // Only handle specific keys when mention list is visible
      if (key === 'ArrowUp') {
        handleArrowUp();
        handled = true;
      } else if (key === 'ArrowDown') {
        handleArrowDown();
        handled = true;
      } else if (key === 'ArrowLeft') {
        handleArrowLeft();
        handled = true;
      } else if (key === 'ArrowRight') {
        handleArrowRight();
        handled = true;
      } else if (key === 'Enter') {
        handleEnter();
        handled = true;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Use capture phase to ensure we handle events before other components
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [handleArrowUp, handleArrowDown, handleArrowLeft, handleArrowRight, handleEnter]);

  return (
    <div className={cn('relative flex w-106 items-end', mentionVirtalAlign)}>
      {/* First level menu - Categories */}
      <div ref={firstLevelRef} className={firstLevelClasses}>
        {firstLevels.map((item, idx) => (
          <div
            key={item.name}
            className={cn(
              'h-8 p-1.5 cursor-pointer transition-colors hover:bg-refly-fill-hover rounded-md flex items-center gap-2',
              hoveredCategory === item.key && focusLevel === 'first' && 'bg-refly-fill-hover',
            )}
            onMouseEnter={item.onMouseEnter}
            onClick={() => {
              setHoveredCategory(item.key);
              setFirstLevelIndex(idx);
              setFocusLevel('second');
            }}
          >
            <div className="flex-1 text-sm text-refly-text-0 truncate">{item.name}</div>
            <ArrowRight size={12} color="var(--refly-text-1)" />
          </div>
        ))}
      </div>

      {/* Second level menu - Variables */}
      <div ref={secondLevelRef} className={secondLevelClasses}>
        {hoveredCategory === 'startNode' && (
          <div className="flex-1 w-full">
            {isLoadingVariables ? (
              <div className="px-4 py-8 text-center text-refly-text-2 text-sm">
                {t('canvas.richChatInput.loadingVariables')}
              </div>
            ) : groupedItems.startNode?.length > 0 ? (
              <div className="flex flex-col gap-1">
                {groupedItems.startNode.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    data-active={focusLevel === 'second' && secondLevelIndex === idx}
                    className={cn(
                      'h-8 p-1.5 cursor-pointer transition-colors rounded-md flex items-center gap-2 justify-between',
                      focusLevel === 'second' && secondLevelIndex === idx
                        ? 'bg-refly-fill-hover'
                        : 'hover:bg-refly-fill-hover',
                    )}
                    onMouseEnter={() => {
                      setSecondLevelIndex(idx);
                      setFocusLevel('second');
                    }}
                    onClick={() => selectItem(item)}
                  >
                    <X size={12} className="flex-shrink-0" color="var(--refly-primary-default)" />
                    <div className="flex-1 min-w-0 text-refly-text-0 truncate text-sm leading-5">
                      {item.name}
                    </div>
                    <div className="flex">{getStartNodeIcon(item.variableType)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-refly-text-2 text-sm">
                {t('canvas.richChatInput.noStartNodeVariables')}
              </div>
            )}
          </div>
        )}

        {hoveredCategory === 'resourceLibrary' && (
          <div className="flex-1 w-full">
            {groupedItems.resourceLibrary?.length > 0 ? (
              <div className="flex flex-col gap-1">
                {groupedItems.resourceLibrary.map((item, idx) =>
                  renderResourceItem(
                    item,
                    categoryConfigs.resourceLibrary,
                    idx,
                    focusLevel === 'second' && secondLevelIndex === idx,
                  ),
                )}
              </div>
            ) : (
              renderEmptyState(categoryConfigs.resourceLibrary.emptyStateKey)
            )}
          </div>
        )}

        {hoveredCategory === 'runningRecord' && (
          <div className="flex-1 w-full">
            {groupedItems.runningRecord?.length > 0 ? (
              <div className="flex flex-col gap-1">
                {groupedItems.runningRecord.map((item, idx) =>
                  renderResourceItem(
                    item,
                    categoryConfigs.runningRecord,
                    idx,
                    focusLevel === 'second' && secondLevelIndex === idx,
                  ),
                )}
              </div>
            ) : (
              renderEmptyState(categoryConfigs.runningRecord.emptyStateKey)
            )}
          </div>
        )}

        {/* Show default view when no category is hovered */}
        {!hoveredCategory && (
          <div className="p-8 text-center text-refly-text-2 text-sm">
            {t('canvas.richChatInput.hoverToViewVariables')}
          </div>
        )}
      </div>
    </div>
  );
};
