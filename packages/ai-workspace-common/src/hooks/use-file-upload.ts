import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const fileCountRef = useRef(0);
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

  useEffect(() => {
    fileCountRef.current = fileCount;
  }, [fileCount]);

  const hasUploadingFiles = useMemo(
    () => relevantUploads.some((u) => u.status === 'uploading'),
    [relevantUploads],
  );

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

  const handleFileUpload = useCallback(
    async (file: File, existingUploadId?: string, existingEntityId?: string) => {
      if (!existingUploadId) {
        if (fileCountRef.current >= maxFileCount) {
          message.warning(t('copilot.fileLimit.reached'));
          return;
        }
        fileCountRef.current += 1;
      }

      if (file.size > maxFileSize) {
        if (!existingUploadId) {
          fileCountRef.current -= 1;
        }
        message.error(t('copilot.fileSizeLimit'));
        return;
      }

      let currentCanvasId = canvasId;
      if (!currentCanvasId && onCanvasRequired) {
        try {
          currentCanvasId = await onCanvasRequired();
        } catch (_error) {
          if (!existingUploadId) {
            fileCountRef.current -= 1;
          }
          message.error(t('copilot.canvasCreationFailed'));
          return;
        }
      }

      if (!currentCanvasId) {
        if (!existingUploadId) {
          fileCountRef.current -= 1;
        }
        message.error(t('copilot.canvasRequired'));
        return;
      }

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
          formData.append('entityId', currentCanvasId);
          formData.append('entityType', 'canvas');

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

          try {
            const { data: createResult } = await getClient().batchCreateDriveFiles({
              body: {
                canvasId: currentCanvasId,
                files: [
                  {
                    name: file.name,
                    canvasId: currentCanvasId,
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
    setContextItems([]);
  }, [contextItems]);

  return {
    contextItems,
    fileCount,
    hasUploadingFiles,
    completedFileItems,
    relevantUploads,
    handleFileUpload,
    handleRetryFile,
    handleRemoveFile,
    clearFiles,
  };
};
