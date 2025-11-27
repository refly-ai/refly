import { Button, Popover, Input, Segmented, Dropdown, Badge, Typography, Tooltip } from 'antd';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Close, Mcp, Cancelled } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import {
  useListTools,
  useGetCanvasData,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { GenericToolset, RawCanvasData, ToolsetDefinition } from '@refly/openapi-schema';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import React from 'react';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import cn from 'classnames';
import { useUserStoreShallow } from '@refly/stores';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useReactFlow } from '@xyflow/react';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import { useOpenInstallTool } from '@refly-packages/ai-workspace-common/hooks/use-open-install-tool';
import { useOpenInstallMcp } from '@refly-packages/ai-workspace-common/hooks/use-open-install-mcp';
import { IoWarningOutline } from 'react-icons/io5';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListToolsetInventory } from '@refly-packages/ai-workspace-common/queries';

const isToolsetInstalled = (
  toolset: GenericToolset,
  installedToolsets: GenericToolset[],
): boolean => {
  return installedToolsets.some((t) => {
    if (toolset.type === 'regular') {
      return toolset.builtin || t.toolset?.key === toolset.toolset?.key;
    } else if (toolset.type === 'mcp') {
      return t.name === toolset.name;
    }
    return false;
  });
};

interface ReferencedNode {
  id: string;
  entityId: string;
  title: string;
  type: string;
}

interface ToolWithNodes {
  toolset: GenericToolset;
  referencedNodes: Array<ReferencedNode>;
}

// New component for displaying referenced nodes with adaptive width
const ReferencedNodesDisplay = React.memo(({ nodes }: { nodes: Array<ReferencedNode> }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(nodes.length);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const { setNodeCenter } = useNodePosition();
  const { getNodes } = useReactFlow();

  // Calculate how many nodes can fit in the container
  const calculateVisibleCount = useCallback(() => {
    if (!containerRef.current || nodes.length === 0) return;

    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) {
      return;
    }

    const separatorWidth = 10; // Width of "、" separator
    const ellipsisWidth = 12; // Width of "..."

    // Measure labels and more button in the hidden measurement container
    const measureContainer = measureContainerRef.current;
    const labelElements = measureContainer?.querySelectorAll(
      '.node-measure-label',
    ) as NodeListOf<HTMLElement> | null;
    const moreButton = measureContainer?.querySelector('.node-measure-more') as HTMLElement | null;
    const moreButtonWidth = moreButton?.offsetWidth ?? 40;

    if (!labelElements || labelElements.length === 0) return;

    let totalWidth = 0;
    let fitCount = 0;

    for (let i = 0; i < nodes.length; i++) {
      // Get the actual width of the current node label
      const currentLabelElement = labelElements[i];
      if (!currentLabelElement) break;

      const nodeWidth = currentLabelElement.offsetWidth + (i > 0 ? separatorWidth : 0);

      // Check if adding this node plus the "more" button (if needed) would fit
      const wouldFit =
        totalWidth + nodeWidth + (i < nodes.length - 1 ? moreButtonWidth + ellipsisWidth : 0) <=
        containerWidth;

      if (wouldFit) {
        totalWidth += nodeWidth;
        fitCount = i + 1;
      } else {
        break;
      }
    }

    setVisibleCount(Math.max(1, fitCount));
    setIsOverflowing(fitCount < nodes.length);
  }, [nodes]);

  // Calculate on mount and when nodes change
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      calculateVisibleCount();
    });

    return () => cancelAnimationFrame(timer);
  }, [calculateVisibleCount]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleCount();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateVisibleCount]);

  const visibleNodes = nodes.slice(0, visibleCount);
  const hiddenNodes = nodes.slice(visibleCount);

  const moreMenuItems = hiddenNodes.map((node) => ({
    key: node.id,
    label: (
      <Typography.Paragraph
        className="max-w-[150px] truncate !m-0 text-xs leading-[16px]"
        ellipsis={{ rows: 1, tooltip: true }}
      >
        {node.title}
      </Typography.Paragraph>
    ),
    icon: <NodeIcon type="skillResponse" small />,
    onClick: () => handleLocateNode(node.entityId),
  }));

  const handleLocateNode = (entityId: string) => {
    const nodes = getNodes();
    const foundNode = nodes.find((n) => n.data?.entityId === entityId);
    if (foundNode) {
      setNodeCenter(foundNode.id, true);
    }
  };

  if (nodes.length === 0) return null;

  return (
    <div className="px-2 py-1 bg-refly-bg-control-z0 rounded-lg mt-3 flex items-center gap-1">
      <div className="text-refly-text-2 text-xs leading-4 flex-shrink-0 whitespace-nowrap">
        {t('canvas.toolsDepencency.referencedNodes')}:
      </div>
      <div ref={containerRef} className="flex items-center min-w-0 flex-1 overflow-hidden">
        {visibleNodes.map((node, index) => (
          <React.Fragment key={node.id}>
            <div
              className="text-refly-primary-default text-xs leading-[16px] max-w-[100px] truncate font-semibold node-label flex-shrink-0 cursor-pointer hover:text-refly-primary-hover hover:underline active:text-refly-primary-active"
              onClick={() => handleLocateNode(node.entityId)}
            >
              {node.title}
            </div>
            {index < visibleNodes.length - 1 && (
              <div className="text-refly-text-2 text-xs flex-shrink-0 w-[10px]">、</div>
            )}
          </React.Fragment>
        ))}
        {isOverflowing && (
          <>
            <div className="text-refly-text-2 text-xs flex-shrink-0 w-[12px]">...</div>
            <Dropdown menu={{ items: moreMenuItems }} placement="top" trigger={['click']}>
              <Button
                type="text"
                size="small"
                className="more-button text-refly-primary-default hover:!text-refly-primary-default text-xs leading-[16px] px-1 h-auto min-w-0"
              >
                {t('common.more')}
              </Button>
            </Dropdown>
          </>
        )}
      </div>
      {/* Hidden measurement container for accurate width calculation */}
      <div
        ref={measureContainerRef}
        aria-hidden
        className="absolute left-[-9999px] top-[-9999px] whitespace-nowrap pointer-events-none"
      >
        {nodes.map((node) => (
          <span
            key={`measure-${node.id}`}
            className="node-measure-label text-refly-primary-default text-xs leading-[16px] max-w-[100px] truncate font-semibold inline-block mr-[10px]"
          >
            {node.title}
          </span>
        ))}
        <span className="inline-block w-[12px]">...</span>
        <Button
          type="text"
          size="small"
          className="node-measure-more text-refly-primary-default text-xs leading-[16px] px-1 h-auto min-w-0 font-semibold"
        >
          {t('common.more')}
        </Button>
      </div>
    </div>
  );
});

// Notice Block component for showing uninstalled tools warning
const NoticeBlock = React.memo(
  ({
    uninstalledCount,
    onGoInstall,
  }: {
    uninstalledCount: number;
    onGoInstall: () => void;
  }) => {
    if (uninstalledCount <= 0) return null;

    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-refly-bg-control-z0 rounded-[99px] shadow-sm border border-refly-Card-Border">
        <Cancelled
          size={16}
          color="var(--func-danger---refly-func-danger-default, #F93920)"
          className="flex-shrink-0"
        />
        <span className="text-refly-text-0 text-xs leading-4 whitespace-nowrap">
          当前账号不包含其中 {uninstalledCount} 个工具
        </span>
        <span
          className="text-refly-primary-default text-xs leading-4 font-semibold cursor-pointer hover:text-refly-primary-hover active:text-refly-primary-active whitespace-nowrap"
          onClick={onGoInstall}
        >
          去安装
        </span>
      </div>
    );
  },
);

NoticeBlock.displayName = 'NoticeBlock';

const EmptyContent = (props: { searchTerm: string }) => {
  const { searchTerm } = props;
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center py-8">
      <img
        src={EmptyImage}
        className="w-[120px] h-[120px] object-cover"
        alt="no tools dependency"
      />
      <div className="text-center text-refly-text-2 text-sm">
        {searchTerm
          ? t('canvas.toolsDepencency.noSearchResults')
          : t('canvas.toolsDepencency.noToolsDependency')}
      </div>
    </div>
  );
};

const ToolsDependencyContent = React.memo(
  ({
    uninstalledCount,
    handleClose,
    searchTerm,
    setSearchTerm,
    options,
    activeTab,
    setActiveTab,
    currentTools,
    installedToolsets,
    toolsetDefinitions,
    setOpen,
    isLogin,
    totalCount,
    showReferencedNodesDisplay = true,
    isLoading = false,
  }: {
    uninstalledCount: number;
    handleClose: () => void;
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    options: { label: string; value: string }[];
    activeTab: string;
    setActiveTab: (value: string) => void;
    currentTools: Array<{ toolset: any; referencedNodes: any[] }>;
    installedToolsets: any[];
    toolsetDefinitions: ToolsetDefinition[];
    setOpen: (value: boolean) => void;
    isLogin: boolean;
    totalCount: number;
    showReferencedNodesDisplay?: boolean;
    isLoading?: boolean;
  }) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;

    const { openInstallToolByKey } = useOpenInstallTool();
    const { openInstallMcp } = useOpenInstallMcp();

    // Helper function to get complete toolset definition
    const getToolsetDefinition = useCallback(
      (toolset: GenericToolset) => {
        // First try to get from toolset itself
        if (toolset?.toolset?.definition) {
          return toolset.toolset.definition;
        }

        // If not found, try to find from toolsetInventoryData by toolsetKey
        if (toolset?.toolset?.key && toolsetDefinitions) {
          const definition = toolsetDefinitions.find((item) => item.key === toolset.toolset.key);
          if (definition) {
            return definition;
          }
        }

        return null;
      },
      [toolsetDefinitions],
    );

    const handleInstallTool = useCallback(
      (toolset: GenericToolset) => {
        if (toolset.type === 'mcp') {
          openInstallMcp(toolset.mcpServer);
        } else {
          openInstallToolByKey(toolset.toolset?.key);
        }
        setOpen(false);
      },
      [openInstallToolByKey, openInstallMcp, setOpen],
    );

    return (
      <div className="flex flex-col gap-3 md:gap-4 w-[calc(100vw-32px)] max-w-[480px] p-4 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <div className="text-base md:text-lg font-semibold truncate">
              {t('canvas.toolsDepencency.title')}
            </div>
            {uninstalledCount > 0 && isLogin && (
              <div className="max-w-[120px] md:max-w-[200px] truncate bg-refly-Colorful-red-light text-refly-func-danger-default rounded-[99px] px-2 text-xs leading-[18px] flex-shrink-0">
                {t('canvas.toolsDepencency.uninstalledToolsCount', {
                  count: uninstalledCount,
                })}
              </div>
            )}
          </div>
          <Button
            type="text"
            icon={<Close size={20} />}
            onClick={handleClose}
            className="flex-shrink-0"
          />
        </div>

        {isLoading ? null : totalCount > 0 ? (
          <>
            <div className="flex flex-col gap-2 md:gap-3">
              <Input
                placeholder={t('canvas.toolsDepencency.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg"
              />

              {isLogin && (
                <Segmented
                  shape="round"
                  options={options}
                  value={activeTab}
                  onChange={setActiveTab}
                  className="w-full [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center"
                />
              )}
            </div>

            {/* Tools List */}
            <div className="max-h-[400px] overflow-y-auto space-y-2 md:space-y-3">
              {currentTools.length === 0 ? (
                <EmptyContent searchTerm={searchTerm} />
              ) : (
                currentTools.map(({ toolset, referencedNodes }) => {
                  const isInstalled = isToolsetInstalled(toolset, installedToolsets);
                  const toolsetDefinition = getToolsetDefinition(toolset);
                  const description =
                    toolset?.type === 'mcp'
                      ? toolset.mcpServer.url
                      : toolsetDefinition?.descriptionDict?.[currentLanguage || 'en'];

                  return (
                    <div
                      key={toolset.id}
                      className="border-solid border-[1px] border-refly-Card-Border rounded-xl p-2 md:p-3"
                    >
                      {/* Tool Header */}
                      <div className="py-1 px-1 md:px-2 flex items-center justify-between gap-2 md:gap-3">
                        <div className="flex-shrink-0">
                          <ToolsetIcon
                            toolset={toolset}
                            config={{ builtinClassName: '!w-5 !h-5 md:!w-6 md:!h-6' }}
                          />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <div className="min-w-0 max-w-full text-refly-text-0 text-xs md:text-sm font-semibold leading-5 truncate">
                              {(toolsetDefinition?.labelDict?.[currentLanguage] as string) ||
                                toolset.name}
                            </div>

                            {isLogin && (
                              <div
                                className={cn(
                                  'flex-shrink-0 whitespace-nowrap text-[10px] leading-[16px] font-semibold rounded-[4px] px-1',
                                  isInstalled
                                    ? 'text-refly-primary-default bg-refly-primary-light'
                                    : 'text-refly-func-danger-default bg-refly-Colorful-red-light',
                                )}
                              >
                                {isInstalled
                                  ? t('canvas.toolsDepencency.installed')
                                  : t('canvas.toolsDepencency.uninstalled')}
                              </div>
                            )}
                          </div>
                          <div className="text-refly-text-2 text-xs leading-4 truncate">
                            {description ? description : <>&nbsp;</>}
                          </div>
                        </div>

                        {!isInstalled && isLogin && (
                          <Button
                            type="text"
                            size="small"
                            className="text-refly-primary-default hover:!text-refly-primary-hover flex-shrink-0 text-xs md:text-sm"
                            onClick={() => handleInstallTool(toolset)}
                          >
                            {t('canvas.toolsDepencency.goToInstall')}
                          </Button>
                        )}
                      </div>

                      {/* Referenced Nodes */}
                      {showReferencedNodesDisplay && (
                        <ReferencedNodesDisplay nodes={referencedNodes} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <EmptyContent searchTerm="" />
        )}
      </div>
    );
  },
);

export const ToolsDependencyChecker = ({ canvasData }: { canvasData?: RawCanvasData }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const nodes = canvasData?.nodes || [];

  const { data, isLoading: toolsLoading } = useListTools({ query: { enabled: true } }, [], {
    enabled: isLogin,
    refetchOnWindowFocus: false,
  });
  const { data: toolsetInventoryData } = useListToolsetInventory({}, null, {
    enabled: true,
  });
  const toolsetDefinitions = toolsetInventoryData?.data ?? [];

  const installedToolsets = data?.data ?? [];

  const [_, setSelectedToolsets] = useState<GenericToolset[]>([]);

  // Set initial selected toolsets when installedToolsets data is loaded
  useEffect(() => {
    if (installedToolsets?.length > 0) {
      setSelectedToolsets(installedToolsets);
    }
  }, [installedToolsets]);

  // Process canvas data to find tool dependencies
  const toolsetsWithNodes = useMemo(() => {
    return extractToolsetsWithNodes(nodes);
  }, [nodes]);

  const filteredToolsets = useMemo(() => {
    if (!searchTerm.trim()) return toolsetsWithNodes;

    return toolsetsWithNodes.filter(
      ({ toolset }) =>
        toolset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        toolset.id.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [toolsetsWithNodes, searchTerm]);

  const categorizedTools = useMemo(() => {
    const installed: ToolWithNodes[] = [];
    const uninstalled: ToolWithNodes[] = [];

    for (const toolWithNodes of filteredToolsets) {
      const isInstalled = isToolsetInstalled(toolWithNodes.toolset, installedToolsets);

      // Find the complete toolset data from installedToolsets
      let completeToolset = toolWithNodes.toolset;
      const matchingInstalled = installedToolsets?.find(
        (installedTool) => installedTool.id === toolWithNodes.toolset.id,
      );

      // If we found a matching installed toolset with more complete data, use it
      if (matchingInstalled?.toolset?.definition) {
        completeToolset = matchingInstalled;
      }

      const enhancedToolWithNodes = {
        ...toolWithNodes,
        toolset: completeToolset,
      };

      if (isInstalled) {
        installed.push(enhancedToolWithNodes);
      } else {
        uninstalled.push(enhancedToolWithNodes);
      }
    }

    // Also enhance the 'all' array
    const enhancedAll = filteredToolsets.map((toolWithNodes) => {
      const matchingInstalled = installedToolsets?.find(
        (installedTool) => installedTool.id === toolWithNodes.toolset.id,
      );

      if (matchingInstalled?.toolset?.definition) {
        return {
          ...toolWithNodes,
          toolset: matchingInstalled,
        };
      }

      return toolWithNodes;
    });

    return {
      all: enhancedAll,
      installed,
      uninstalled,
    };
  }, [filteredToolsets, installedToolsets]);

  const currentTools = categorizedTools[activeTab as keyof typeof categorizedTools] || [];

  const currentToolsinInstalled = categorizedTools.installed || [];

  const uninstalledCount = useMemo(() => {
    if (!isLogin) return 0;
    if (!toolsetsWithNodes.length) return 0;
    return toolsetsWithNodes.filter((tool) => {
      return !isToolsetInstalled(tool.toolset, installedToolsets);
    }).length;
  }, [isLogin, installedToolsets, toolsetsWithNodes]);

  const options = useMemo(() => {
    return [
      {
        label: t('canvas.toolsDepencency.all'),
        value: 'all',
      },
      {
        label: t('canvas.toolsDepencency.installed'),
        value: 'installed',
      },

      {
        label: t('canvas.toolsDepencency.uninstalled'),
        value: 'uninstalled',
      },
    ];
  }, [t]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearchTerm('');
    setActiveTab('all');
  }, []);

  const handleGoInstall = useCallback(() => {
    setOpen(true);
    setActiveTab('uninstalled');
  }, []);

  const defaultTrigger = (
    <Tooltip title={t('tools.useTools')} placement="bottom">
      <Button
        className={cn(
          'gap-0 h-7 w-auto flex items-center justify-center hover:bg-refly-tertiary-hover rounded-2xl',
          {
            '!w-7': !currentToolsinInstalled?.length,
            'bg-refly-bg-control-z0': currentToolsinInstalled?.length,
            'bg-refly-fill-active': open,
          },
        )}
        type="text"
        size="small"
        icon={<Mcp size={20} className="flex items-center" />}
      >
        {currentToolsinInstalled?.length > 0 && (
          <div className="ml-1.5 flex items-center">
            {currentToolsinInstalled.slice(0, 3).map((toolset) => {
              return (
                <ToolsetIcon
                  key={toolset.toolset.id}
                  toolset={toolset.toolset}
                  config={{
                    size: 14,
                    className:
                      'bg-refly-bg-body-z0 shadow-refly-s p-0.5 -mr-[7px] last:mr-0 rounded-full',
                    builtinClassName: '!w-3.5 !h-3.5',
                  }}
                />
              );
            })}
            {currentToolsinInstalled.length > 3 && (
              <div className="min-w-[18px] h-[18px] p-0.5 box-border flex items-center justify-center rounded-full bg-refly-bg-body-z0 shadow-refly-s text-refly-text-1 text-[10px]">
                +{currentToolsinInstalled.length - 3}
              </div>
            )}
          </div>
        )}
      </Button>
    </Tooltip>
  );

  return toolsLoading ? null : (
    <Popover
      className="tools-in-canvas"
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      styles={{
        body: {
          padding: 0,
          borderRadius: '20px',
          boxShadow: '0px 8px 32px 0px rgba(0, 0, 0, 0.08)',
        },
      }}
      content={
        <ToolsDependencyContent
          isLogin={isLogin}
          uninstalledCount={uninstalledCount}
          handleClose={handleClose}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          options={options}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentTools={currentTools}
          installedToolsets={installedToolsets}
          toolsetDefinitions={toolsetDefinitions}
          totalCount={toolsetsWithNodes.length}
          setOpen={setOpen}
          showReferencedNodesDisplay={false}
          isLoading={toolsLoading}
        />
      }
      arrow={false}
    >
      <div className="relative flex items-center">
        <Badge count={uninstalledCount} size="small" offset={[-2, 0]}>
          {defaultTrigger}
        </Badge>
        {/* Notice block for uninstalled tools */}
        {uninstalledCount > 0 && isLogin && (
          <div className="ml-2">
            <NoticeBlock uninstalledCount={uninstalledCount} onGoInstall={handleGoInstall} />
          </div>
        )}
      </div>
    </Popover>
  );
};

export const ToolsDependency = ({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { shareData, readonly } = useCanvasContext();

  const { data: canvasResponse, isLoading: canvasLoading } = useGetCanvasData(
    { query: { canvasId } },
    [],
    {
      enabled: !!canvasId && !shareData && isLogin && !readonly,
      refetchOnWindowFocus: false,
    },
  );

  const nodes = shareData?.nodes || canvasResponse?.data?.nodes || [];

  const { data, isLoading: toolsLoading } = useListTools({ query: { enabled: true } }, [], {
    enabled: isLogin,
    refetchOnWindowFocus: false,
  });
  const { data: toolsetInventoryData } = useListToolsetInventory({}, null, {
    enabled: true,
  });
  const toolsetDefinitions = toolsetInventoryData?.data ?? [];

  const installedToolsets = data?.data ?? [];

  // Process canvas data to find tool dependencies
  const toolsetsWithNodes = useMemo(() => {
    return extractToolsetsWithNodes(nodes);
  }, [nodes]);

  const filteredToolsets = useMemo(() => {
    if (!searchTerm.trim()) return toolsetsWithNodes;

    return toolsetsWithNodes.filter(
      ({ toolset }) =>
        toolset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        toolset.id.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [toolsetsWithNodes, searchTerm]);

  const categorizedTools = useMemo(() => {
    const installed: ToolWithNodes[] = [];
    const uninstalled: ToolWithNodes[] = [];

    for (const toolWithNodes of filteredToolsets) {
      const isInstalled = isToolsetInstalled(toolWithNodes.toolset, installedToolsets);

      // Find the complete toolset data from installedToolsets
      let completeToolset = toolWithNodes.toolset;
      const matchingInstalled = installedToolsets?.find(
        (installedTool) => installedTool.id === toolWithNodes.toolset.id,
      );

      // If we found a matching installed toolset with more complete data, use it
      if (matchingInstalled?.toolset?.definition) {
        completeToolset = matchingInstalled;
      }

      const enhancedToolWithNodes = {
        ...toolWithNodes,
        toolset: completeToolset,
      };

      if (isInstalled) {
        installed.push(enhancedToolWithNodes);
      } else {
        uninstalled.push(enhancedToolWithNodes);
      }
    }

    // Also enhance the 'all' array
    const enhancedAll = filteredToolsets.map((toolWithNodes) => {
      const matchingInstalled = installedToolsets?.find(
        (installedTool) => installedTool.id === toolWithNodes.toolset.id,
      );

      if (matchingInstalled?.toolset?.definition) {
        return {
          ...toolWithNodes,
          toolset: matchingInstalled,
        };
      }

      return toolWithNodes;
    });

    return {
      all: enhancedAll,
      installed,
      uninstalled,
    };
  }, [filteredToolsets, installedToolsets]);

  const currentTools = categorizedTools[activeTab as keyof typeof categorizedTools] || [];

  const uninstalledCount = useMemo(() => {
    if (!isLogin) return 0;
    if (!toolsetsWithNodes.length) return 0;
    return toolsetsWithNodes.filter((tool) => {
      return !isToolsetInstalled(tool.toolset, installedToolsets);
    }).length;
  }, [isLogin, installedToolsets, toolsetsWithNodes]);

  const options = useMemo(() => {
    return [
      {
        label: t('canvas.toolsDepencency.all'),
        value: 'all',
      },
      {
        label: t('canvas.toolsDepencency.installed'),
        value: 'installed',
      },

      {
        label: t('canvas.toolsDepencency.uninstalled'),
        value: 'uninstalled',
      },
    ];
  }, [t]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearchTerm('');
    setActiveTab('all');
  }, []);

  // Only show the tools dependency button if there are uninstalled tools
  if (uninstalledCount === 0) {
    return null;
  }

  return (
    <Popover
      className="tools-in-canvas"
      align={{ offset: [0, 10] }}
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      styles={{
        body: {
          padding: 0,
          borderRadius: '20px',
          boxShadow: '0px 8px 32px 0px rgba(0, 0, 0, 0.08)',
        },
      }}
      content={
        <ToolsDependencyContent
          isLogin={isLogin}
          uninstalledCount={uninstalledCount}
          handleClose={handleClose}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          options={options}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentTools={currentTools}
          installedToolsets={installedToolsets}
          toolsetDefinitions={toolsetDefinitions}
          totalCount={toolsetsWithNodes.length}
          setOpen={setOpen}
          isLoading={canvasLoading || toolsLoading}
        />
      }
      arrow={false}
    >
      <div className="flex items-center">
        <Badge count={uninstalledCount} size="small" offset={[-2, 0]}>
          <Button
            type="text"
            icon={
              <IoWarningOutline
                size={18}
                color="var(--refly-func-warning-default)"
                className="flex items-center"
              />
            }
            className="p-2 flex items-center justify-center font-semibold"
          />
        </Badge>
      </div>
    </Popover>
  );
};
