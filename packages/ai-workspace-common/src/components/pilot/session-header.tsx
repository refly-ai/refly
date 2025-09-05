import { Button, Divider, Popover, Tooltip } from 'antd';
import { History } from 'refly-icons';
import { memo, useCallback, useState } from 'react';
import { PilotSession, PilotStep } from '@refly/openapi-schema';
import { PilotList } from '@refly-packages/ai-workspace-common/components/pilot/pilot-list';
import { useTranslation } from 'react-i18next';
import { usePilotStoreShallow } from '@refly/stores';
import { ScreenDefault, ScreenFull } from 'refly-icons';
import { SessionStatusTag } from '@refly-packages/ai-workspace-common/components/pilot/session-status-tag';
import { NewTaskButton } from '@refly-packages/ai-workspace-common/components/pilot/session-container';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
const SessionHeader = memo(
  ({
    canvasId,
    session,
    steps,
    onClick,
    onSessionClick,
  }: {
    canvasId: string;
    session?: PilotSession;
    steps: PilotStep[];
    onClick: () => void;
    onSessionClick: (sessionId: string) => void;
  }) => {
    const { isPilotOpen } = usePilotStoreShallow((state) => ({
      isPilotOpen: state.isPilotOpen,
    }));
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const handleSessionClick = useCallback(
      (sessionId: string) => {
        onSessionClick(sessionId);
        setIsHistoryOpen(false);
      },
      [onSessionClick],
    );
    const { t } = useTranslation();
    return (
      <div className="flex items-center justify-between w-full px-4 pt-4">
        {/* Header Left */}
        <div className="flex items-center gap-1">
          <Logo logoProps={{ show: false }} />
          <span className="text-neutral-900 dark:text-neutral-50 text-[14px] font-semibold ml-0.5">
            Agent
          </span>
          {session ? <SessionStatusTag status={session?.status} steps={steps} /> : null}
        </div>
        {/* Header Right */}
        <div className="flex items-center gap-2">
          {!isPilotOpen && session?.status === 'finish' && (
            <NewTaskButton className="p-0 mr-1" canvasId={canvasId} />
          )}
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
            <Tooltip
              title={t('pilot.sessionHistory', {
                defaultValue: 'Session History',
              })}
            >
              <Button
                type="text"
                size="small"
                className={`flex items-center justify-center p-0 !w-4 h-4 ${isHistoryOpen ? 'text-primary-600' : 'text-gray-500 hover:text-gray-600'} min-w-0`}
                icon={<History className="w-4 h-4" />}
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              />
            </Tooltip>
          </Popover>
          <Divider type="vertical" />
          <Button
            type="text"
            size="small"
            className="flex items-center justify-center p-0 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 min-w-0"
            onClick={onClick}
            icon={
              isPilotOpen ? (
                <ScreenDefault className="w-4 h-4" />
              ) : (
                <ScreenFull className="w-4 h-4" />
              )
            }
          />
        </div>
      </div>
    );
  },
);

export default SessionHeader;
