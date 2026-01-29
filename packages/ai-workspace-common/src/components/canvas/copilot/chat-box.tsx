import { memo, useMemo, useEffect, useCallback, useRef, useState } from 'react';
import { Modal, message } from 'antd';

import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { genActionResultID, genCopilotSessionID, genUniqueId } from '@refly/utils/id';
import {
  useActionResultStoreShallow,
  useCopilotStoreShallow,
  useImageUploadStore,
} from '@refly/stores';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { useTranslation } from 'react-i18next';
import { useListCopilotSessions } from '@refly-packages/ai-workspace-common/queries';
import { logEvent } from '@refly/telemetry-web';
import type { IContextItem } from '@refly/common-types';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-drive-files';
import { FileList } from './file-list';
import { CopilotActions } from './copilot-actions';

const MAX_FILE_COUNT = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

interface ChatBoxProps {
  canvasId: string;
  query: string;
  setQuery: (query: string) => void;
  onSendMessage?: () => void;
  onRegisterFileUploadHandler?: (handler: (files: File[]) => Promise<void>) => void;
  onUploadDisabledChange?: (disabled: boolean) => void;
}

// Store file data for retry
interface PendingFileData {
  file: File;
  previewUrl?: string;
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

    // File attachment state
    const [contextItems, setContextItems] = useState<IContextItem[]>([]);
    // Store original file data for retry functionality
    const pendingFilesRef = useRef<Map<string, PendingFileData>>(new Map());
    // Track file count for parallel uploads (ref updates synchronously)
    const fileCountRef = useRef(0);
    const { refetch: refetchFiles } = useFetchDriveFiles();

    // Upload progress tracking
    const { uploads, startUpload, updateProgress, setUploadSuccess, setUploadError, removeUpload } =
      useImageUploadStore();

    // Filter uploads related to current context items
    const relevantUploads = useMemo(() => {
      const uploadIds = new Set(
        contextItems.map((item) => item.metadata?.uploadId).filter(Boolean),
      );
      return uploads.filter((u) => uploadIds.has(u.id));
    }, [uploads, contextItems]);

    const fileCount = useMemo(
      () => contextItems.filter((item) => item.type === 'file').length,
      [contextItems],
    );

    // Sync fileCountRef with actual file count
    useEffect(() => {
      fileCountRef.current = fileCount;
    }, [fileCount]);

    // Report upload disabled status to parent (for dropzone styling)
    useEffect(() => {
      onUploadDisabledChange?.(fileCount >= MAX_FILE_COUNT);
    }, [fileCount, onUploadDisabledChange]);

    // Check if any uploads are in progress
    const hasUploadingFiles = useMemo(
      () => relevantUploads.some((u) => u.status === 'uploading'),
      [relevantUploads],
    );

    // Get completed file items only (not pending and no errors)
    const completedFileItems = useMemo(
      () =>
        contextItems.filter((item) => {
          if (item.type !== 'file') return false;
          if (item.entityId.startsWith('pending_')) return false;
          if (item.metadata?.errorType) return false;
          return true;
        }),
      [contextItems],
    );

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
      setPendingPrompt,
    } = useCopilotStoreShallow((state) => ({
      currentSessionId: state.currentSessionId[canvasId],
      setCurrentSessionId: state.setCurrentSessionId,
      appendSessionResultId: state.appendSessionResultId,
      setCreatedCopilotSessionId: state.setCreatedCopilotSessionId,
      sessionResultIds: state.sessionResultIds[state.currentSessionId?.[canvasId]],
      addHistoryTemplateSession: state.addHistoryTemplateSession,
      pendingPrompt: state.pendingPrompt[canvasId],
      setPendingPrompt: state.setPendingPrompt,
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

    // Handle file upload with progress tracking
    const handleFileUpload = useCallback(
      async (file: File, existingUploadId?: string, existingEntityId?: string) => {
        // Check file count limit (use ref for parallel upload support)
        if (!existingUploadId) {
          if (fileCountRef.current >= MAX_FILE_COUNT) {
            message.warning(t('copilot.fileLimit.reached'));
            return;
          }
          // Increment ref immediately for parallel upload tracking
          fileCountRef.current += 1;
        }

        // Check file size limit (50MB)
        if (file.size > MAX_FILE_SIZE) {
          // Decrement ref if we're rejecting this file
          if (!existingUploadId) {
            fileCountRef.current -= 1;
          }
          message.error(t('copilot.fileSizeLimit'));
          return;
        }

        // Generate or reuse IDs
        const uploadId = existingUploadId || genUniqueId();
        const tempEntityId = existingEntityId || `pending_${uploadId}`;

        // Start/restart upload tracking
        startUpload([
          {
            id: uploadId,
            fileName: file.name,
            progress: 0,
            status: 'uploading',
          },
        ]);

        // Create preview URL for image files (only for new uploads)
        const isImageFile = file.type.startsWith('image/');
        let previewUrl = pendingFilesRef.current.get(uploadId)?.previewUrl;
        if (!previewUrl && isImageFile) {
          previewUrl = URL.createObjectURL(file);
        }

        // Store file data for potential retry
        pendingFilesRef.current.set(uploadId, { file, previewUrl });

        // Add pending item immediately to show in UI (only for new uploads)
        if (!existingEntityId) {
          setContextItems((prev) => [
            ...prev,
            {
              type: 'file',
              entityId: tempEntityId,
              title: file.name,
              metadata: { size: file.size, mimeType: file.type, uploadId, previewUrl },
            } as IContextItem,
          ]);
        } else {
          // Clear error state for retry
          setContextItems((prev) =>
            prev.map((item) =>
              item.entityId === existingEntityId
                ? {
                    ...item,
                    metadata: { ...item.metadata, errorType: undefined },
                  }
                : item,
            ),
          );
        }

        try {
          // Upload file
          const response = await getClient().upload({
            body: {
              file,
              entityId: canvasId,
              entityType: 'canvas',
            },
          });

          updateProgress(uploadId, 100);

          const { data, success } = response?.data ?? {};

          if (success && data) {
            // Create drive file
            try {
              const { data: createResult } = await getClient().batchCreateDriveFiles({
                body: {
                  canvasId,
                  files: [
                    {
                      name: file.name,
                      canvasId,
                      storageKey: data.storageKey,
                      type: file.type || 'application/octet-stream',
                    },
                  ],
                },
              });

              if (createResult?.success && createResult.data?.[0]) {
                const driveFile = createResult.data[0];
                setUploadSuccess(uploadId);

                // Replace pending item with actual file
                setContextItems((prev) =>
                  prev.map((item) =>
                    item.entityId === tempEntityId
                      ? {
                          ...item,
                          entityId: driveFile.fileId,
                          title: driveFile.name,
                          metadata: { ...item.metadata, uploadId, errorType: undefined },
                        }
                      : item,
                  ),
                );

                // Clean up pending file data on success
                pendingFilesRef.current.delete(uploadId);

                await refetchFiles();
              } else {
                throw new Error('addToFile');
              }
            } catch {
              // Add to file failed
              setUploadError(uploadId, t('copilot.addToFileFailed'));
              setContextItems((prev) =>
                prev.map((item) =>
                  item.entityId === tempEntityId
                    ? {
                        ...item,
                        metadata: { ...item.metadata, errorType: 'addToFile' },
                      }
                    : item,
                ),
              );
            }
          } else {
            throw new Error('upload');
          }
        } catch {
          // Upload failed
          setUploadError(uploadId, t('copilot.uploadFailed'));
          setContextItems((prev) =>
            prev.map((item) =>
              item.entityId === tempEntityId
                ? {
                    ...item,
                    metadata: { ...item.metadata, errorType: 'upload' },
                  }
                : item,
            ),
          );
        }
      },
      [canvasId, t, startUpload, updateProgress, setUploadSuccess, setUploadError, refetchFiles],
    );

    // Handle file retry
    const handleRetryFile = useCallback(
      (entityId: string) => {
        const item = contextItems.find((i) => i.entityId === entityId);
        if (!item?.metadata?.uploadId) return;

        const uploadId = item.metadata.uploadId;
        const pendingData = pendingFilesRef.current.get(uploadId);

        if (pendingData?.file) {
          // Retry with existing IDs
          handleFileUpload(pendingData.file, uploadId, entityId);
        }
      },
      [contextItems, handleFileUpload],
    );

    // Handle file removal
    const handleRemoveFile = useCallback(
      (entityId: string) => {
        // Find the item to get its uploadId and previewUrl
        const item = contextItems.find((i) => i.entityId === entityId);
        if (item?.metadata?.uploadId) {
          removeUpload(item.metadata.uploadId);
          // Clean up pending file data
          const pendingData = pendingFilesRef.current.get(item.metadata.uploadId);
          if (pendingData?.previewUrl) {
            URL.revokeObjectURL(pendingData.previewUrl);
          }
          pendingFilesRef.current.delete(item.metadata.uploadId);
        }
        // Revoke blob URL to prevent memory leak
        if (item?.metadata?.previewUrl) {
          URL.revokeObjectURL(item.metadata.previewUrl);
        }
        setContextItems((prev) => prev.filter((i) => i.entityId !== entityId));
      },
      [contextItems, removeUpload],
    );

    // Register file upload handler for drag-and-drop from parent
    useEffect(() => {
      if (onRegisterFileUploadHandler) {
        onRegisterFileUploadHandler(async (files: File[]) => {
          // Upload files in parallel
          await Promise.all(files.map((file) => handleFileUpload(file)));
        });
      }
    }, [onRegisterFileUploadHandler, handleFileUpload]);

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
        // Revoke blob URLs before clearing files to prevent memory leak
        for (const item of contextItems) {
          if (item.metadata?.previewUrl) {
            URL.revokeObjectURL(item.metadata.previewUrl);
          }
          if (item.metadata?.uploadId) {
            pendingFilesRef.current.delete(item.metadata.uploadId);
          }
        }
        // Clear files after sending
        setContextItems([]);

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
        contextItems,
        canvasId,
        invokeAction,
        setQuery,
        setCurrentSessionId,
        appendSessionResultId,
        setCreatedCopilotSessionId,
        t,
        addHistoryTemplateSession,
        onSendMessage,
      ],
    );

    useEffect(() => {
      if (pendingPrompt && !initialPromptProcessed.current) {
        initialPromptProcessed.current = true;
        handleSendMessage('button_click_send', pendingPrompt);

        // Clean up store
        setPendingPrompt(canvasId, null);
      }
    }, [pendingPrompt, handleSendMessage, setPendingPrompt, canvasId]);

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
        className="w-full p-3 rounded-xl overflow-hidden border-[0.5px] border-solid border-[rgba(0,0,0,0.1)] bg-[rgba(255,255,255,0.9)]"
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
          onUploadMultipleImages={async (files) => {
            // Upload files in parallel
            await Promise.all(files.map((file) => handleFileUpload(file)));
          }}
        />

        {/* Bottom action bar */}
        <CopilotActions
          query={query}
          fileCount={fileCount}
          maxFileCount={MAX_FILE_COUNT}
          isExecuting={isExecuting}
          onUploadFile={handleFileUpload}
          onSendMessage={() => handleSendMessage('button_click_send')}
          onAbort={handleAbort}
        />
      </div>
    );
  },
);

ChatBox.displayName = 'ChatBox';
