import { Button, Popover, Dropdown, Badge, Typography, Tooltip } from 'antd';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Close, Mcp, Cancelled } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import './upgrade-button.scss';
import {
  useListUserTools,
  useGetCanvasData,
  useGetCreditUsageByCanvasId,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { GenericToolset, RawCanvasData, ToolsetDefinition, UserTool } from '@refly/openapi-schema';
import IssueImage from '@refly-packages/ai-workspace-common/assets/issue.svg';
import React from 'react';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import cn from 'classnames';
import { useUserStoreShallow, useSiderStoreShallow } from '@refly/stores';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useReactFlow } from '@xyflow/react';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import { useOpenInstallTool } from '@refly-packages/ai-workspace-common/hooks/use-open-install-tool';
import { useOpenInstallMcp } from '@refly-packages/ai-workspace-common/hooks/use-open-install-mcp';
import { useOAuthPopup } from '@refly-packages/ai-workspace-common/hooks/use-oauth-popup';
import { HiMagnifyingGlass } from 'react-icons/hi2';
import { RiPulseLine } from 'react-icons/ri';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { toolsetEmitter } from '@refly-packages/ai-workspace-common/events/toolset';
//import { NodeStatusChecker } from './node-status-checker';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { useSubscriptionStoreShallow } from '@refly/stores';
//import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { IoIosWarning } from 'react-icons/io';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { CreateVariablesModal } from '@refly-packages/ai-workspace-common/components/canvas/workflow-variables';
import { RiErrorWarningFill } from 'react-icons/ri';
/**
 * Check if a toolset is authorized/installed
 * - External OAuth tools: need authorization (check userTools.authorized)
 * - Other tools (builtin, non-OAuth): always available, no installation needed
 */
const isToolsetAuthorized = (toolset: GenericToolset, userTools: UserTool[]): boolean => {
  // MCP servers need to be checked separately
  if (toolset.type === 'mcp') {
    return userTools.some((t) => t.toolset?.name === toolset.name);
  }

  // Builtin tools are always available
  if (toolset.builtin) {
    return true;
  }

  // Find matching user tool by key
  const matchingUserTool = userTools.find((t) => t.key === toolset.toolset?.key);

  // If not in userTools list, user hasn't installed/authorized this tool
  if (!matchingUserTool) {
    return false;
  }

  // For external OAuth tools, check authorized status
  return matchingUserTool.authorized ?? false;
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
        {t('canvas.workflowDepencency.referencedNodes')}:
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

// Custom hook to get failed/unrun nodes count without rendering UI
/*const useFailedNodesCount = () => {
  const { nodes } = useRealtimeCanvasData();

  return useMemo(() => {
    const skillResponseNodes = nodes?.filter((node) => node.type === 'skillResponse') ?? [];

    const failedOrUnrunNodes = skillResponseNodes
      .map((node) => {
        const status = (node.data?.metadata as any)?.status;
        if (
          status === 'failed' ||
          status === 'init' ||
          (status !== 'running' && status !== 'success')
        ) {
          return { id: node.id, status };
        }
        return null;
      })
      .filter(Boolean);

    return failedOrUnrunNodes.length;
  }, [nodes]);
};*/

// Custom hook to get required inputs that are not filled
const useRequiredInputsCheck = (canvasId: string) => {
  const { data: workflowVariables } = useVariablesManagement(canvasId);

  return useMemo(() => {
    const requiredVariables =
      workflowVariables?.filter((variable) => {
        const isRequired = variable.required;
        const hasNoValue = !variable.value || variable.value.length === 0;
        const hasEmptyValue = variable.value?.every((v) => !v.text && !v.resource);
        const shouldInclude = isRequired && (hasNoValue || hasEmptyValue);

        return shouldInclude;
      }) ?? [];

    return {
      count: requiredVariables.length,
      variables: requiredVariables,
    };
  }, [workflowVariables]);
};

// Credit Insufficient Block component for showing insufficient credits warning
const CreditInsufficientBlock = React.memo(
  ({
    creditUsage,
    onUpgradeClick,
  }: {
    creditUsage: number;
    onUpgradeClick: () => void;
  }) => {
    const { t } = useTranslation();

    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-transparent rounded-xl border border-solid border-[1px] border-refly-Card-Border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1 text-refly-func-danger-default text-sm leading-5 whitespace-nowrap">
            <IoIosWarning size={26} color="#fc8800" />
          </div>
          <span className="text-refly-text-0 text-sm leading-5 whitespace-nowrap font-medium">
            {t('canvas.workflowDependency.notEnoughCredits', 'Not enough credits to run')}
          </span>
          <span className="text-refly-text-2 text-sm leading-5 whitespace-nowrap">
            {t('canvas.workflowDependency.runCost', 'Run cost: {{cost}}', { cost: creditUsage })}
          </span>
        </div>
        <Button
          className="custom-upgrade-button text-xs leading-5 font-semibold cursor-pointer whitespace-nowrap px-3 py-1 rounded-md h-auto"
          size="small"
          onClick={onUpgradeClick}
        >
          {t('canvas.workflowDependency.upgrade', 'Upgrade')}
        </Button>
      </div>
    );
  },
);

CreditInsufficientBlock.displayName = 'CreditInsufficientBlock';

// Required Input Block component for showing required inputs that are not filled
const RequiredInputBlock = React.memo(
  ({
    variable,
    onConfigureClick,
  }: {
    variable: any; // WorkflowVariable type
    onConfigureClick: (variable: any) => void;
  }) => {
    const { t } = useTranslation();

    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-transparent rounded-xl border border-solid border-[1px] border-refly-Card-Border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1 text-refly-func-danger-default text-sm leading-5 whitespace-nowrap">
            <RiErrorWarningFill size={26} color="#f93920" />
          </div>
          <span className="text-refly-text-0 text-sm leading-5 whitespace-nowrap font-medium">
            Input
          </span>
          <span className="text-refly-text-2 text-sm leading-5 whitespace-nowrap">
            {t(
              'canvas.workflowDependency.requiredInputNotFilled',
              'Required input not filled: {{input_name}}',
              { input_name: variable.name },
            )}
          </span>
        </div>
        <Button
          className="custom-configure-button text-xs leading-5 font-semibold cursor-pointer whitespace-nowrap px-3 py-1 rounded-md h-auto"
          size="middle"
          onClick={() => onConfigureClick(variable)}
        >
          {t('canvas.workflowDependency.configure', 'Configure')}
        </Button>
      </div>
    );
  },
);

RequiredInputBlock.displayName = 'RequiredInputBlock';

const NoIssueContent = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center">
      <img src={IssueImage} className="w-[207px] h-[207px] object-cover" alt="workflow issues" />
      <div className="text-center space-y-1">
        <div className="text-refly-text-0 text-sm font-medium">
          {t('canvas.workflowDepencency.youAreAwesome')}
        </div>
        <div className="text-refly-text-2 text-sm">
          {t('canvas.workflowDepencency.everythingIsSet')}
        </div>
      </div>
    </div>
  );
};

const ToolsDependencyContent = React.memo(
  ({
    uninstalledCount,
    handleClose,
    currentTools,
    userTools,
    toolsetDefinitions,
    setOpen,
    isLogin,
    totalCount,
    showReferencedNodesDisplay = false,
    highlightInstallButtons = false,
    isLoading = false,
    canvasId,
    //onFailedNodesCountChange,
    creditUsage,
  }: {
    uninstalledCount: number;
    handleClose: () => void;
    currentTools: Array<{ toolset: any; referencedNodes: any[] }>;
    userTools: UserTool[];
    toolsetDefinitions: ToolsetDefinition[];
    setOpen: (value: boolean) => void;
    isLogin: boolean;
    totalCount: number;
    showReferencedNodesDisplay?: boolean;
    highlightInstallButtons?: boolean;
    isLoading?: boolean;
    canvasId?: string;
    //onFailedNodesCountChange?: (count: number) => void;
    creditUsage?: number;
  }) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;

    // State for managing CreateVariablesModal
    const [createVariableModalVisible, setCreateVariableModalVisible] = useState(false);
    const [selectedVariable, setSelectedVariable] = useState<any>(null);

    // Get required inputs check
    const requiredInputsCheck = useRequiredInputsCheck(canvasId || '');

    const { openInstallToolByKey } = useOpenInstallTool();
    const { openInstallMcp } = useOpenInstallMcp();

    // OAuth popup for direct tool authorization (like mentionList)
    const { openOAuthPopup, isPolling, isOpening } = useOAuthPopup({
      onSuccess: (_toolsetKey) => {
        // OAuth success is handled by the event system, no additional action needed
      },
    });

    // Get credit balance and subscription store
    const { creditBalance, isBalanceSuccess } = useSubscriptionUsage();
    const { setCreditInsufficientModalVisible } = useSubscriptionStoreShallow((state) => ({
      setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
    }));

    // Check if credits are insufficient
    const isCreditInsufficient = useMemo(() => {
      if (!isLogin || !isBalanceSuccess || !creditUsage) return false;
      const requiredCredits = Number(creditUsage);
      const isRequiredCreditsValid = Number.isFinite(requiredCredits) && requiredCredits > 0;
      return isRequiredCreditsValid && creditBalance < requiredCredits;
    }, [isLogin, isBalanceSuccess, creditUsage, creditBalance]);

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
      async (toolset: GenericToolset) => {
        if (toolset.type === 'mcp') {
          // MCP tools still use the install modal
          openInstallMcp(toolset.mcpServer);
          setOpen(false);
        } else {
          // For regular toolsets, use the same authorization check as the component
          const isAuthorized = isToolsetAuthorized(toolset, userTools);
          const toolsetKey = toolset.toolset?.key;

          if (toolsetKey) {
            if (!isAuthorized) {
              // Tool is not authorized - use direct OAuth popup like mentionList
              if (isPolling || isOpening) {
                return;
              }
              // Use direct OAuth authorization like mentionList
              await openOAuthPopup(toolsetKey);
              setOpen(false);
            } else {
              // Tool is already authorized, fall back to install modal for configuration
              openInstallToolByKey(toolsetKey);
              setOpen(false);
            }
          }
        }
      },
      [
        openInstallToolByKey,
        openInstallMcp,
        setOpen,
        openOAuthPopup,
        isPolling,
        isOpening,
        userTools,
      ],
    );

    const handleCreditUpgrade = useCallback(() => {
      setCreditInsufficientModalVisible(true, undefined, 'canvas');
      setOpen(false);
    }, [setCreditInsufficientModalVisible, setOpen]);

    const handleConfigureVariable = useCallback((variable: any) => {
      setSelectedVariable(variable);
      setCreateVariableModalVisible(true);
    }, []);

    const handleCloseVariableModal = useCallback(() => {
      setCreateVariableModalVisible(false);
      setSelectedVariable(null);
    }, []);

    return (
      <div className="flex flex-col gap-3 md:gap-4 w-[calc(100vw-32px)] max-w-[480px] p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center">
                <div className="text-base md:text-lg font-semibold truncate">
                  {t('canvas.workflowDepencency.title')}
                </div>
                {uninstalledCount > 0 && isLogin && (
                  <span className="text-refly-text-0 text-base font-bold">
                    ({uninstalledCount})
                  </span>
                )}
              </div>
              {/* Subtitle - only show when there are issues to fix */}
              {(uninstalledCount > 0 ||
                isCreditInsufficient ||
                (canvasId && requiredInputsCheck.count > 0)) && (
                <div className="text-refly-text-2 text-xs font-normal">
                  {t('canvas.workflowDepencency.subtitle')}
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
        </div>

        {isLoading ? null : (
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {/* Credit Insufficient Check */}
            {isCreditInsufficient && creditUsage && (
              <CreditInsufficientBlock
                creditUsage={creditUsage}
                onUpgradeClick={handleCreditUpgrade}
              />
            )}

            {/* Required Inputs Check */}
            {canvasId &&
              requiredInputsCheck.variables.map((variable) => {
                return (
                  <RequiredInputBlock
                    key={variable.variableId}
                    variable={variable}
                    onConfigureClick={handleConfigureVariable}
                  />
                );
              })}

            {/* Node Status Checker
            {canvasId && (
              <NodeStatusChecker
                canvasId={canvasId}
                onFailedNodesCountChange={onFailedNodesCountChange}
              />
            )}*/}

            {/* Tools List */}
            {totalCount > 0 && currentTools.length > 0 && (
              <div className="space-y-2 md:space-y-3">
                {currentTools.map(({ toolset, referencedNodes }) => {
                  const isInstalled = isToolsetAuthorized(toolset, userTools);
                  const toolsetDefinition = getToolsetDefinition(toolset);
                  /*const description =
                    toolset?.type === 'mcp'
                      ? toolset.mcpServer.url
                      : toolsetDefinition?.descriptionDict?.[currentLanguage || 'en'];*/

                  return (
                    <div
                      key={toolset.id}
                      className={cn(
                        'border-solid border-[1px] border-refly-Card-Border rounded-xl p-2 md:p-3 transition-colors',
                        !isInstalled &&
                          isLogin &&
                          highlightInstallButtons &&
                          'border-[var(--refly-func-success-default)] bg-[rgba(18,183,106,0.12)] shadow-[0_0_0_3px_rgba(18,183,106,0.18)]',
                      )}
                      style={
                        !isInstalled && isLogin && highlightInstallButtons
                          ? {
                              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) 3',
                            }
                          : undefined
                      }
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
                                {isInstalled ? t('canvas.workflowDepencency.installed') : null}
                              </div>
                            )}
                          </div>
                          <div className="text-refly-text-2 text-xs leading-4 truncate">
                            {toolset.type === 'mcp'
                              ? t('canvas.workflowDepencency.mcpUnavailable')
                              : t('canvas.workflowDepencency.notAuthorized')}
                          </div>
                        </div>

                        {!isInstalled && isLogin && (
                          <Button
                            size="middle"
                            className="custom-configure-button flex-shrink-0 md:text-sm"
                            loading={isPolling || isOpening}
                            disabled={isPolling || isOpening}
                            onClick={() => handleInstallTool(toolset)}
                          >
                            {isPolling || isOpening
                              ? t('canvas.richChatInput.authorizing', '授权中...')
                              : t('canvas.workflowDepencency.goToInstall')}
                          </Button>
                        )}
                      </div>

                      {/* Referenced Nodes */}
                      {showReferencedNodesDisplay && (
                        <ReferencedNodesDisplay nodes={referencedNodes} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Show success content when no issues exist */}
            {currentTools.length === 0 &&
              !isCreditInsufficient &&
              requiredInputsCheck.count === 0 && <NoIssueContent />}
          </div>
        )}

        {/* Create Variables Modal */}
        {createVariableModalVisible && selectedVariable && (
          <CreateVariablesModal
            visible={createVariableModalVisible}
            onCancel={handleCloseVariableModal}
            defaultValue={selectedVariable}
            mode="edit"
            fromToolsDependency={true}
          />
        )}
      </div>
    );
  },
);

export const ToolsDependencyChecker = ({
  canvasData,
  externalOpen,
  highlightInstallButtons,
  onOpenChange,
  creditUsage,
}: {
  canvasData?: RawCanvasData;
  externalOpen?: boolean;
  highlightInstallButtons?: boolean;
  onOpenChange?: (open: boolean) => void;
  creditUsage?: number;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handlePopoverOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { showSettingModal } = useSiderStoreShallow((state) => ({
    showSettingModal: state.showSettingModal,
  }));

  const nodes = canvasData?.nodes || [];

  const {
    data: userToolsData,
    isLoading: toolsLoading,
    refetch: refetchUserTools,
  } = useListUserTools({}, [], {
    enabled: isLogin,
    refetchOnWindowFocus: false,
  });

  const userTools = userToolsData?.data ?? [];

  // Refetch user tools when settings modal closes (after tool installation)
  useEffect(() => {
    if (!showSettingModal && isLogin) {
      // Settings modal was closed, refetch user tools to get updated installation status
      refetchUserTools();
    }
  }, [showSettingModal, isLogin, refetchUserTools]);

  // Build toolset definitions from userTools for display purposes
  const toolsetDefinitions = useMemo(() => {
    return userTools
      .map((ut) => ut.definition || ut.toolset?.toolset?.definition)
      .filter(Boolean) as ToolsetDefinition[];
  }, [userTools]);

  // Process canvas data to find tool dependencies
  const toolsetsWithNodes = useMemo(() => {
    return extractToolsetsWithNodes(nodes);
  }, [nodes]);

  const categorizedTools = useMemo(() => {
    const authorized: ToolWithNodes[] = [];
    const unauthorized: ToolWithNodes[] = [];

    for (const toolWithNodes of toolsetsWithNodes) {
      const isAuthorized = isToolsetAuthorized(toolWithNodes.toolset, userTools);

      // Find the complete toolset data from userTools
      let completeToolset = toolWithNodes.toolset;
      const matchingUserTool = userTools.find(
        (ut) =>
          ut.key === toolWithNodes.toolset.toolset?.key ||
          ut.toolset?.id === toolWithNodes.toolset.id,
      );

      // If we found a matching user tool with more complete data, use it
      if (matchingUserTool?.toolset?.toolset?.definition) {
        completeToolset = matchingUserTool.toolset;
      }

      const enhancedToolWithNodes = {
        ...toolWithNodes,
        toolset: completeToolset,
      };

      if (isAuthorized) {
        authorized.push(enhancedToolWithNodes);
      } else {
        unauthorized.push(enhancedToolWithNodes);
      }
    }

    // Also enhance the 'all' array
    const enhancedAll = toolsetsWithNodes.map((toolWithNodes) => {
      const matchingUserTool = userTools.find(
        (ut) =>
          ut.key === toolWithNodes.toolset.toolset?.key ||
          ut.toolset?.id === toolWithNodes.toolset.id,
      );

      if (matchingUserTool?.toolset?.toolset?.definition) {
        return {
          ...toolWithNodes,
          toolset: matchingUserTool.toolset,
        };
      }

      return toolWithNodes;
    });

    return {
      all: enhancedAll,
      installed: authorized,
      uninstalled: unauthorized,
    };
  }, [toolsetsWithNodes, userTools]);

  const currentTools = categorizedTools.uninstalled || [];

  const currentToolsinInstalled = categorizedTools.installed || [];

  const uninstalledCount = useMemo(() => {
    if (!isLogin) return 0;
    if (!toolsetsWithNodes.length) return 0;
    return toolsetsWithNodes.filter((tool) => {
      return !isToolsetAuthorized(tool.toolset, userTools);
    }).length;
  }, [isLogin, userTools, toolsetsWithNodes]);

  const handleClose = useCallback(() => {
    handlePopoverOpenChange(false);
  }, [handlePopoverOpenChange]);

  const handleGoInstall = useCallback(() => {
    handlePopoverOpenChange(true);
  }, [handlePopoverOpenChange]);

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

  if (toolsLoading) return null;

  return (
    <Popover
      className="tools-in-canvas"
      open={open}
      onOpenChange={handlePopoverOpenChange}
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
          currentTools={currentTools}
          userTools={userTools}
          toolsetDefinitions={toolsetDefinitions}
          totalCount={toolsetsWithNodes.length}
          setOpen={handlePopoverOpenChange}
          showReferencedNodesDisplay={false}
          highlightInstallButtons={highlightInstallButtons}
          isLoading={toolsLoading}
          canvasId={undefined}
          //onFailedNodesCountChange={undefined}
          creditUsage={creditUsage}
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

export const ToolsDependency = ({
  canvasId,
  externalOpen,
  highlightInstallButtons,
  onOpenChange,
}: {
  canvasId: string;
  externalOpen?: boolean;
  highlightInstallButtons?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { shareData, readonly } = useCanvasContext();

  // Get failed nodes count using custom hook
  //const failedNodesCount = useFailedNodesCount();

  // Get required inputs check
  const requiredInputsCheck = useRequiredInputsCheck(canvasId);

  // Get credit balance for checking insufficient credits
  const { creditBalance, isBalanceSuccess } = useSubscriptionUsage();

  // Get credit usage estimation for this canvas
  const { data: creditUsageData } = useGetCreditUsageByCanvasId(
    {
      query: { canvasId },
    },
    undefined,
    {
      enabled: !!canvasId && isLogin,
      refetchOnWindowFocus: false,
    },
  );

  const estimatedCreditUsage = creditUsageData?.data?.total ?? 0;

  const { data: canvasResponse, isLoading: canvasLoading } = useGetCanvasData(
    { query: { canvasId } },
    [],
    {
      enabled: !!canvasId && !shareData && isLogin && !readonly,
      refetchOnWindowFocus: false,
    },
  );

  const nodes = shareData?.nodes || canvasResponse?.data?.nodes || [];

  const {
    data: userToolsData,
    isLoading: toolsLoading,
    refetch: refetchUserTools,
  } = useListUserTools({}, [], {
    enabled: isLogin,
    refetchOnWindowFocus: false,
  });

  const userTools = userToolsData?.data ?? [];

  // Listen for toolset installation events and refetch user tools
  useEffect(() => {
    const handleToolsetInstalled = (_event) => {
      // Refetch user tools when a toolset is installed
      refetchUserTools();
    };

    const handleUpdateNodeToolset = (_event) => {};

    toolsetEmitter.on('toolsetInstalled', handleToolsetInstalled);
    toolsetEmitter.on('updateNodeToolset', handleUpdateNodeToolset);

    return () => {
      toolsetEmitter.off('toolsetInstalled', handleToolsetInstalled);
      toolsetEmitter.off('updateNodeToolset', handleUpdateNodeToolset);
    };
  }, [refetchUserTools, canvasId]);

  const handlePopoverOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Build toolset definitions from userTools for display purposes
  const toolsetDefinitions = useMemo(() => {
    return userTools
      .map((ut) => ut.definition || ut.toolset?.toolset?.definition)
      .filter(Boolean) as ToolsetDefinition[];
  }, [userTools]);

  // Process canvas data to find tool dependencies
  const toolsetsWithNodes = useMemo(() => {
    return extractToolsetsWithNodes(nodes);
  }, [nodes]);

  const categorizedTools = useMemo(() => {
    const authorized: ToolWithNodes[] = [];
    const unauthorized: ToolWithNodes[] = [];

    for (const toolWithNodes of toolsetsWithNodes) {
      const isAuthorized = isToolsetAuthorized(toolWithNodes.toolset, userTools);

      // Find the complete toolset data from userTools
      let completeToolset = toolWithNodes.toolset;
      const matchingUserTool = userTools.find(
        (ut) =>
          ut.key === toolWithNodes.toolset.toolset?.key ||
          ut.toolset?.id === toolWithNodes.toolset.id,
      );

      // If we found a matching user tool with more complete data, use it
      if (matchingUserTool?.toolset?.toolset?.definition) {
        completeToolset = matchingUserTool.toolset;
      }

      const enhancedToolWithNodes = {
        ...toolWithNodes,
        toolset: completeToolset,
      };

      if (isAuthorized) {
        authorized.push(enhancedToolWithNodes);
      } else {
        unauthorized.push(enhancedToolWithNodes);
      }
    }

    // Also enhance the 'all' array
    const enhancedAll = toolsetsWithNodes.map((toolWithNodes) => {
      const matchingUserTool = userTools.find(
        (ut) =>
          ut.key === toolWithNodes.toolset.toolset?.key ||
          ut.toolset?.id === toolWithNodes.toolset.id,
      );

      if (matchingUserTool?.toolset?.toolset?.definition) {
        return {
          ...toolWithNodes,
          toolset: matchingUserTool.toolset,
        };
      }

      return toolWithNodes;
    });

    return {
      all: enhancedAll,
      installed: authorized,
      uninstalled: unauthorized,
    };
  }, [toolsetsWithNodes, userTools]);

  const currentTools = categorizedTools.uninstalled || [];

  // Check if credits are insufficient
  const isCreditInsufficient = useMemo(() => {
    if (!isLogin || !isBalanceSuccess) return false;
    const requiredCredits = Number(estimatedCreditUsage);
    const isRequiredCreditsValid = Number.isFinite(requiredCredits) && requiredCredits > 0;
    return isRequiredCreditsValid && creditBalance < requiredCredits;
  }, [isLogin, isBalanceSuccess, estimatedCreditUsage, creditBalance]);

  const totalIssuesCount = useMemo(() => {
    let baseUninstalledCount = 0;
    if (isLogin && toolsetsWithNodes.length > 0) {
      baseUninstalledCount = toolsetsWithNodes.filter((tool) => {
        return !isToolsetAuthorized(tool.toolset, userTools);
      }).length;
    }
    // Add credit insufficient count (1 if insufficient, 0 if not)
    const creditInsufficientCount = isCreditInsufficient ? 1 : 0;
    // Add required inputs count
    const requiredInputsCount = requiredInputsCheck.count;

    // merge all counts into total count
    return baseUninstalledCount + creditInsufficientCount + requiredInputsCount;
  }, [
    isLogin,
    userTools,
    toolsetsWithNodes,
    //failedNodesCount,
    isCreditInsufficient,
    requiredInputsCheck.count,
  ]);

  const handleClose = useCallback(() => {
    handlePopoverOpenChange(false);
  }, [handlePopoverOpenChange]);

  // Always show the tools dependency button, but only show badge count when there are issues

  return (
    <Popover
      className="tools-in-canvas"
      align={{ offset: [0, 10] }}
      open={open}
      onOpenChange={handlePopoverOpenChange}
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
          uninstalledCount={totalIssuesCount}
          handleClose={handleClose}
          currentTools={currentTools}
          userTools={userTools}
          toolsetDefinitions={toolsetDefinitions}
          totalCount={toolsetsWithNodes.length}
          setOpen={handlePopoverOpenChange}
          highlightInstallButtons={highlightInstallButtons}
          isLoading={canvasLoading || toolsLoading}
          canvasId={canvasId}
          //onFailedNodesCountChange={undefined}
          creditUsage={estimatedCreditUsage}
        />
      }
      arrow={false}
    >
      <div className="flex items-center">
        <Badge count={totalIssuesCount > 0 ? totalIssuesCount : 0} size="small" offset={[-3, 3]}>
          <Button
            type="text"
            icon={
              <div className="relative flex items-center">
                <HiMagnifyingGlass
                  size={24}
                  className="flex items-center"
                  style={{ strokeWidth: 0.7 }}
                />
                <RiPulseLine
                  size={11}
                  className="absolute left-[5px] top-[5.5px]"
                  style={{ strokeWidth: 2 }}
                />
              </div>
            }
            className="p-2 flex items-center justify-center font-semibold"
          />
        </Badge>
      </div>
    </Popover>
  );
};
