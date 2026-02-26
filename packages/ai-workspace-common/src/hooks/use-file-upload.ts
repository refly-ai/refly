import { useCallback, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import type { IContextItem } from '@refly/common-types';
import { useImageUploadStore } from '@refly/stores';
import { genUniqueId } from '@refly/utils/id';
import { isDesktop, serverOrigin } from '@refly/ui-kit';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-drive-files';

const MAX_FILE_COUNT = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface UseFileUploadOptions {
  canvasId: string | null;
  maxFileCount?: number;
  maxFileSize?: number;
  onCanvasRequired?: () => Promise<string>;
}

interface PendingFileData {
  file: File;
  previewUrl?: string;
}

export const useFileUpload = ({
  canvasId,
  maxFileCount = MAX_FILE_COUNT,
  maxFileSize = MAX_FILE_SIZE,
  onCanvasRequired,
}: UseFileUploadOptions) => {
  const { t } = useTranslation();
  const [contextItems, setContextItems] = useState<IContextItem[]>([]);
  const pendingFilesRef = useRef<Map<string, PendingFileData>>(new Map());
  // Track pending upload count separately from contextItems to avoid race conditions
  // during batch uploads. This ref is incremented synchronously when upload starts
  // and only reset via clearFiles or decremented via handleRemoveFile.
  const pendingUploadCountRef = useRef(0);
  const { refetch: refetchFiles } = useFetchDriveFiles();

  const { uploads, startUpload, updateProgress, setUploadSuccess, setUploadError, removeUpload } =
    useImageUploadStore();

  const relevantUploads = useMemo(() => {
    const uploadIds = new Set(contextItems.map((item) => item.metadata?.uploadId).filter(Boolean));
    return uploads.filter((u) => uploadIds.has(u.id));
  }, [uploads, contextItems]);

  const fileCount = useMemo(
    () => contextItems.filter((item) => item.type === 'file').length,
    [contextItems],
  );

  const hasUploadingFiles = useMemo(
    () => relevantUploads.some((u) => u.status === 'uploading'),
    [relevantUploads],
  );

  // Files that are ready to be sent (either fully completed or staged with storageKey)
  const completedFileItems = useMemo(
    () =>
      contextItems.filter((item) => {
        if (item.type !== 'file') return false;
        if (item.metadata?.errorType) return false;
        // Include files that are fully completed (have real fileId)
        if (!item.entityId.startsWith('pending_')) return true;
        // Also include staged files (have storageKey but pending entityId)
        if (item.metadata?.storageKey) return true;
        return false;
      }),
    [contextItems],
  );

  // Files that are staged (have storageKey but not yet added to drive)
  const stagedFileItems = useMemo(
    () =>
      contextItems.filter((item) => {
        if (item.type !== 'file') return false;
        if (item.metadata?.errorType) return false;
        // Staged = has storageKey but still has pending entityId
        return item.entityId.startsWith('pending_') && !!item.metadata?.storageKey;
      }),
    [contextItems],
  );

  const handleFileUpload = useCallback(
    async (file: File, existingUploadId?: string, existingEntityId?: string) => {
      if (!existingUploadId) {
        if (pendingUploadCountRef.current >= maxFileCount) {
          message.warning(t('copilot.fileLimit.reached'));
          return;
        }
        pendingUploadCountRef.current += 1;
      }

      if (file.size > maxFileSize) {
        if (!existingUploadId) {
          pendingUploadCountRef.current -= 1;
        }
        message.error(t('copilot.fileSizeLimit'));
        return;
      }

      // Try to get canvas ID, but allow staging mode if not available
      let currentCanvasId = canvasId;
      if (!currentCanvasId && onCanvasRequired) {
        try {
          currentCanvasId = await onCanvasRequired();
        } catch (_error) {
          // Canvas creation failed, continue in staging mode (upload without canvas)
          console.log('[useFileUpload] Canvas creation failed, continuing in staging mode');
        }
      }

      // Allow upload even without canvas ID (staging mode)
      const isStagingMode = !currentCanvasId;

      const uploadId = existingUploadId || genUniqueId();
      const tempEntityId = existingEntityId || `pending_${uploadId}`;

      startUpload([
        {
          id: uploadId,
          fileName: file.name,
          progress: 0,
          status: 'uploading',
        },
      ]);

      const isImageFile = file.type.startsWith('image/');
      let previewUrl = pendingFilesRef.current.get(uploadId)?.previewUrl;
      if (!previewUrl && isImageFile) {
        previewUrl = URL.createObjectURL(file);
      }

      pendingFilesRef.current.set(uploadId, { file, previewUrl });

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
        const uploadResult = await new Promise<{
          data?: { data?: { storageKey: string }; success: boolean };
        }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append('file', file);
          // Only include entityId/entityType if we have a canvas (non-staging mode)
          if (!isStagingMode) {
            formData.append('entityId', currentCanvasId!);
            formData.append('entityType', 'canvas');
          }

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded * 100) / e.total);
              updateProgress(uploadId, Math.min(percent, 99));
            }
          });

          xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const res = JSON.parse(xhr.responseText);
                  resolve({ data: res });
                } catch (e) {
                  reject(e);
                }
              } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));

          xhr.open('POST', `${serverOrigin}/v1/misc/upload`);
          xhr.withCredentials = !isDesktop();
          xhr.send(formData);
        });

        updateProgress(uploadId, 100);

        const { data, success } = uploadResult?.data ?? {};

        if (success && data) {
          setContextItems((prev) =>
            prev.map((item) =>
              item.entityId === tempEntityId
                ? {
                    ...item,
                    metadata: { ...item.metadata, storageKey: data.storageKey },
                  }
                : item,
            ),
          );

          // In staging mode, skip batchCreateDriveFiles - will be done later when canvas is available
          if (isStagingMode) {
            // Mark as staged (upload success, but not yet added to drive)
            setUploadSuccess(uploadId);
            // Keep the pending file data for later finalization
            return;
          }

          try {
            const { data: createResult } = await getClient().batchCreateDriveFiles({
              body: {
                canvasId: currentCanvasId!,
                files: [
                  {
                    name: file.name,
                    canvasId: currentCanvasId!,
                    storageKey: data.storageKey,
                    type: file.type || 'application/octet-stream',
                  },
                ],
              },
            });

            if (createResult?.success && createResult.data?.[0]) {
              const driveFile = createResult.data[0];
              setUploadSuccess(uploadId);

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

              pendingFilesRef.current.delete(uploadId);
              await refetchFiles();
            } else {
              throw new Error('addToFile');
            }
          } catch {
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
    [
      canvasId,
      maxFileCount,
      maxFileSize,
      onCanvasRequired,
      t,
      startUpload,
      updateProgress,
      setUploadSuccess,
      setUploadError,
      refetchFiles,
    ],
  );

  const handleRetryFile = useCallback(
    (entityId: string) => {
      const item = contextItems.find((i) => i.entityId === entityId);
      if (!item?.metadata?.uploadId) return;

      const uploadId = item.metadata.uploadId;
      const pendingData = pendingFilesRef.current.get(uploadId);

      if (pendingData?.file) {
        handleFileUpload(pendingData.file, uploadId, entityId);
      }
    },
    [contextItems, handleFileUpload],
  );

  const handleRemoveFile = useCallback(
    (entityId: string) => {
      const item = contextItems.find((i) => i.entityId === entityId);
      if (item?.metadata?.uploadId) {
        removeUpload(item.metadata.uploadId);
        const pendingData = pendingFilesRef.current.get(item.metadata.uploadId);
        if (pendingData?.previewUrl) {
          URL.revokeObjectURL(pendingData.previewUrl);
        }
        pendingFilesRef.current.delete(item.metadata.uploadId);
      }
      if (item?.metadata?.previewUrl) {
        URL.revokeObjectURL(item.metadata.previewUrl);
      }
      // Decrement the pending upload count when a file is removed
      if (item?.type === 'file' && pendingUploadCountRef.current > 0) {
        pendingUploadCountRef.current -= 1;
      }
      setContextItems((prev) => prev.filter((i) => i.entityId !== entityId));
    },
    [contextItems, removeUpload],
  );

  const clearFiles = useCallback(() => {
    for (const item of contextItems) {
      if (item.metadata?.previewUrl) {
        URL.revokeObjectURL(item.metadata.previewUrl);
      }
      if (item.metadata?.uploadId) {
        pendingFilesRef.current.delete(item.metadata.uploadId);
      }
    }
    // Reset the pending upload count when all files are cleared
    pendingUploadCountRef.current = 0;
    setContextItems([]);
  }, [contextItems]);

  // Finalize staged files by creating drive files when canvas ID is available
  const finalizeFiles = useCallback(
    async (targetCanvasId: string): Promise<IContextItem[]> => {
      if (!targetCanvasId || stagedFileItems.length === 0) {
        return completedFileItems;
      }

      const finalizedItems: IContextItem[] = [];

      for (const item of stagedFileItems) {
        const storageKey = item.metadata?.storageKey;
        if (!storageKey) continue;

        try {
          const { data: createResult } = await getClient().batchCreateDriveFiles({
            body: {
              canvasId: targetCanvasId,
              files: [
                {
                  name: item.title,
                  canvasId: targetCanvasId,
                  storageKey,
                  type: item.metadata?.mimeType || 'application/octet-stream',
                },
              ],
            },
          });

          if (createResult?.success && createResult.data?.[0]) {
            const driveFile = createResult.data[0];

            // Update context item with real fileId
            setContextItems((prev) =>
              prev.map((i) =>
                i.entityId === item.entityId
                  ? {
                      ...i,
                      entityId: driveFile.fileId,
                      title: driveFile.name,
                      metadata: { ...i.metadata, errorType: undefined },
                    }
                  : i,
              ),
            );

            finalizedItems.push({
              ...item,
              entityId: driveFile.fileId,
              title: driveFile.name,
            });

            // Clean up pending file data
            if (item.metadata?.uploadId) {
              pendingFilesRef.current.delete(item.metadata.uploadId);
            }
          }
        } catch (error) {
          console.error('[useFileUpload] Failed to finalize file:', item.title, error);
          // Continue with other files even if one fails
        }
      }

      await refetchFiles();

      // Return all completed items (both previously completed and newly finalized)
      return [
        ...completedFileItems.filter((item) => !item.entityId.startsWith('pending_')),
        ...finalizedItems,
      ];
    },
    [stagedFileItems, completedFileItems, refetchFiles],
  );

  // Batch upload method that handles multiple files atomically
  // This ensures all files are added to contextItems in a single update
  // before any async operations begin, avoiding race conditions
  const handleBatchFileUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      // Calculate how many files we can accept
      const availableSlots = maxFileCount - pendingUploadCountRef.current;
      if (availableSlots <= 0) {
        message.warning(t('copilot.fileLimit.reached'));
        return;
      }

      // Filter and limit files
      const filesToUpload: Array<{
        file: File;
        uploadId: string;
        tempEntityId: string;
        previewUrl?: string;
      }> = [];

      for (const file of files) {
        if (filesToUpload.length >= availableSlots) {
          message.warning(t('copilot.fileLimit.reached'));
          break;
        }

        if (file.size > maxFileSize) {
          message.error(t('copilot.fileSizeLimit'));
          continue;
        }

        const uploadId = genUniqueId();
        const tempEntityId = `pending_${uploadId}`;
        const isImageFile = file.type.startsWith('image/');
        const previewUrl = isImageFile ? URL.createObjectURL(file) : undefined;

        filesToUpload.push({ file, uploadId, tempEntityId, previewUrl });
      }

      if (filesToUpload.length === 0) return;

      // Atomically reserve slots for all files
      pendingUploadCountRef.current += filesToUpload.length;

      // Try to get canvas ID, but allow staging mode if not available
      let currentCanvasId = canvasId;
      if (!currentCanvasId && onCanvasRequired) {
        try {
          currentCanvasId = await onCanvasRequired();
        } catch (_error) {
          // Canvas creation failed, continue in staging mode (upload without canvas)
          console.log(
            '[useFileUpload] Canvas creation failed, continuing in staging mode for batch',
          );
        }
      }

      // Allow upload even without canvas ID (staging mode)
      const isStagingMode = !currentCanvasId;

      // Add all files to context items in a single update
      const newContextItems: IContextItem[] = filesToUpload.map(
        ({ file, uploadId, tempEntityId, previewUrl }) => ({
          type: 'file' as const,
          entityId: tempEntityId,
          title: file.name,
          metadata: { size: file.size, mimeType: file.type, uploadId, previewUrl },
        }),
      );

      setContextItems((prev) => [...prev, ...newContextItems]);

      // Store pending file data and start upload tracking
      for (const { file, uploadId, previewUrl } of filesToUpload) {
        pendingFilesRef.current.set(uploadId, { file, previewUrl });
        startUpload([
          {
            id: uploadId,
            fileName: file.name,
            progress: 0,
            status: 'uploading',
          },
        ]);
      }

      // Now upload all files in parallel
      await Promise.all(
        filesToUpload.map(async ({ file, uploadId, tempEntityId }) => {
          try {
            const uploadResult = await new Promise<{
              data?: { data?: { storageKey: string }; success: boolean };
            }>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              const formData = new FormData();
              formData.append('file', file);
              // Only include entityId/entityType if we have a canvas (non-staging mode)
              if (!isStagingMode) {
                formData.append('entityId', currentCanvasId!);
                formData.append('entityType', 'canvas');
              }

              xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                  const percent = Math.round((e.loaded * 100) / e.total);
                  updateProgress(uploadId, Math.min(percent, 99));
                }
              });

              xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                      const res = JSON.parse(xhr.responseText);
                      resolve({ data: res });
                    } catch (e) {
                      reject(e);
                    }
                  } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                  }
                }
              };

              xhr.onerror = () => reject(new Error('Network error during upload'));

              xhr.open('POST', `${serverOrigin}/v1/misc/upload`);
              xhr.withCredentials = !isDesktop();
              xhr.send(formData);
            });

            updateProgress(uploadId, 100);

            const { data, success } = uploadResult?.data ?? {};

            if (success && data) {
              setContextItems((prev) =>
                prev.map((item) =>
                  item.entityId === tempEntityId
                    ? {
                        ...item,
                        metadata: { ...item.metadata, storageKey: data.storageKey },
                      }
                    : item,
                ),
              );

              // In staging mode, skip batchCreateDriveFiles - will be done later when canvas is available
              if (isStagingMode) {
                setUploadSuccess(uploadId);
                return;
              }

              try {
                const { data: createResult } = await getClient().batchCreateDriveFiles({
                  body: {
                    canvasId: currentCanvasId!,
                    files: [
                      {
                        name: file.name,
                        canvasId: currentCanvasId!,
                        storageKey: data.storageKey,
                        type: file.type || 'application/octet-stream',
                      },
                    ],
                  },
                });

                if (createResult?.success && createResult.data?.[0]) {
                  const driveFile = createResult.data[0];
                  setUploadSuccess(uploadId);

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

                  pendingFilesRef.current.delete(uploadId);
                  await refetchFiles();
                } else {
                  throw new Error('addToFile');
                }
              } catch {
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
        }),
      );
    },
    [
      canvasId,
      maxFileCount,
      maxFileSize,
      onCanvasRequired,
      t,
      startUpload,
      updateProgress,
      setUploadSuccess,
      setUploadError,
      refetchFiles,
    ],
  );

  return {
    contextItems,
    fileCount,
    hasUploadingFiles,
    completedFileItems,
    stagedFileItems,
    relevantUploads,
    handleFileUpload,
    handleBatchFileUpload,
    handleRetryFile,
    handleRemoveFile,
    clearFiles,
    finalizeFiles,
  };
};
