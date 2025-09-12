import { Button, Popover, Input, Segmented, Dropdown, Badge, Typography } from 'antd';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Tools, Close } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useListTools } from '@refly-packages/ai-workspace-common/queries/queries';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { GenericToolset } from '@refly/openapi-schema';
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

const isToolsetInstalled = (
  toolset: GenericToolset,
  installedToolsets: GenericToolset[],
): boolean => {
  return installedToolsets.some((t) => {
    if (toolset.type === 'regular') {
      return toolset.id === 'builtin' || t.toolset?.key === toolset.toolset?.key;
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
    setOpen,
    isLogin,
    totalCount,
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
    setOpen: (value: boolean) => void;
    isLogin: boolean;
    totalCount: number;
  }) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;

    const { openInstallToolByKey } = useOpenInstallTool();
    const { openInstallMcp } = useOpenInstallMcp();

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
      <div className="flex flex-col gap-4 w-[480px] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="text-lg font-semibold">{t('canvas.toolsDepencency.title')}</div>
            {uninstalledCount > 0 && isLogin && (
              <div className="max-w-[200px] truncate bg-refly-Colorful-red-light text-refly-func-danger-default rounded-[99px] px-2 text-xs leading-[18px]">
                {t('canvas.toolsDepencency.uninstalledToolsCount', {
                  count: uninstalledCount,
                })}
              </div>
            )}
          </div>
          <Button type="text" icon={<Close size={20} />} onClick={handleClose} />
        </div>

        {totalCount > 0 ? (
          <>
            <div className="flex flex-col gap-3">
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
            <div className="max-h-[400px] overflow-y-auto space-y-3">
              {currentTools.length === 0 ? (
                <EmptyContent searchTerm={searchTerm} />
              ) : (
                currentTools.map(({ toolset, referencedNodes }) => {
                  const isInstalled = isToolsetInstalled(toolset, installedToolsets);
                  const description =
                    toolset?.type === 'mcp'
                      ? toolset.mcpServer.url
                      : toolset?.toolset?.definition?.descriptionDict?.[currentLanguage || 'en'];

                  return (
                    <div
                      key={toolset.id}
                      className="border-solid border-[1px] border-refly-Card-Border rounded-xl p-3"
                    >
                      {/* Tool Header */}
                      <div className="py-1 px-2 flex items-center justify-between gap-3">
                        <ToolsetIcon
                          toolset={toolset}
                          isBuiltin={toolset.id === 'builtin'}
                          config={{ builtinClassName: '!w-6 !h-6' }}
                        />

                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <div className="min-w-0 max-w-full text-refly-text-0 text-sm font-semibold leading-5 truncate">
                              {toolset.type === 'regular' && toolset.id === 'builtin'
                                ? (toolset?.toolset?.definition?.labelDict?.[
                                    currentLanguage
                                  ] as string)
                                : toolset.name}
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
                            {description}
                          </div>
                        </div>

                        {!isInstalled && isLogin && (
                          <Button
                            className="text-refly-primary-default hover:!text-refly-primary-hover"
                            onClick={() => handleInstallTool(toolset)}
                          >
                            {t('canvas.toolsDepencency.goToInstall')}
                          </Button>
                        )}
                      </div>

                      {/* Referenced Nodes */}
                      <ReferencedNodesDisplay nodes={referencedNodes} />
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

export const ToolsDependency = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const { nodes } = useCanvasData();

  const { data } = useListTools({ query: { enabled: true } }, [], {
    enabled: isLogin,
    refetchOnWindowFocus: false,
  });

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

      if (isInstalled) {
        installed.push(toolWithNodes);
      } else {
        uninstalled.push(toolWithNodes);
      }
    }

    return {
      all: filteredToolsets,
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

  return (
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
          totalCount={toolsetsWithNodes.length}
          setOpen={setOpen}
        />
      }
      arrow={false}
    >
      <Badge count={uninstalledCount} size="small" offset={[-2, 0]}>
        <Button
          type="text"
          icon={
            <Tools
              size={20}
              color={open ? 'var(--refly-primary-default)' : 'var(--refly-text-0)'}
            />
          }
          className={cn(
            '!p-0 h-[30px] w-[30px] flex items-center justify-center',
            open && '!bg-gradient-tools-open',
          )}
        />
      </Badge>
    </Popover>
  );
};
