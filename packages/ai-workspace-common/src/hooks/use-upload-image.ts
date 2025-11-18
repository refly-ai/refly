import { genUniqueId } from '@refly/utils';
import { useMemo } from 'react';
import { useImageUploadStore, type UploadProgress } from '@refly/stores';
import { UpsertDriveFileRequest } from '@refly/openapi-schema';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-drive-files';

export const useUploadImage = () => {
  const { t } = useTranslation();
  const { startUpload, updateProgress, setUploadSuccess, setUploadError } = useImageUploadStore();
  const { refetch: refetchFiles } = useFetchDriveFiles();

  const uploadImage = async (image: File, canvasId: string, uploadId?: string) => {
    const response = await getClient().upload({
      body: {
        file: image,
        entityId: canvasId,
        entityType: 'canvas',
      },
    });

    // Update progress if uploadId is provided
    if (uploadId) {
      updateProgress(uploadId, 100);
    }

    return response?.data;
  };

  const handleUploadImage = async (imageFile: File, canvasId: string) => {
    const uploadFile: UploadProgress = {
      id: genUniqueId(),
      fileName: imageFile.name,
      progress: 0,
      status: 'uploading',
    };
    startUpload([uploadFile]);
    const uploadId = uploadFile?.id;

    try {
      const result = await uploadImage(imageFile, canvasId, uploadId);
      const { data, success } = result ?? {};

      if (success && data) {
        const batchCreateDriveFilesData: UpsertDriveFileRequest[] = [
          {
            name: imageFile.name,
            canvasId,
            storageKey: data.storageKey,
            type: imageFile.type || 'image/jpeg',
          },
        ];

        const { data: createResult } = await getClient().batchCreateDriveFiles({
          body: {
            files: batchCreateDriveFilesData,
          },
        });

        if (!createResult?.success) {
          if (uploadId) {
            setUploadError(uploadId, 'Failed to create resource');
          }
          message.error(t('common.saveFailed'));
          return null;
        }

        // Mark upload as successful
        if (uploadId) {
          setUploadSuccess(uploadId);
        }

        await refetchFiles();
        return createResult.data?.[0] || null;
      } else {
        // Mark upload as failed - uploadImage returned success: false or no data
        if (uploadId) {
          setUploadError(uploadId, 'Upload failed - no data received');
        }
        return null;
      }
    } catch (error) {
      // Mark upload as failed
      if (uploadId) {
        setUploadError(uploadId, error instanceof Error ? error.message : 'Upload failed');
      }
      message.error(t('common.saveFailed'));
      return null;
    }
  };

  const handleUploadMultipleImages = async (
    imageFiles: File[],
    canvasId: string,
  ): Promise<any[]> => {
    // Start upload tracking for all files
    const uploadFiles: UploadProgress[] = imageFiles.map((file) => ({
      id: genUniqueId(),
      fileName: file.name,
      progress: 0,
      status: 'uploading',
    }));
    startUpload(uploadFiles);

    const uploadResults = [];
    const batchCreateDriveFilesData: UpsertDriveFileRequest[] = [];

    // First, upload all images
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      const uploadId = uploadFiles[i]?.id;

      try {
        const result = await uploadImage(imageFile, canvasId, uploadId);
        const { data, success } = result ?? {};

        if (success && data) {
          uploadResults.push({ file: imageFile, uploadData: data, uploadId });
          batchCreateDriveFilesData.push({
            name: imageFile.name,
            canvasId,
            storageKey: data.storageKey,
            type: imageFile.type || 'image/jpeg',
          });
        } else {
          // Mark upload as failed - uploadImage returned success: false or no data
          if (uploadId) {
            setUploadError(uploadId, 'Upload failed - no data received');
          }
        }
      } catch (error) {
        // Mark upload as failed
        if (uploadId) {
          setUploadError(uploadId, error instanceof Error ? error.message : 'Upload failed');
        }
      }
    }

    // If we have successful uploads, create drive files in batch
    if (batchCreateDriveFilesData.length > 0) {
      try {
        const { data: createResult } = await getClient().batchCreateDriveFiles({
          body: {
            files: batchCreateDriveFilesData,
          },
        });

        if (createResult?.success && createResult.data) {
          // Mark all successful uploads as completed
          for (const { uploadId } of uploadResults) {
            if (uploadId) {
              setUploadSuccess(uploadId);
            }
          }
          await refetchFiles();
          return createResult.data;
        } else {
          // Mark all uploads as failed since resource creation failed
          for (const { uploadId } of uploadResults) {
            if (uploadId) {
              setUploadError(uploadId, 'Failed to create resources');
            }
          }
          message.error(t('common.saveFailed'));
          return [];
        }
      } catch (_error) {
        // Mark all uploads as failed
        for (const { uploadId } of uploadResults) {
          if (uploadId) {
            setUploadError(uploadId, 'Failed to create drive files');
          }
        }
        message.error(t('common.saveFailed'));
        return [];
      }
    }

    return [];
  };

  return useMemo(
    () => ({
      handleUploadImage,
      handleUploadMultipleImages,
    }),
    [],
  );
};
