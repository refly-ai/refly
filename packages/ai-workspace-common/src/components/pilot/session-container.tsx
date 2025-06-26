import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow, XYPosition } from '@xyflow/react';
import { ActionResult, PilotSession, PilotStep } from '@refly/openapi-schema';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { Button, Skeleton, Tooltip, Popover, Empty, Divider, Progress } from 'antd';
import { useGetPilotSessionDetail } from '@refly-packages/ai-workspace-common/queries/queries';
import {
  useAddNode,
  useInvokeAction,
  useNodePosition,
  useNodePreviewControl,
} from '@refly-packages/ai-workspace-common/hooks/canvas';
import { cn } from '@refly/utils/cn';
import { PilotStepItem } from './pilot-step-item';
import { SessionStatusTag } from './session-status-tag';
import { PilotList } from './pilot-list';
import {
  IconClose,
  IconPilot,
  IconThreadHistory,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { RiChatNewLine } from 'react-icons/ri';
import { usePilotStoreShallow } from '@refly-packages/ai-workspace-common/stores/pilot';
import { SessionChat } from './session-chat';
import {
  convertContextItemsToNodeFilters,
  convertResultContextToItems,
} from '@refly-packages/ai-workspace-common/utils/map-context-items';

const SessionHeader = memo(
  ({
    canvasId,
    session,
    steps,
    onClose,
    onSessionClick,
  }: {
    canvasId: string;
    session: PilotSession;
    steps: PilotStep[];
    onClose: () => void;
    onSessionClick: (sessionId: string) => void;
  }) => {
    const { t } = useTranslation();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const handleSessionClick = useCallback(
      (sessionId: string) => {
        onSessionClick(sessionId);
        setIsHistoryOpen(false);
      },
      [onSessionClick],
    );

    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#0078FF] shadow-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium flex items-center justify-center">
              <IconPilot className="w-4 h-4" />
            </span>
          </div>
          <span className="text-sm font-medium leading-normal max-w-[220px] truncate">
            {session?.title || t('pilot.newSession')}
          </span>
          {session?.status && (
            <SessionStatusTag status={session?.status} className="h-5 flex items-center" />
          )}
        </div>

        <div className="flex items-center gap-1">
          {steps.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Progress
                type="circle"
                percent={Math.round(
                  (steps.filter((step) => step.status === 'finish').length / steps.length) * 100,
                )}
                size={14}
                strokeColor="#00968F"
              />
              <div className="text-xs font-medium flex items-center">
                {steps.filter((step) => step.status === 'finish').length} / {steps.length}
              </div>
              <Divider type="vertical" className="h-5 mx-1" />
            </div>
          )}
          <Tooltip title={t('pilot.newSession')}>
            <Button
              type="text"
              size="small"
              className="flex items-center justify-center p-0 !w-7 h-7 text-gray-500 hover:text-gray-600 min-w-0"
              icon={<RiChatNewLine className="w-4 h-4" />}
              onClick={() => handleSessionClick(null)}
            />
          </Tooltip>
          <Popover
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            placement="bottomRight"
            trigger="click"
            getPopupContainer={() => document.body}
            arrow={false}
            content={
              <PilotList
                show={isHistoryOpen}
                limit={10}
                targetId={canvasId}
                targetType="canvas"
                onSessionClick={(session) => handleSessionClick(session.sessionId)}
              />
            }
          >
            <Tooltip title={t('pilot.sessionHistory', { defaultValue: 'Session History' })}>
              <Button
                type="text"
                size="small"
                className={`flex items-center justify-center p-0 !w-7 h-7 ${isHistoryOpen ? 'text-primary-600' : 'text-gray-500 hover:text-gray-600'} min-w-0`}
                icon={<IconThreadHistory className="w-4 h-4" />}
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              />
            </Tooltip>
          </Popover>
          <Button
            type="text"
            size="small"
            className="flex items-center justify-center p-0 w-7 h-7 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 min-w-0"
            onClick={onClose}
          >
            <IconClose className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  },
);

SessionHeader.displayName = 'SessionHeader';

export const NoSession = memo(
  ({ loading, error, canvasId }: { loading: boolean; error: boolean; canvasId: string }) => {
    const { t } = useTranslation();
    return (
      <div className="p-4 bg-white dark:bg-gray-900 shadow h-full">
        {loading && <Skeleton active paragraph={{ rows: 4 }} />}
        {error && (
          <p>{t('pilot.loadFailed', { defaultValue: 'Failed to load session details' })}</p>
        )}
        {!loading && !error && (
          <div className="h-full">
            <SessionChat canvasId={canvasId} />
          </div>
        )}
      </div>
    );
  },
);
NoSession.displayName = 'NoSession';

// Define the active statuses that require polling
const ACTIVE_STATUSES = ['executing', 'waiting'];
const POLLING_INTERVAL = 2000; // 2 seconds

export interface SessionContainerProps {
  sessionId: string;
  canvasId: string;
  className?: string;
  onStepClick?: (step: PilotStep) => void;
}

// Add a styled pilot icon component with animation
const AnimatedPilotIcon = memo(({ className }: { className?: string }) => {
  // Define the keyframes in a style object
  const floatingAnimationStyle = {
    animation: 'floating 2s ease-in-out infinite',
  };

  // Add the keyframes to the document if they don't exist yet
  useEffect(() => {
    if (!document.getElementById('floating-keyframes')) {
      const style = document.createElement('style');
      style.id = 'floating-keyframes';
      style.innerHTML = `
        @keyframes floating {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `;
      document.head.appendChild(style);

      // Clean up on unmount
      return () => {
        const existingStyle = document.getElementById('floating-keyframes');
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    }
  }, []);

  return (
    <div className="animate-pulse">
      <IconPilot className={cn('text-primary-500', className)} style={floatingAnimationStyle} />
    </div>
  );
});

AnimatedPilotIcon.displayName = 'AnimatedPilotIcon';

// Component for animated ellipsis that cycles through dots
const AnimatedEllipsis = memo(() => {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    // Set up the interval to change dot counts every 600ms for a more natural rhythm
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // Use a fixed-width span to prevent layout shifts as the dots change
  return (
    <span className="inline-block min-w-[24px] text-left" aria-hidden="true">
      {'.'.repeat(dotCount)}
    </span>
  );
});

AnimatedEllipsis.displayName = 'AnimatedEllipsis';

export const SessionContainer = memo(
  ({ sessionId, canvasId, className, onStepClick }: SessionContainerProps) => {
    const { t } = useTranslation();
    const [isPolling, setIsPolling] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<string | null>(null);
    const { getNodes } = useReactFlow<CanvasNode<any>>();

    const { setIsPilotOpen, setActiveSessionId } = usePilotStoreShallow((state) => ({
      setIsPilotOpen: state.setIsPilotOpen,
      setActiveSessionId: state.setActiveSessionId,
    }));

    const handleSessionClick = useCallback(
      (sessionId: string) => {
        setActiveSessionId(sessionId);
      },
      [setActiveSessionId],
    );
    const { setNodeCenter } = useNodePosition();
    const { handleNodePreview } = useNodePreviewControl({ canvasId });

    const containerClassName = useMemo(
      () =>
        cn(
          'flex-shrink-0',
          'bg-white dark:bg-gray-900',
          'border',
          'border-gray-200 dark:border-gray-700',
          'flex',
          'flex-col',
          'w-full h-full',
          'rounded-lg',
          className,
        ),
      [className],
    );

    const { invokeAction } = useInvokeAction();
    const { addNode } = useAddNode();

    // Fetch the pilot session details
    const {
      data: sessionData,
      isLoading,
      error,
    } = useGetPilotSessionDetail(
      {
        query: { sessionId },
      },
      null,
      {
        enabled: !!sessionId,
        refetchInterval: isPolling ? POLLING_INTERVAL : false,
      },
    );

    const session = useMemo(() => sessionData?.data, [sessionData]);

    // Check if the session is in an active state that requires polling
    const shouldPoll = useMemo(() => {
      return ACTIVE_STATUSES.includes(sessionStatus ?? '');
    }, [sessionStatus]);

    const handleClose = useCallback(() => {
      setIsPilotOpen(false);
    }, [setIsPilotOpen]);

    const handleStepClick = useCallback(
      (step: PilotStep) => {
        const nodes = getNodes();
        const node = nodes.find((node) => node.data?.metadata?.pilotStepId === step.stepId);
        if (node) {
          setNodeCenter(node.id, true);
          handleNodePreview(node);
        }

        if (onStepClick) {
          onStepClick(step);
        }
      },
      [onStepClick, setNodeCenter],
    );

    const handleInvokeAction = useCallback(
      (result: ActionResult, offsetPosition: XYPosition) => {
        console.log('[handleInvokeAction] result', result);
        const {
          input,
          resultId,
          actionMeta,
          modelInfo,
          runtimeConfig,
          tplConfig,
          targetId,
          targetType,
          context,
          history,
        } = result;

        invokeAction(
          {
            query: input.query,
            resultId,
            selectedSkill: actionMeta,
            modelInfo,
            tplConfig,
            runtimeConfig,
          },
          {
            entityId: targetId,
            entityType: targetType,
          },
        );

        const contextItems = convertResultContextToItems(context, history);
        addNode(
          {
            type: 'skillResponse',
            data: {
              title: input.query,
              entityId: resultId,
              metadata: {
                status: 'executing',
                selectedSkill: actionMeta,
                modelInfo,
                runtimeConfig,
                tplConfig,
                pilotStepId: result.pilotStepId,
                pilotSessionId: sessionId,
              },
            },
            offsetPosition,
          },
          convertContextItemsToNodeFilters(contextItems),
          false,
        );
      },
      [invokeAction, addNode, sessionId],
    );

    // Sort steps by epoch and creation time
    const sortedSteps = useMemo(() => {
      if (!session?.steps?.length) return [];

      return [...session.steps].sort((a, b) => {
        // First sort by epoch
        if ((a.epoch ?? 0) !== (b.epoch ?? 0)) {
          return (a.epoch ?? 0) - (b.epoch ?? 0);
        }

        // Then by creation time for steps within the same epoch
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }

        return 0;
      });
    }, [session?.steps]);

    // Update session status whenever it changes
    useEffect(() => {
      if (session?.status) {
        setSessionStatus(session.status);
      }
    }, [session?.status]);

    // Set up polling based on session status
    useEffect(() => {
      if (shouldPoll && !isPolling) {
        setIsPolling(true);
      } else if (!shouldPoll && isPolling) {
        setIsPolling(false);
      }
    }, [shouldPoll, isPolling]);

    // Process waiting steps and call handleInvokeAction for each one
    useEffect(() => {
      if (!sortedSteps?.length) return;

      const nodes = getNodes();
      const processedPilotStepIds = new Set(
        nodes.map((node) => node?.data?.metadata?.pilotStepId).filter(Boolean),
      );

      // Find steps with status "init" that have an actionResult and haven't been processed yet
      const stepsToProcess = sortedSteps.filter(
        (step) =>
          (step.status === 'init' || step.status === 'executing') &&
          step.actionResult &&
          !processedPilotStepIds.has(step.stepId),
      );

      console.log('[SessionContainer] stepsToProcess', stepsToProcess);

      if (stepsToProcess.length > 0) {
        for (const [index, step] of stepsToProcess.entries()) {
          if (step.actionResult) {
            const offsetPosition: XYPosition = {
              x: 0,
              y: 250 * index,
            };
            handleInvokeAction(step.actionResult, offsetPosition);
          }
        }
      }
    }, [sortedSteps, handleInvokeAction]);

    return (
      <div className={containerClassName}>
        {/* Header */}
        <SessionHeader
          canvasId={canvasId}
          session={session}
          steps={sortedSteps}
          onClose={handleClose}
          onSessionClick={handleSessionClick}
        />

        {!session ? (
          <NoSession loading={isLoading} error={!!error} canvasId={canvasId} />
        ) : (
          <div className="px-2 pb-2 flex-1 overflow-y-auto">
            {sortedSteps.length > 0 ? (
              <>
                <div className="pl-1">
                  {sortedSteps.map((step) => (
                    <PilotStepItem key={step.stepId} step={step} onClick={handleStepClick} />
                  ))}
                </div>
              </>
            ) : session?.status === 'executing' ? (
              <div className="mt-8 text-center py-4 text-gray-500 dark:text-gray-400">
                <div className="flex justify-center items-center">
                  <AnimatedPilotIcon className="w-12 h-12 mb-2" />
                </div>
                <p>
                  {t('pilot.thinking')}
                  <AnimatedEllipsis />
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Empty
                  description={t('pilot.noTasks', { defaultValue: 'No tasks available yet' })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

SessionContainer.displayName = 'SessionContainer';
