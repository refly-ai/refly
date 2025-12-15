import { memo, useMemo, useEffect, useCallback } from 'react';
import { Modal, message } from 'antd';

import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { genActionResultID, genCopilotSessionID } from '@refly/utils/id';
import { useActionResultStoreShallow, useCopilotStoreShallow } from '@refly/stores';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useTranslation } from 'react-i18next';
import { useListCopilotSessions } from '@refly-packages/ai-workspace-common/queries';
import { logEvent } from '@refly/telemetry-web';

interface ChatBoxProps {
  canvasId: string;
  query: string;
  setQuery: (query: string) => void;
  onSendMessage?: () => void;
}

export const ChatBox = memo(({ canvasId, query, setQuery, onSendMessage }: ChatBoxProps) => {
  const { t } = useTranslation();
  const { refetch: refetchHistorySessions } = useListCopilotSessions(
    {
      query: {
        canvasId,
      },
    },
    [],
    { enabled: false },
  );

  const {
    currentSessionId,
    setCurrentSessionId,
    appendSessionResultId,
    setCreatedCopilotSessionId,
    sessionResultIds,
    addHistoryTemplateSession,
  } = useCopilotStoreShallow((state) => ({
    currentSessionId: state.currentSessionId[canvasId],
    setCurrentSessionId: state.setCurrentSessionId,
    appendSessionResultId: state.appendSessionResultId,
    setCreatedCopilotSessionId: state.setCreatedCopilotSessionId,
    sessionResultIds: state.sessionResultIds[state.currentSessionId?.[canvasId]],
    addHistoryTemplateSession: state.addHistoryTemplateSession,
  }));

  const { resultMap } = useActionResultStoreShallow((state) => ({
    resultMap: state.resultMap,
  }));

  const results = useMemo(() => {
    return sessionResultIds?.map((resultId) => resultMap[resultId]) ?? [];
  }, [sessionResultIds, resultMap]);

  const currentExecutingResult = useMemo(() => {
    return (
      results.find((result) => ['executing', 'waiting'].includes(result?.status ?? '')) ?? null
    );
  }, [results]);

  const isExecuting = !!currentExecutingResult;

  const firstResult = useMemo(() => {
    return results?.[0] ?? null;
  }, [results]);

  useEffect(() => {
    if (['finish', 'failed'].includes(firstResult?.status ?? '')) {
      refetchHistorySessions();
    }
  }, [firstResult?.status, refetchHistorySessions]);

  const { invokeAction, abortAction } = useInvokeAction();

  const handleSendMessage = useCallback(
    async (type: 'input_enter_send' | 'button_click_send') => {
      if (isExecuting) {
        return;
      }

      const resultId = genActionResultID();
      let sessionId = currentSessionId;

      if (!sessionId) {
        sessionId = genCopilotSessionID();
      }
      onSendMessage?.();
      logEvent('copilot_prompt_sent', Date.now(), {
        source: type,
      });

      invokeAction(
        {
          query,
          resultId,
          modelInfo: null,
          agentMode: 'copilot_agent',
          copilotSessionId: sessionId,
        },
        {
          entityId: canvasId,
          entityType: 'canvas',
        },
      );
      setQuery('');

      setCurrentSessionId(canvasId, sessionId);
      appendSessionResultId(sessionId, resultId);
      setCreatedCopilotSessionId(sessionId);
      addHistoryTemplateSession(canvasId, {
        sessionId,
        title: query,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    [
      isExecuting,
      currentSessionId,
      query,
      canvasId,
      invokeAction,
      setQuery,
      setCurrentSessionId,
      appendSessionResultId,
      setCreatedCopilotSessionId,
      addHistoryTemplateSession,
      logEvent,
    ],
  );

  const handleAbort = useCallback(() => {
    if (!currentExecutingResult) {
      return;
    }

    Modal.confirm({
      title: t('copilot.abortConfirmModal.title'),
      content: t('copilot.abortConfirmModal.content'),
      okText: t('copilot.abortConfirmModal.confirm'),
      cancelText: t('copilot.abortConfirmModal.cancel'),
      icon: null,
      centered: true,
      okButtonProps: {
        className: '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66]',
      },
      onOk: async () => {
        await abortAction(currentExecutingResult.resultId);
        message.success(t('copilot.abortSuccess'));
      },
    });
  }, [currentExecutingResult, abortAction, t]);

  return (
    <div className="w-full p-3 rounded-xl overflow-hidden border-[1px] border-solid border-refly-primary-default ">
      <ChatInput
        readonly={false}
        query={query}
        setQuery={(value) => {
          setQuery(value);
        }}
        maxRows={6}
        handleSendMessage={() => handleSendMessage('input_enter_send')}
        placeholder={t('copilot.placeholder')}
      />

      <ChatActions
        query={query}
        handleSendMessage={() => handleSendMessage('button_click_send')}
        onUploadImage={() => Promise.resolve()}
        isExecuting={isExecuting}
        showLeftActions={false}
        handleAbort={handleAbort}
      />
    </div>
  );
});

ChatBox.displayName = 'ChatBox';
