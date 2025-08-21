import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import { PilotStep } from '@refly/openapi-schema';
import { CanvasNode } from '@refly/canvas-common';
import { Empty, Button } from 'antd';
import { motion, AnimatePresence } from 'motion/react';
import { useGetPilotSessionDetail } from '@refly-packages/ai-workspace-common/queries/queries';
import {
  useNodePosition,
  useNodePreviewControl,
} from '@refly-packages/ai-workspace-common/hooks/canvas';
import { cn } from '@refly/utils/cn';
import { PilotStepItem } from './pilot-step-item';
import { IconPilot } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useFrontPageStoreShallow, usePilotStoreShallow } from '@refly/stores';
// import { SessionChat } from './session-chat';
import { NoSession } from '@refly-packages/ai-workspace-common/components/pilot/nosession';
import SessionHeader from '@refly-packages/ai-workspace-common/components/pilot/session-header';
import { Send, Thinking } from 'refly-icons';

// Define the active statuses that require polling
const ACTIVE_STATUSES = ['executing', 'waiting'];
const POLLING_INTERVAL = 2000; // 2 seconds

export interface SessionContainerProps {
  sessionId: string | null;
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

// Component for new task button when session is completed
const NewTaskButton = memo(() => {
  const { t } = useTranslation();
  const { setActiveSessionId } = usePilotStoreShallow((state) => ({
    setActiveSessionId: state.setActiveSessionId,
  }));

  const handleNewTask = useCallback(() => {
    // Clear the current session to show NoSession component
    setActiveSessionId(null);
  }, [setActiveSessionId]);

  return (
    <motion.div
      className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div className="pt-3 flex justify-end">
        <Button
          type="primary"
          size="large"
          className="w-24 h-8 text-[14px] font-medium px-1.5 py-2"
          onClick={handleNewTask}
          icon={<Send size={16} />}
        >
          {t('pilot.newTask', { defaultValue: 'New Task' })}
        </Button>
      </div>
    </motion.div>
  );
});

NewTaskButton.displayName = 'NewTaskButton';

export const SessionContainer = memo(
  ({ sessionId, canvasId, className, onStepClick }: SessionContainerProps) => {
    const { t } = useTranslation();
    const [isPolling, setIsPolling] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<string | null>(null);
    const { getNodes } = useReactFlow<CanvasNode<any>>();

    const { isPilotOpen, setIsPilotOpen, setActiveSessionId } = usePilotStoreShallow((state) => ({
      isPilotOpen: state.isPilotOpen,
      setIsPilotOpen: state.setIsPilotOpen,
      setActiveSessionId: state.setActiveSessionId,
    }));
    const { query } = useFrontPageStoreShallow((state) => ({
      query: state.getQuery?.(canvasId) || '',
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
      () => cn('flex-shrink-0', 'flex', 'flex-col', 'w-full', 'rounded-lg', className),
      [className],
    );

    // Fetch the pilot session details
    const {
      data: sessionData,
      // isLoading,
      // error,
    } = useGetPilotSessionDetail(
      {
        query: { sessionId },
      },
      undefined,
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

    const handleClick = useCallback(() => {
      setIsPilotOpen(!isPilotOpen);
    }, [setIsPilotOpen, isPilotOpen]);

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
    return (
      <div className={containerClassName}>
        {/* Header */}
        {/* {session && ( */}
        <div className="pb-4">
          <SessionHeader
            canvasId={canvasId}
            session={session}
            steps={sortedSteps}
            onClick={handleClick}
            onSessionClick={handleSessionClick}
          />
        </div>
        {/* )} */}

        <AnimatePresence mode="wait">
          {!session ? (
            <motion.div
              key="no-session"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <NoSession canvasId={canvasId} />
            </motion.div>
          ) : (
            <div className="flex flex-col h-full">
              <motion.div
                key="session-content"
                className="px-2 pb-2 flex-1 h-full w-full max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <AnimatePresence mode="wait">
                  {sortedSteps.length > 0 ? (
                    <motion.div
                      key="steps-list"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <motion.div
                        className="px-4"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                      >
                        {query}
                      </motion.div>
                      <div className="pl-1">
                        {sortedSteps.map((step, index) => (
                          <motion.div
                            key={step.stepId}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.2,
                              delay: index * 0.05,
                              ease: 'easeOut',
                            }}
                          >
                            <PilotStepItem step={step} onClick={handleStepClick} />
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ) : session?.status === 'executing' ? (
                    <motion.div
                      key="executing-state"
                      className="flex flex-col h-full"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <motion.div
                        className="px-4"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                      >
                        {query}
                      </motion.div>
                      <motion.div
                        className="flex flex-col h-full px-4 py-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.2 }}
                      >
                        <motion.div
                          className="w-full bg-refly-bg-content-z2 rounded-lg py-3 flex items-center gap-2 border border-gray-100 bg-[#F4F4F4] dark:bg-gray-800"
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2, delay: 0.3 }}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            <Thinking color="#76787B" className="w-4 h-4" />
                          </div>
                          <div className="text-sm text-center text-gray-500 font-normal">
                            {t('pilot.status.understandingIntent')}
                          </div>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty-state"
                      className="flex items-center justify-center h-full"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <Empty
                        description={t('pilot.noTasks', { defaultValue: 'No tasks available yet' })}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              {session?.status === 'finish' && <NewTaskButton />}
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

SessionContainer.displayName = 'SessionContainer';
