import { useTranslation } from 'react-i18next';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useMemo, useState, useRef } from 'react';
import { useEffect } from 'react';
import { useCallback } from 'react';
import {
  CanvasNodeType,
  ResourceMeta,
  ResourceType,
  ValueType,
  VariableValue,
  WorkflowVariable,
} from '@refly/openapi-schema';
import { ArrowRight, X } from 'refly-icons';
import { getStartNodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Button, message } from 'antd';
import { cn, genVariableID } from '@refly/utils';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useVariableView } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { logEvent } from '@refly/telemetry-web';

export interface MentionItem {
  name: string;
  description: string;
  source: 'variables' | 'resourceLibrary' | 'stepRecord' | 'resultRecord' | 'myUpload';
  variableType: string;
  variableId?: string;
  variableValue?: VariableValue[];
  entityId?: string;
  nodeId?: string;
  categoryLabel?: string;
  metadata?: {
    imageUrl?: string | undefined;
    videoUrl?: string | undefined;
    audioUrl?: string | undefined;
    resourceType?: ResourceType;
    resourceMeta?: ResourceMeta;
  };
}

export const MentionList = ({
  items,
  command,
  placement = 'bottom',
  isMentionListVisible,
  query = '',
}: {
  items: MentionItem[];
  command: any;
  placement?: 'top' | 'bottom';
  isMentionListVisible?: boolean;
  query?: string;
}) => {
  const { t } = useTranslation();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>('variables');
  // Keyboard navigation states
  const [focusLevel, setFocusLevel] = useState<'first' | 'second'>('first');
  const [firstLevelIndex, setFirstLevelIndex] = useState<number>(0);
  const [secondLevelIndex, setSecondLevelIndex] = useState<number>(0);
  // Height tracking states
  const [firstLevelHeight, setFirstLevelHeight] = useState<number>(0);
  const [secondLevelHeight, setSecondLevelHeight] = useState<number>(0);
  const { workflow, canvasId } = useCanvasContext();
  const {
    workflowVariablesLoading: isLoadingVariables,
    refetchWorkflowVariables,
    workflowVariables,
  } = workflow || {};

  const [isAddingVariable, setIsAddingVariable] = useState(false);

  const { handleVariableView } = useVariableView(canvasId);

  const handleAddVariable = useCallback(async () => {
    const isDuplicate = workflowVariables.some((variable) => variable.name === query);
    if (isDuplicate) {
      message.error(t('canvas.workflow.variables.duplicateName'));
      return;
    }

    const newItem: WorkflowVariable = {
      name: query,
      variableId: genVariableID(),
      variableType: 'string',
      value: [{ type: 'text' as ValueType, text: '' }],
      required: false,
      isSingle: true,
      options: [],
      resourceTypes: [],
    };

    const newWorkflowVariables: WorkflowVariable[] = [...workflowVariables, newItem];

    logEvent('create_variable_from_askai', Date.now(), {
      variable: newItem,
    });

    try {
      setIsAddingVariable(true);
      const { data } = await getClient().updateWorkflowVariables({
        body: {
          canvasId: canvasId,
          variables: newWorkflowVariables,
        },
      });

      if (data?.success) {
        message.success(
          <div className="flex items-center gap-2">
            <span>
              {t('canvas.workflow.variables.saveSuccess') || 'Variable created successfully'}
            </span>
            <Button
              type="link"
              size="small"
              className="p-0 h-auto !text-refly-primary-default hover:!text-refly-primary-default"
              onClick={() => handleVariableView(newItem)}
            >
              {t('canvas.workflow.variables.viewAndEdit') || 'View'}
            </Button>
          </div>,
          5, // Show for 5 seconds
        );
        refetchWorkflowVariables();
        const newMentionItem: MentionItem = { ...newItem, source: 'variables' } as MentionItem;
        command(newMentionItem);
      } else {
        message.error(t('canvas.workflow.variables.saveError'));
      }
    } catch {
      message.error(t('canvas.workflow.variables.saveError'));
    } finally {
      setIsAddingVariable(false);
    }
  }, [
    refetchWorkflowVariables,
    query,
    canvasId,
    workflowVariables,
    command,
    t,
    setIsAddingVariable,
  ]);

  // Refs for measuring panel heights
  const firstLevelRef = useRef<HTMLDivElement>(null);
  const secondLevelRef = useRef<HTMLDivElement>(null);

  // Dynamic alignment based on placement
  const mentionVirtalAlign = placement === 'top' ? 'items-end' : 'items-start';

  // Filter function for items based on query
  const filterItems = useCallback((items: MentionItem[], searchQuery: string) => {
    if (!searchQuery) return items;

    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const name = item?.name ?? '';
      return name.toLowerCase().includes(q);
    });
  }, []);

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
        key: 'variables',
        name: t('canvas.richChatInput.variables'),
        source: 'variables' as const,
        onMouseEnter: () => setHoveredCategory('variables'),
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

  // Group items by source and create canvas-based items
  const groupedItems = useMemo(() => {
    const variableItems = items.filter((item) => item.source === 'variables');
    const myUploadItems = items.filter((item) => item.source === 'myUpload');
    const stepRecordItems = items.filter((item) => item.source === 'stepRecord');
    const resultRecordItems = items.filter((item) => item.source === 'resultRecord');

    // Running record combines step records and result records
    const runningRecordItems = [...stepRecordItems, ...resultRecordItems];

    // Apply filtering based on query
    return {
      variables: filterItems(variableItems, query) || [],
      resourceLibrary: filterItems(myUploadItems, query) || [],
      runningRecord: filterItems(runningRecordItems, query) || [],
    };
  }, [items, filterItems, query]);

  // When there's a query, create grouped items with headers
  const queryModeItems = useMemo(() => {
    if (!query) return [];

    const items = [];

    // Check if there's a matching item in startNode with the same name as query
    const hasMatchingStartNodeItem =
      groupedItems.variables?.some((item) => item.name === query) ?? false;

    // If there's a query and no matching startNode item, add create variable button at the top
    if (query && !hasMatchingStartNodeItem) {
      items.push({
        type: 'item' as const,
        name: query,
        source: 'variables' as const,
        variableType: 'string',
        variableId: 'create-variable',
        categoryLabel: t('canvas.richChatInput.createVariable', { variableName: query }),
      });
    }

    // Add startNode group
    if (groupedItems.variables.length > 0) {
      items.push({
        type: 'header',
        label: t('canvas.richChatInput.variables'),
        source: 'variables' as const,
      });
      items.push(
        ...groupedItems.variables.map((item) => ({
          ...item,
          categoryLabel: t('canvas.richChatInput.variables'),
          type: 'item' as const,
        })),
      );
    }

    // Add resourceLibrary group
    if (groupedItems.resourceLibrary.length > 0) {
      items.push({
        type: 'header',
        label: t('canvas.richChatInput.resourceLibrary'),
        source: 'resourceLibrary' as const,
      });
      items.push(
        ...groupedItems.resourceLibrary.map((item) => ({
          ...item,
          categoryLabel: t('canvas.richChatInput.resourceLibrary'),
          type: 'item' as const,
        })),
      );
    }

    // Add runningRecord group
    if (groupedItems.runningRecord.length > 0) {
      items.push({
        type: 'header',
        label: t('canvas.richChatInput.runningRecord'),
        source: 'runningRecord' as const,
      });
      items.push(
        ...groupedItems.runningRecord.map((item) => ({
          ...item,
          categoryLabel: t('canvas.richChatInput.runningRecord'),
          type: 'item' as const,
        })),
      );
    }

    return items;
  }, [groupedItems, query, t]);

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
  }, [hoveredCategory, groupedItems]);

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
    if (hoveredCategory === 'variables') {
      return groupedItems.variables ?? [];
    }
    if (hoveredCategory === 'resourceLibrary') {
      return groupedItems.resourceLibrary ?? [];
    }
    if (hoveredCategory === 'runningRecord') {
      return groupedItems.runningRecord ?? [];
    }
    return [];
  }, [hoveredCategory, groupedItems]);

  // In query mode, use queryModeItems for navigation, but filter out headers
  const navigationItems = query
    ? queryModeItems.filter((item) => item.type === 'item')
    : currentSecondLevelItems;

  // Function to scroll active item into view
  const scrollActiveItemIntoView = useCallback(() => {
    if (secondLevelRef.current) {
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
  }, []);

  // Sync first level index with hoveredCategory
  useEffect(() => {
    let idx = 0;
    if (hoveredCategory === 'variables') {
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
    const len = navigationItems?.length ?? 0;
    if (len === 0) {
      setSecondLevelIndex(0);
      return;
    }
    if (secondLevelIndex > len - 1) {
      setSecondLevelIndex(0);
    }
  }, [navigationItems, secondLevelIndex]);

  // Auto-scroll to active item when secondLevelIndex changes
  useEffect(() => {
    if (query || focusLevel === 'second') {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollActiveItemIntoView();
      });
    }
  }, [secondLevelIndex, focusLevel, query, scrollActiveItemIntoView]);

  // Configuration for different categories
  const categoryConfigs = useMemo(
    () => ({
      startNode: {
        emptyStateKey: 'noVariables',
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

  // Helper function to format variable value for display
  const formatVariableValue = useCallback((variableValue?: VariableValue[]) => {
    if (!variableValue?.length) return '';

    const value = variableValue[0];
    if (value.type === 'text' && value.text) {
      // Truncate long text values
      return value.text.length > 20 ? `${value.text.substring(0, 20)}...` : value.text;
    }
    if (value.type === 'resource') {
      return value.resource?.name ?? '';
    }
    return '';
  }, []);

  // Common component for rendering list items
  const renderListItem = useCallback(
    (item: MentionItem, index: number, isActive: boolean) => {
      // Map item source to category config key
      const getCategoryKey = (source: string) => {
        if (source === 'variables') return 'variables';
        if (source === 'myUpload') return 'resourceLibrary';
        if (source === 'stepRecord' || source === 'resultRecord') return 'runningRecord';
        return source;
      };

      const categoryKey = getCategoryKey(item.source);
      const config = categoryConfigs[categoryKey as keyof typeof categoryConfigs];

      return (
        <div
          key={`${item.name}-${index}`}
          data-active={isActive}
          className={cn(
            'h-8 p-1.5 flex items-center gap-2 cursor-pointer transition-colors rounded-md',
            isActive ? 'bg-refly-fill-hover' : 'hover:bg-refly-fill-hover',
          )}
          onMouseEnter={() => {
            setSecondLevelIndex(index);
            if (!query) {
              setFocusLevel('second');
            }
          }}
          onClick={() => selectItem(item)}
        >
          {item.variableId === 'create-variable' ? (
            <div className="w-full flex items-center gap-2 overflow-hidden">
              <div className="flex-1 text-sm text-refly-text-0 leading-5 truncate">
                {item.categoryLabel}
              </div>
              {isAddingVariable && (
                <Spin size="small" className="text-refly-text-3" spinning={isAddingVariable} />
              )}
            </div>
          ) : item.source === 'variables' ? (
            <>
              <X size={12} className="flex-shrink-0" color="var(--refly-primary-default)" />
              <div className="flex-1 text-sm text-refly-text-1 leading-5 truncate">
                {item.name}
                {formatVariableValue(item.variableValue) && (
                  <span className="text-xs text-refly-text-2 ml-1 relative -top-px">
                    {`= ${formatVariableValue(item.variableValue)}`}
                  </span>
                )}
              </div>
              <div className="flex">{getStartNodeIcon(item.variableType)}</div>
            </>
          ) : (
            <>
              {config && 'nodeIconProps' in config && <NodeIcon {...config.nodeIconProps(item)} />}
              <div className="flex-1 text-sm text-refly-text-0 leading-5 truncate">{item.name}</div>
            </>
          )}
        </div>
      );
    },
    [categoryConfigs, query, isAddingVariable, formatVariableValue],
  );

  // Generic function to render empty state
  const renderEmptyState = (emptyStateKey: string) => (
    <div className="px-4 py-8 text-center text-refly-text-2 text-sm">
      {t(`canvas.richChatInput.${emptyStateKey}`)}
    </div>
  );

  const selectItem = (item: MentionItem) => {
    // Handle create variable case
    if (item.variableId === 'create-variable') {
      handleAddVariable();
      return;
    }
    command(item);
  };

  // Keyboard navigation handlers
  const handleArrowUp = useCallback(() => {
    if (query) {
      // In query mode, navigate directly in the unified list
      const len = navigationItems?.length ?? 0;
      if (len > 0) {
        setSecondLevelIndex((secondLevelIndex + len - 1) % len);
      }
    } else if (focusLevel === 'first') {
      const total = firstLevels?.length ?? 0;
      if (total > 0) {
        const next = (firstLevelIndex + total - 1) % total;
        setFirstLevelIndex(next);
        const nextKey = (firstLevels?.[next] as any)?.key ?? 'variables';
        setHoveredCategory(nextKey);
      }
    } else {
      const len = navigationItems?.length ?? 0;
      if (len > 0) {
        setSecondLevelIndex((secondLevelIndex + len - 1) % len);
      }
    }
  }, [query, focusLevel, firstLevels, firstLevelIndex, navigationItems, secondLevelIndex]);

  const handleArrowDown = useCallback(() => {
    if (query) {
      // In query mode, navigate directly in the unified list
      const len = navigationItems?.length ?? 0;
      if (len > 0) {
        setSecondLevelIndex((secondLevelIndex + 1) % len);
      }
    } else if (focusLevel === 'first') {
      const total = firstLevels?.length ?? 0;
      if (total > 0) {
        const next = (firstLevelIndex + 1) % total;
        setFirstLevelIndex(next);
        const nextKey = (firstLevels?.[next] as any)?.key ?? 'variables';
        setHoveredCategory(nextKey);
      }
    } else {
      const len = navigationItems?.length ?? 0;
      if (len > 0) {
        setSecondLevelIndex((secondLevelIndex + 1) % len);
      }
    }
  }, [query, focusLevel, firstLevels, firstLevelIndex, navigationItems, secondLevelIndex]);

  const handleArrowLeft = useCallback(() => {
    if (query || focusLevel === 'first') {
      // When at first level, left arrow should act on the input box - let the editor handle it
      return;
    }
    if (focusLevel === 'second') {
      setFocusLevel('first');
    }
  }, [query, focusLevel]);

  const handleArrowRight = useCallback(() => {
    if (query || focusLevel === 'second') {
      // In query mode, right arrow doesn't do anything - let the editor handle it
      return;
    }
    if (focusLevel === 'first') {
      const len = navigationItems?.length ?? 0;
      if (len > 0) {
        setFocusLevel('second');
      }
    }
  }, [query, focusLevel, navigationItems]);

  const handleEnter = useCallback(() => {
    if (query) {
      // In query mode, enter selects the current item
      const len = navigationItems?.length ?? 0;
      if (len > 0) {
        const item = navigationItems?.[secondLevelIndex];
        if (item) {
          selectItem(item);
        }
      }
    } else if (focusLevel === 'second') {
      const len = navigationItems?.length ?? 0;
      if (len > 0) {
        const item = navigationItems?.[secondLevelIndex];
        if (item) {
          selectItem(item);
        }
      }
    }
  }, [query, focusLevel, navigationItems, secondLevelIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isMentionListVisible) {
        return;
      }
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
        // Don't prevent default when at first level to allow editor to handle it
        handled = focusLevel !== 'first' && !query;
      } else if (key === 'ArrowRight') {
        handleArrowRight();
        // Don't prevent default when at second level to allow editor to handle it
        const len = navigationItems?.length ?? 0;

        handled = !query && focusLevel === 'first' && len > 0;
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
  }, [
    handleArrowUp,
    handleArrowDown,
    handleArrowLeft,
    handleArrowRight,
    handleEnter,
    isMentionListVisible,
  ]);

  const renderUnifiedList = () => {
    return (
      <div
        ref={secondLevelRef}
        className="w-[200px] p-2 flex box-border max-h-60 overflow-y-auto bg-refly-bg-body-z0 border-[1px] border-solid border-refly-Card-Border rounded-xl shadow-refly-m"
      >
        <div className="space-y-1 w-full">
          {queryModeItems?.map((item, idx) => {
            // Handle group headers
            if (item.type === 'header') {
              return (
                <div
                  key={`header-${item.source}-${idx}`}
                  className="px-2 py-1 text-xs font-semibold text-refly-text-3"
                >
                  {item.label}
                </div>
              );
            }

            // Handle regular items
            const isActive =
              secondLevelIndex === navigationItems.findIndex((navItem) => navItem === item);
            const navIndex = navigationItems.findIndex((navItem) => navItem === item);

            return renderListItem(item, navIndex, isActive);
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('relative flex w-106', mentionVirtalAlign)}>
      {query ? (
        renderUnifiedList()
      ) : (
        <>
          {/* First level menu - Categories */}
          <div
            ref={firstLevelRef}
            className={firstLevelClasses}
            style={{ boxShadow: '-10px 2px 20px 4px rgba(0, 0, 0, 0.04)' }}
          >
            {firstLevels.map((item, idx) => (
              <div
                key={item.key}
                className={cn(
                  'h-8 p-1.5 cursor-pointer transition-colors hover:bg-refly-fill-hover rounded-md flex items-center gap-2',
                  hoveredCategory === item.key && 'bg-refly-fill-hover',
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
          <div
            ref={secondLevelRef}
            className={secondLevelClasses}
            style={{ boxShadow: '10px 2px 20px 4px rgba(0, 0, 0, 0.04)' }}
          >
            {hoveredCategory === 'variables' && (
              <div className="flex-1 w-full">
                {isLoadingVariables ? (
                  <div className="px-4 py-8 text-center text-refly-text-2 text-sm">
                    {t('canvas.richChatInput.loadingVariables')}
                  </div>
                ) : groupedItems.variables?.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {groupedItems.variables.map((item, idx) =>
                      renderListItem(
                        item,
                        idx,
                        focusLevel === 'second' && secondLevelIndex === idx,
                      ),
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-refly-text-2 text-sm">
                    {t('canvas.richChatInput.noVariables')}
                  </div>
                )}
              </div>
            )}

            {hoveredCategory === 'resourceLibrary' && (
              <div className="flex-1 w-full">
                {groupedItems.resourceLibrary?.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {groupedItems.resourceLibrary.map((item, idx) =>
                      renderListItem(
                        item,
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
                      renderListItem(
                        item,
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
        </>
      )}
    </div>
  );
};
