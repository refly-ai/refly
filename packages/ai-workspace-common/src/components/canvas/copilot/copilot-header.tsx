import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, Divider, Popover } from 'antd';
import { History, SideLeft, NewConversation } from 'refly-icons';
import { useListCopilotSessions } from '@refly-packages/ai-workspace-common/queries';
import cn from 'classnames';
import { useCopilotStoreShallow } from '@refly/stores';
import { ReflyAssistant } from './refly-assistant';

interface CopilotHeaderProps {
  canvasId: string;
  sessionId: string | null;
  copilotWidth: number;
  setCopilotWidth: (width: number) => void;
}

export const CopilotHeader = memo(
  ({ canvasId, sessionId, copilotWidth, setCopilotWidth }: CopilotHeaderProps) => {
    const { t } = useTranslation();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const { setCurrentSessionId, historyTemplateSessions, removeHistoryTemplateSession } =
      useCopilotStoreShallow((state) => ({
        setCurrentSessionId: state.setCurrentSessionId,
        historyTemplateSessions: state.historyTemplateSessions[canvasId] ?? [],
        removeHistoryTemplateSession: state.removeHistoryTemplateSession,
      }));

    const { data, refetch } = useListCopilotSessions(
      {
        query: {
          canvasId,
        },
      },
      [],
      { enabled: !!canvasId },
    );

    const sessionHistory = useMemo(() => {
      let listFromRequest = data?.data ?? [];
      for (const session of historyTemplateSessions) {
        if (!listFromRequest.some((s) => s.sessionId === session.sessionId)) {
          listFromRequest = [session, ...listFromRequest];
        } else {
          removeHistoryTemplateSession(canvasId, session.sessionId);
        }
      }
      return listFromRequest;
    }, [data, historyTemplateSessions]);

    const showDivider = useMemo(() => {
      return sessionHistory.length > 0 || !!sessionId;
    }, [sessionHistory, sessionId]);

    const handleClose = useCallback(() => {
      if (copilotWidth === 0) {
        return;
      }

      setCopilotWidth(0);
    }, [copilotWidth, setCopilotWidth]);

    const handleSessionClick = useCallback(
      (sessionId: string) => {
        setCurrentSessionId(canvasId, sessionId);
        setIsHistoryOpen(false);
      },
      [canvasId, setCurrentSessionId],
    );

    useEffect(() => {
      if (isHistoryOpen) {
        refetch();
      }
    }, [isHistoryOpen]);

    useEffect(() => {
      refetch();
    }, [canvasId]);

    const content = useMemo(() => {
      return (
        <div className="max-h-[400px] overflow-y-auto">
          {sessionHistory.map((session) => (
            <div
              key={session.sessionId}
              className="flex items-center gap-1 hover:bg-refly-tertiary-hover p-1 rounded-lg cursor-pointer"
              onClick={() => handleSessionClick(session.sessionId)}
            >
              <div className="w-7 h-7 flex items-center justify-center">
                <History size={20} />
              </div>
              <div className="min-w-[100px] max-w-[400px] truncate text-refly-text-0 text-sm leading-5">
                {session.title}
              </div>
            </div>
          ))}
        </div>
      );
    }, [sessionHistory, handleSessionClick]);

    return (
      <div className="h-[46px] px-4 py-3 flex items-center gap-3 justify-between">
        <ReflyAssistant />

        <div className="flex items-center gap-3">
          {sessionHistory.length > 0 && (
            <Tooltip title={t('copilot.header.history')}>
              <Popover
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                placement="bottomLeft"
                trigger="click"
                arrow={false}
                content={content}
              >
                <History
                  size={20}
                  className={cn(
                    'text-refly-text-0 hover:bg-refly-tertiary-hover cursor-pointer rounded-md',
                    isHistoryOpen ? 'bg-refly-tertiary-hover' : '',
                  )}
                />
              </Popover>
            </Tooltip>
          )}

          {sessionId && (
            <Tooltip title={t('copilot.header.newConversation')}>
              <NewConversation
                size={20}
                className="text-refly-text-0 hover:bg-refly-tertiary-hover cursor-pointer rounded-md"
                onClick={() => setCurrentSessionId(canvasId, null)}
              />
            </Tooltip>
          )}

          {showDivider && (
            <Divider type="vertical" className="m-0 h-4 bg-refly-Card-Border translate-y-[1px]" />
          )}

          <Tooltip title={t('copilot.header.close')}>
            <SideLeft
              size={20}
              className="text-refly-text-0 hover:bg-refly-tertiary-hover cursor-pointer rounded-md"
              onClick={handleClose}
            />
          </Tooltip>
        </div>
      </div>
    );
  },
);

CopilotHeader.displayName = 'CopilotHeader';
