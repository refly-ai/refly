import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow, XYPosition } from '@xyflow/react';
import { ActionResult, PilotStep } from '@refly/openapi-schema';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { Button, Skeleton, Tooltip, Popover } from 'antd';
import { useGetPilotSessionDetail } from '@refly-packages/ai-workspace-common/queries/queries';
import { useAddNode, useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { cn } from '@refly/utils/cn';
import { ClockCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { PilotStepItem } from './pilot-step-item';
import { SessionStatusTag } from './session-status-tag';
import { PilotList } from './pilot-list';
import {
  IconClose,
  IconExitWideMode,
  IconPilot,
  IconWideMode,
  IconThreadHistory,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { Maximize2, Minimize2 } from 'lucide-react';
import { RiChatNewLine } from 'react-icons/ri';
import { usePilotStoreShallow } from '@refly-packages/ai-workspace-common/stores/pilot';
import { SessionChat } from './session-chat';

const SessionHeader = memo(
  ({
    canvasId,
    onClose,
    onMaximize,
    isMaximized,
    onWideMode,
    isWideMode,
    onSessionClick,
  }: {
    canvasId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
    onWideMode: () => void;
    isWideMode: boolean;
    onSessionClick: (sessionId: string) => void;
  }) => {
    const { t } = useTranslation();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    console.log('canvasId', canvasId);

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
          <span className="text-sm font-medium leading-normal">
            {t('pilot.name', { defaultValue: 'Pilot' })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip title={t('pilot.newSession', { defaultValue: 'New Session' })}>
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
            className={`flex items-center justify-center p-0 w-7 h-7 ${isWideMode ? 'text-primary-600' : 'text-gray-500 hover:text-gray-600'} min-w-0`}
            onClick={onWideMode}
          >
            {isWideMode ? (
              <IconExitWideMode className="w-4 h-4" />
            ) : (
              <IconWideMode className="w-4 h-4" />
            )}
          </Button>
          <Button
            type="text"
            size="small"
            className={`flex items-center justify-center p-0 w-7 h-7 ${isMaximized ? 'text-primary-600' : 'text-gray-500 hover:text-gray-600'} min-w-0`}
            onClick={onMaximize}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
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

export const SessionContainer = memo(
  ({ sessionId, canvasId, className, onStepClick }: SessionContainerProps) => {
    const { t } = useTranslation();
    const [isPolling, setIsPolling] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<string | null>(null);
    const { getNodes } = useReactFlow<CanvasNode<any>>();

    const [isMaximized, setIsMaximized] = useState(false);
    const [isWideMode, setIsWideMode] = useState(false);
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

    const handleMaximize = useCallback(() => {
      setIsMaximized(!isMaximized);
      if (isWideMode && !isMaximized) {
        setIsWideMode(false);
      }
    }, [isMaximized, isWideMode]);

    const handleWideMode = useCallback(() => {
      setIsWideMode(!isWideMode);
      if (isMaximized && !isWideMode) {
        setIsMaximized(false);
      }
    }, [isWideMode, isMaximized]);

    const containerStyles = useMemo(
      () => ({
        height: isMaximized ? '100vh' : 'calc(100vh - 72px)',
        width: isMaximized ? 'calc(100vw)' : isWideMode ? '840px' : '420px',
        position: isMaximized ? ('fixed' as const) : ('relative' as const),
        top: isMaximized ? 0 : null,
        right: isMaximized ? 0 : null,
        zIndex: isMaximized ? 50 : 10,
        transition: isMaximized
          ? 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          : 'all 50ms cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column' as const,
        borderRadius: isMaximized ? 0 : '0.5rem',
      }),
      [isMaximized, isWideMode],
    );

    const containerClassName = useMemo(
      () => `
        flex-shrink-0 
        bg-white dark:bg-gray-900
        border 
        border-gray-200 dark:border-gray-700
        flex 
        flex-col
        will-change-transform
        ${isMaximized ? 'fixed' : 'rounded-lg'}
      `,
      [isMaximized],
    );
    const { invokeAction } = useInvokeAction();
    const { addNode } = useAddNode();

    // Fetch the pilot session details
    const {
      data: sessionData,
      refetch,
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

    const handleRefresh = useCallback(() => {
      refetch();
    }, [refetch]);

    const handleStepClick = useCallback(
      (step: PilotStep) => {
        if (onStepClick) {
          onStepClick(step);
        }
      },
      [onStepClick],
    );

    const handleInvokeAction = useCallback(
      (result: ActionResult, offsetPosition: XYPosition) => {
        const {
          input,
          resultId,
          actionMeta,
          modelInfo,
          runtimeConfig,
          tplConfig,
          targetId,
          targetType,
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
        addNode({
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
        });
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
          step.status === 'init' && step.actionResult && !processedPilotStepIds.has(step.stepId),
      );

      if (stepsToProcess.length > 0) {
        for (const [index, step] of stepsToProcess.entries()) {
          if (step.actionResult) {
            const offsetPosition: XYPosition = {
              x: 0,
              y: 300 * index,
            };
            handleInvokeAction(step.actionResult, offsetPosition);
          }
        }
      }
    }, [sortedSteps, handleInvokeAction]);

    return (
      <div className={cn(containerClassName, className)} style={containerStyles}>
        {/* Header */}
        <SessionHeader
          canvasId={canvasId}
          onClose={handleClose}
          onMaximize={handleMaximize}
          isMaximized={isMaximized}
          onWideMode={handleWideMode}
          isWideMode={isWideMode}
          onSessionClick={handleSessionClick}
        />

        {!session ? (
          <NoSession loading={isLoading} error={!!error} canvasId={canvasId} />
        ) : (
          <>
            <div className="flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <h2 className="text-lg font-medium">{session.title}</h2>
                <SessionStatusTag status={session.status} className="ml-2 h-5 flex items-center" />
              </div>
              <div className="flex items-center space-x-2">
                <Tooltip title={t('common.refresh', { defaultValue: 'Refresh' })}>
                  <Button
                    icon={<SyncOutlined spin={isPolling} />}
                    type="text"
                    onClick={handleRefresh}
                    aria-label={t('common.refresh', { defaultValue: 'Refresh' })}
                  />
                </Tooltip>
              </div>
            </div>

            {/* Steps Timeline */}
            <div className="p-4 pt-3 flex-1 overflow-y-auto">
              <h3 className="text-md font-medium mb-2">{t('pilot.steps')}</h3>

              {sortedSteps.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {sortedSteps.map((step) => (
                      <PilotStepItem
                        key={step.stepId}
                        step={step}
                        onClick={onStepClick ? handleStepClick : undefined}
                      />
                    ))}
                  </div>
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    <p>{t('common.noMore', { defaultValue: 'No more' })}</p>
                  </div>
                </>
              ) : (
                <div className="mt-8 text-center py-4 text-gray-500 dark:text-gray-400">
                  <ClockCircleOutlined className="text-xl mb-2" />
                  <p>{t('pilot.noSteps', { defaultValue: 'No steps available yet' })}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  },
);

SessionContainer.displayName = 'SessionContainer';
