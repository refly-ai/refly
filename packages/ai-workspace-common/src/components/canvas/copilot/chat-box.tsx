import { memo, useMemo, useEffect, useCallback, useRef } from 'react';
import { Modal, message } from 'antd';

import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { genActionResultID, genCopilotSessionID } from '@refly/utils/id';
import { useActionResultStoreShallow, useCopilotStoreShallow } from '@refly/stores';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { useTranslation } from 'react-i18next';
import { useListCopilotSessions } from '@refly-packages/ai-workspace-common/queries';
import { logEvent } from '@refly/telemetry-web';
import { FileList } from './file-list';
import { CopilotActions } from './copilot-actions';
import { useFileUpload } from '@refly-packages/ai-workspace-common/hooks/use-file-upload';

const MAX_FILE_COUNT = 10;

interface ChatBoxProps {
  canvasId: string;
  query: string;
  setQuery: (query: string) => void;
  onSendMessage?: () => void;
  onRegisterFileUploadHandler?: (handler: (files: File[]) => Promise<void>) => void;
  onUploadDisabledChange?: (disabled: boolean) => void;
}

export const ChatBox = memo(
  ({
    canvasId,
    query,
    setQuery,
    onSendMessage,
    onRegisterFileUploadHandler,
    onUploadDisabledChange,
  }: ChatBoxProps) => {
    const { t } = useTranslation();
    const initialPromptProcessed = useRef(false);

    const {
      contextItems,
      fileCount,
      hasUploadingFiles,
      completedFileItems,
      relevantUploads,
      handleFileUpload,
      handleBatchFileUpload,
      handleRetryFile,
      handleRemoveFile,
      clearFiles,
    } = useFileUpload({
      canvasId,
      maxFileCount: MAX_FILE_COUNT,
      maxFileSize: 50 * 1024 * 1024,
    });

    useEffect(() => {
      onUploadDisabledChange?.(fileCount >= MAX_FILE_COUNT);
    }, [fileCount, onUploadDisabledChange]);

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
      pendingPrompt,
      pendingFiles,
      setPendingPrompt,
      setPendingFiles,
    } = useCopilotStoreShallow((state) => ({
      currentSessionId: state.currentSessionId[canvasId],
      setCurrentSessionId: state.setCurrentSessionId,
      appendSessionResultId: state.appendSessionResultId,
      setCreatedCopilotSessionId: state.setCreatedCopilotSessionId,
      sessionResultIds: state.sessionResultIds[state.currentSessionId?.[canvasId]],
      addHistoryTemplateSession: state.addHistoryTemplateSession,
      pendingPrompt: state.pendingPrompt[canvasId],
      pendingFiles: state.pendingFiles[canvasId],
      setPendingPrompt: state.setPendingPrompt,
      setPendingFiles: state.setPendingFiles,
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

    // Register file upload handler for drag-and-drop from parent
    useEffect(() => {
      if (onRegisterFileUploadHandler) {
        onRegisterFileUploadHandler(handleBatchFileUpload);
      }
    }, [onRegisterFileUploadHandler, handleBatchFileUpload]);

    const handleSendMessage = useCallback(
      async (type: 'input_enter_send' | 'button_click_send', customQuery?: string) => {
        const messageQuery = customQuery ?? query;
        const hasCompletedFiles = completedFileItems.length > 0;

        // Prevent sending while uploads are in progress
        if (hasUploadingFiles) {
          message.info(t('copilot.uploadInProgress'));
          return;
        }

        // Allow sending if there's a query or completed files
        if (isExecuting || (!messageQuery?.trim() && !hasCompletedFiles)) {
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

        // Only send completed files (not pending uploads)
        invokeAction(
          {
            query: messageQuery,
            resultId,
            modelInfo: null,
            agentMode: 'copilot_agent',
            copilotSessionId: sessionId,
            contextItems: completedFileItems,
          },
          {
            entityId: canvasId,
            entityType: 'canvas',
          },
        );
        if (!customQuery) {
          setQuery('');
        }
        // Clear files after sending
        clearFiles();

        setCurrentSessionId(canvasId, sessionId);
        appendSessionResultId(sessionId, resultId);
        setCreatedCopilotSessionId(sessionId);
        addHistoryTemplateSession(canvasId, {
          sessionId,
          title: messageQuery || t('copilot.fileAttachment'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      },
      [
        isExecuting,
        hasUploadingFiles,
        currentSessionId,
        query,
        completedFileItems,
        canvasId,
        invokeAction,
        setQuery,
        clearFiles,
        setCurrentSessionId,
        appendSessionResultId,
        setCreatedCopilotSessionId,
        t,
        addHistoryTemplateSession,
        onSendMessage,
      ],
    );

    useEffect(() => {
      // Allow sending if there's a non-empty prompt OR pending files
      const hasPendingContent = !!pendingPrompt?.trim() || (pendingFiles?.length ?? 0) > 0;
      if (hasPendingContent && !initialPromptProcessed.current) {
        initialPromptProcessed.current = true;

        // Merge pending files with current context items
        const filesToSend = pendingFiles ?? [];

        // Generate IDs for the message
        const resultId = genActionResultID();
        let sessionId = currentSessionId;

        if (!sessionId) {
          sessionId = genCopilotSessionID();
        }

        onSendMessage?.();
        logEvent('copilot_prompt_sent', Date.now(), {
          source: 'pending_prompt',
        });

        // Send message with pending prompt and files
        invokeAction(
          {
            query: pendingPrompt || '',
            resultId,
            modelInfo: null,
            agentMode: 'copilot_agent',
            copilotSessionId: sessionId,
            contextItems: filesToSend,
          },
          {
            entityId: canvasId,
            entityType: 'canvas',
          },
        );

        setCurrentSessionId(canvasId, sessionId);
        appendSessionResultId(sessionId, resultId);
        setCreatedCopilotSessionId(sessionId);
        addHistoryTemplateSession(canvasId, {
          sessionId,
          title: pendingPrompt || t('copilot.fileAttachment'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Clean up store
        setPendingPrompt(canvasId, null);
        setPendingFiles(canvasId, null);
      }
    }, [
      pendingPrompt,
      pendingFiles,
      currentSessionId,
      canvasId,
      invokeAction,
      setCurrentSessionId,
      appendSessionResultId,
      setCreatedCopilotSessionId,
      addHistoryTemplateSession,
      setPendingPrompt,
      setPendingFiles,
      onSendMessage,
      t,
    ]);

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
      <div
        className="w-full p-3 rounded-xl overflow-hidden border-[0.5px] border-solid border-refly-Card-Border bg-refly-bg-content-z2"
        style={{
          boxShadow: '0px 5px 30px 0px rgba(31,35,41,0.05), 0px 0px 2px 0px rgba(31,35,41,0.04)',
        }}
      >
        {/* File list area */}
        {fileCount > 0 && (
          <FileList
            contextItems={contextItems}
            canvasId={canvasId}
            onRemove={handleRemoveFile}
            onRetry={handleRetryFile}
            uploads={relevantUploads}
            className="mb-3"
          />
        )}

        {/* Input area */}
        <ChatInput
          readonly={false}
          query={query}
          setQuery={(value) => {
            setQuery(value);
          }}
          maxRows={6}
          handleSendMessage={() => handleSendMessage('input_enter_send')}
          placeholder={t('copilot.placeholder')}
          onUploadImage={handleFileUpload}
          onUploadMultipleImages={handleBatchFileUpload}
        />

        {/* Bottom action bar */}
        <CopilotActions
          query={query}
          fileCount={fileCount}
          maxFileCount={MAX_FILE_COUNT}
          isExecuting={isExecuting}
          isUploading={hasUploadingFiles}
          onUploadFiles={handleBatchFileUpload}
          onSendMessage={() => handleSendMessage('button_click_send')}
          onAbort={handleAbort}
        />
      </div>
    );
  },
);

ChatBox.displayName = 'ChatBox';
