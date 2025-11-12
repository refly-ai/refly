import { memo, useMemo, useEffect, useCallback } from 'react';

import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { genActionResultID, genCopilotSessionID } from '@refly/utils/id';
import { useActionResultStoreShallow, useCopilotStoreShallow } from '@refly/stores';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useTranslation } from 'react-i18next';
import { useListCopilotSessions } from '@refly-packages/ai-workspace-common/queries';

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
  } = useCopilotStoreShallow((state) => ({
    currentSessionId: state.currentSessionId[canvasId],
    setCurrentSessionId: state.setCurrentSessionId,
    appendSessionResultId: state.appendSessionResultId,
    setCreatedCopilotSessionId: state.setCreatedCopilotSessionId,
    sessionResultIds: state.sessionResultIds[state.currentSessionId?.[canvasId]],
  }));

  const { resultMap } = useActionResultStoreShallow((state) => ({
    resultMap: state.resultMap,
  }));

  const results = useMemo(() => {
    return sessionResultIds?.map((resultId) => resultMap[resultId]) ?? [];
  }, [sessionResultIds, resultMap]);

  const isExecuting = useMemo(() => {
    return results.some((result) => ['executing', 'waiting'].includes(result?.status ?? ''));
  }, [results]);

  const firstResult = useMemo(() => {
    return results?.[0] ?? null;
  }, [results]);

  useEffect(() => {
    if (['finish', 'failed'].includes(firstResult?.status ?? '')) {
      refetchHistorySessions();
    }
  }, [firstResult?.status, refetchHistorySessions]);

  const { invokeAction } = useInvokeAction();

  const handleSendMessage = useCallback(async () => {
    if (isExecuting) {
      return;
    }

    const resultId = genActionResultID();
    let sessionId = currentSessionId;

    if (!sessionId) {
      sessionId = genCopilotSessionID();
    }
    onSendMessage?.();

    invokeAction(
      {
        query,
        resultId,
        selectedSkill: undefined,
        modelInfo: null,
        tplConfig: {},
        runtimeConfig: {},
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
  }, [
    isExecuting,
    currentSessionId,
    query,
    canvasId,
    invokeAction,
    setQuery,
    setCurrentSessionId,
    appendSessionResultId,
    setCreatedCopilotSessionId,
  ]);

  return (
    <div className="w-full px-4 py-3 rounded-xl overflow-hidden border-[1px] border-solid border-refly-primary-default ">
      <ChatInput
        readonly={false}
        query={query}
        setQuery={(value) => {
          setQuery(value);
        }}
        maxRows={6}
        handleSendMessage={handleSendMessage}
        placeholder={t('copilot.placeholder')}
      />

      <ChatActions
        query={query}
        model={null}
        setModel={() => {}}
        handleSendMessage={handleSendMessage}
        onUploadImage={() => Promise.resolve()}
        contextItems={[]}
        runtimeConfig={undefined}
        setRuntimeConfig={() => {}}
        selectedToolsets={[]}
        setSelectedToolsets={() => {}}
        customActions={[]}
        isExecuting={isExecuting}
        showLeftActions={false}
      />
    </div>
  );
});

ChatBox.displayName = 'ChatBox';
