import { Button, Modal, Tooltip, message } from 'antd';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import { Play, StopCircle, Preview } from 'refly-icons';
import { ActionStatus } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import {
  useGetCanvasData,
  useListUserTools,
} from '@refly-packages/ai-workspace-common/queries/queries';
import type { CanvasNode } from '@refly/canvas-common';
import type { GenericToolset, UserTool } from '@refly/openapi-schema';
import { extractToolsetsWithNodes } from '@refly/canvas-common';

/**
 * Check if a toolset is authorized/installed.
 * - MCP servers: installed if the server exists in userTools.
 * - Builtin tools: always available.
 * - OAuth tools: installed only when authorized.
 */
const isToolsetAuthorized = (toolset: GenericToolset, userTools: UserTool[]): boolean => {
  if (toolset.type === 'mcp') {
    return userTools.some((t) => t.toolset?.name === toolset.name);
  }

  if (toolset.builtin) {
    return true;
  }

  const matchingUserTool = userTools.find((t) => t.key === toolset.toolset?.key);
  if (!matchingUserTool) {
    return false;
  }

  return matchingUserTool.authorized ?? false;
};

interface SkillResponseActionsProps {
  nodeIsExecuting: boolean;
  workflowIsRunning: boolean;
  variant?: 'node' | 'preview';
  onRerunFromHere?: () => void;
  selectedToolsets?: GenericToolset[];
  // For preview variant
  onRerun?: () => void;
  // Common
  onStop: () => Promise<void>;
  // Extra actions (e.g., Close button in preview)
  extraActions?: React.ReactNode;
  readonly?: boolean;
  status?: ActionStatus;
}

const SkillResponseActionsComponent = ({
  nodeIsExecuting,
  workflowIsRunning,
  variant = 'node',
  onRerunFromHere,
  selectedToolsets,
  onRerun,
  onStop,
  extraActions,
  readonly = false,
  status,
}: SkillResponseActionsProps) => {
  const { t } = useTranslation();
  const { canvasId } = useCanvasContext();
  const { isLoggedRef, userProfile } = useIsLogin();
  const isLogin = !!userProfile?.uid;
  const nodeToolsets = Array.isArray(selectedToolsets) ? selectedToolsets : [];
  const hasNodeToolsets = nodeToolsets.some((toolset) => toolset?.id && toolset.id !== 'empty');
  const shouldCheckUserTools =
    variant !== 'preview' && (!!onRerunFromHere || (!!onRerun && hasNodeToolsets));
  const shouldCheckCanvasTools = variant !== 'preview' && !!onRerunFromHere;
  const { setToolsDependencyOpen, setToolsDependencyHighlight } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      setToolsDependencyOpen: state.setToolsDependencyOpen,
      setToolsDependencyHighlight: state.setToolsDependencyHighlight,
    }));

  const { data: userToolsData } = useListUserTools({}, [], {
    enabled: isLogin && shouldCheckUserTools,
    refetchOnWindowFocus: false,
  });
  const userTools = userToolsData?.data ?? [];

  const { data: canvasResponse, refetch: refetchCanvasData } = useGetCanvasData(
    { query: { canvasId: canvasId ?? '' } },
    [],
    {
      enabled: !!canvasId && isLogin && shouldCheckCanvasTools,
      refetchOnWindowFocus: false,
    },
  );

  // When workflow is running but current node is not executing, disable actions
  const disabled = readonly || workflowIsRunning;

  const isReRunning = status && status !== 'init';
  const singleButtonTitle = nodeIsExecuting
    ? t('canvas.skillResponse.stopSingle')
    : isReRunning
      ? t('canvas.skillResponse.rerunSingle')
      : t('canvas.skillResponse.runSingle');

  const checkAndOpenToolsDependency = useCallback(async (): Promise<boolean> => {
    // Tool dependency checking requires login and a valid canvasId.
    if (!shouldCheckCanvasTools || !isLoggedRef.current || !canvasId) {
      return false;
    }

    // Ensure we have canvas nodes to calculate tool dependencies.
    const initialNodes = canvasResponse?.data?.nodes;
    let effectiveNodes: CanvasNode[] = Array.isArray(initialNodes) ? initialNodes : [];
    if (!effectiveNodes.length) {
      try {
        const result = await refetchCanvasData();
        const nextNodes = (result as unknown as { data?: { data?: { nodes?: CanvasNode[] } } })
          ?.data?.data?.nodes;
        effectiveNodes = Array.isArray(nextNodes) ? nextNodes : [];
      } catch {
        effectiveNodes = [];
      }
    }

    const uninstalledCount = (() => {
      if (!effectiveNodes.length) return 0;
      const toolsetsWithNodes = extractToolsetsWithNodes(effectiveNodes);
      return toolsetsWithNodes.filter((tool) => !isToolsetAuthorized(tool.toolset, userTools))
        .length;
    })();

    if (uninstalledCount <= 0) {
      return false;
    }

    message.warning(t('canvas.workflow.run.installToolsBeforeRunning'));
    setToolsDependencyOpen(canvasId, true);
    setToolsDependencyHighlight(canvasId, true);
    return true;
  }, [
    shouldCheckCanvasTools,
    canvasId,
    canvasResponse,
    isLoggedRef,
    refetchCanvasData,
    setToolsDependencyHighlight,
    setToolsDependencyOpen,
    t,
    userTools,
  ]);

  const checkAndOpenNodeToolsDependency = useCallback(async (): Promise<boolean> => {
    // Single-node tool dependency checking requires login and a valid canvasId.
    if (!isLoggedRef.current || !canvasId) {
      return false;
    }

    // If current node doesn't use any tools, there's nothing to check.
    if (!hasNodeToolsets) {
      return false;
    }

    const missingCount = nodeToolsets.filter((toolset) => {
      if (!toolset?.id || toolset.id === 'empty') {
        return false;
      }
      return !isToolsetAuthorized(toolset, userTools);
    }).length;

    if (missingCount <= 0) {
      return false;
    }

    message.warning(t('canvas.workflow.run.installToolsBeforeRunning'));
    setToolsDependencyOpen(canvasId, true);
    setToolsDependencyHighlight(canvasId, true);
    return true;
  }, [
    canvasId,
    hasNodeToolsets,
    isLoggedRef,
    nodeToolsets,
    setToolsDependencyHighlight,
    setToolsDependencyOpen,
    t,
    userTools,
  ]);

  const handleRerunFromHereClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onRerunFromHere) {
        return;
      }

      void (async () => {
        const blocked = await checkAndOpenToolsDependency();
        if (blocked) {
          return;
        }
        onRerunFromHere();
      })();
    },
    [checkAndOpenToolsDependency, onRerunFromHere],
  );

  const handleRerunClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRerun) {
        onRerun();
      }
    },
    [onRerun],
  );

  const handleStopClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (nodeIsExecuting) {
        Modal.confirm({
          title: t('canvas.skillResponse.stopConfirmModal.title'),
          content: (
            <div>
              <div>{t('canvas.skillResponse.stopConfirmModal.main')}</div>
              <div className="text-sm text-gray-500">
                {t('canvas.skillResponse.stopConfirmModal.note')}
              </div>
            </div>
          ),
          okText: t('canvas.skillResponse.stopConfirmModal.confirm'),
          cancelText: t('canvas.skillResponse.stopConfirmModal.cancel'),
          icon: null,
          centered: true,
          okButtonProps: {
            className:
              '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66]',
          },
          onOk: async () => {
            logEvent('stop_agent_run', Date.now(), {});
            await onStop();
            message.success(t('canvas.skillResponse.stopSuccess'));
          },
        });
      }
    },
    [nodeIsExecuting, onStop, t, logEvent],
  );

  // Determine which icon to show
  const iconSize = variant === 'preview' ? 20 : 12;
  const iconClassName = variant === 'preview' ? '' : 'translate-y-[-1px]';
  let icon = <Play size={iconSize} className={iconClassName} />;
  if (nodeIsExecuting && !disabled) {
    icon = <StopCircle size={iconSize} className={iconClassName} />;
  }

  const buttonClassName =
    variant === 'preview'
      ? 'flex items-center justify-center'
      : '!h-5 !w-5 p-0 flex items-center justify-center hover:!bg-refly-tertiary-hover';

  const handleToggleWorkflowRun = useDebouncedCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (nodeIsExecuting) {
        handleStopClick(e);
      } else {
        const blocked = await checkAndOpenNodeToolsDependency();
        if (blocked) {
          return;
        }
        handleRerunClick(e);
      }
    },
    500,
    {
      leading: true,
      trailing: false,
    },
  );

  // Preview variant: simple button(s)
  if (variant === 'preview') {
    return (
      <>
        <Button
          type="text"
          icon={icon}
          onClick={handleToggleWorkflowRun}
          disabled={disabled}
          className={buttonClassName}
        />
        {extraActions}
      </>
    );
  }

  return (
    <>
      <Tooltip title={t('canvas.skillResponse.rerunFromHere')}>
        <Button
          type="text"
          size="small"
          icon={<Preview size={iconSize} className={iconClassName} />}
          onClick={handleRerunFromHereClick}
          disabled={disabled || nodeIsExecuting}
          className={buttonClassName}
          title={t('canvas.skillResponse.rerunFromHere')}
        />
      </Tooltip>

      <Tooltip title={singleButtonTitle}>
        <Button
          type="text"
          size="small"
          icon={icon}
          onClick={handleToggleWorkflowRun}
          disabled={disabled}
          className={buttonClassName}
          title={singleButtonTitle}
        />
      </Tooltip>
    </>
  );
};

export const SkillResponseActions = memo(SkillResponseActionsComponent);

SkillResponseActions.displayName = 'SkillResponseActions';
