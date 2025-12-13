import { useCallback, useState } from 'react';
import { message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ACCEPT_FILE_EXTENSIONS } from '../constants';
import {
  IMAGE_FILE_EXTENSIONS,
  DOCUMENT_FILE_EXTENSIONS,
  AUDIO_FILE_EXTENSIONS,
  VIDEO_FILE_EXTENSIONS,
} from '../constants';
import { getFileCategoryAndLimit } from '../utils';

export const useFileUpload = () => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  // Add uploadFile function to handle file upload and get storageKey
  const uploadFile = useCallback(async (file: File, uid: string) => {
    try {
      const { data, error } = await getClient().upload({
        body: { file },
      });

      if (error) {
        const errorMessage =
          typeof error === 'object' && error !== null && 'message' in error
            ? String(error.message)
            : 'Unknown error';
        throw new Error(`Upload error: ${errorMessage}`);
      }

      if (!data?.data?.storageKey) {
        throw new Error('Upload response missing storageKey');
      }

      return {
        storageKey: data.data.storageKey,
        url: data.data.url || '',
        uid,
      };
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof Error) {
        throw new Error(`File upload failed: ${error.message}`);
      } else {
        throw new Error('File upload failed: Unknown error');
      }
    }
  }, []);

  const validateFileSize = useCallback(
    (file: File) => {
      const { maxSize, category } = getFileCategoryAndLimit(file);

      if (maxSize > 0 && file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        message.error(
          t('common.fileTooLarge') || `${category} file size exceeds ${maxSizeMB}MB limit`,
        );
        return false;
      }
      return true;
    },
    [t],
  );

  const processFileUpload = useCallback(
    async (file: File) => {
      try {
        setUploading(true);

        // Generate temporary UID for the file
        const tempUid = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Call uploadFile function to get storageKey
        const data = await uploadFile(file, tempUid);

        if (!data?.storageKey) {
          message.error(t('common.uploadFailed') || 'Upload failed');
          return null;
        }

        return data;
      } catch (error) {
        console.error('Upload error:', error);
        message.error(t('common.uploadFailed') || 'Upload failed');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [t, uploadFile],
  );

  const handleFileUpload = useCallback(
    async (file: File, fileList: UploadFile[]) => {
      const maxFileCount = 1;
      if (fileList.length >= maxFileCount) {
        message.error(
          t('canvas.workflow.variables.tooManyFiles', { max: maxFileCount }) ||
            `Maximum ${maxFileCount} files allowed`,
        );
        return false;
      }

      const existingFileNames = fileList.map((f) => f.name);
      if (existingFileNames.includes(file.name)) {
        message.error(
          t('canvas.workflow.variables.duplicateFileName') || 'File with this name already exists',
        );
        return false;
      }

      if (!validateFileSize(file)) {
        return false;
      }

      const data = await processFileUpload(file);
      if (data) {
        message.success(t('common.uploadSuccess') || 'Upload successful');
        return data;
      }
      return false;
    },
    [t, validateFileSize, processFileUpload],
  );

  const handleRefreshFile = useCallback(
    async (
      _fileList: UploadFile[],
      onFileListChange: (fileList: UploadFile[]) => void,
      resourceTypes?: string[],
      _oldFileId?: string,
      canvasId?: string | null,
      variableId?: string,
    ) => {
      // Generate accept attribute based on resource types
      const generateAcceptAttribute = (types?: string[]) => {
        if (!types?.length) {
          return ACCEPT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
        }

        return types
          .map((type) => {
            switch (type) {
              case 'document':
                return DOCUMENT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
              case 'image':
                return IMAGE_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
              case 'audio':
                return AUDIO_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
              case 'video':
                return VIDEO_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
              default:
                return '';
            }
          })
          .filter(Boolean)
          .join(',');
      };

      // Create a hidden file input element
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = generateAcceptAttribute(resourceTypes);
      fileInput.multiple = false;
      fileInput.style.display = 'none';

      // Add event listener for file selection
      fileInput.addEventListener('change', async (event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;

        if (files && files.length > 0) {
          const file = files[0];

          // Validate file size
          if (!validateFileSize(file)) {
            return;
          }

          // Process file upload
          const data = await processFileUpload(file);
          if (data) {
            // Create new DriveFile if canvasId and variableId are provided
            let newFileId = data.uid;
            if (canvasId && variableId) {
              try {
                const { data: driveFileResponse, error } = await getClient().createDriveFile({
                  body: {
                    canvasId,
                    name: file.name,
                    type: file.type,
                    storageKey: data.storageKey,
                    source: 'variable',
                    variableId,
                    archiveFiles: true,
                  },
                });

                if (!error && driveFileResponse?.data?.fileId) {
                  newFileId = driveFileResponse.data.fileId;
                }
              } catch (error) {
                console.error('Failed to create new DriveFile:', error);
                // Continue with storageKey if DriveFile creation fails
              }
            }

            // Replace the existing file with the new one
            const newFile: UploadFile = {
              uid: newFileId,
              name: file.name,
              status: 'done',
              url: data.storageKey,
            };

            // Replace the file list with the new file
            const newFileList = [newFile];
            onFileListChange(newFileList);

            message.success(t('common.uploadSuccess') || 'File refreshed successfully');
          }
        }

        // Clean up the file input
        document.body.removeChild(fileInput);
      });

      // Add to DOM and trigger click
      document.body.appendChild(fileInput);
      fileInput.click();
    },
    [t, validateFileSize, processFileUpload],
  );

  return {
    uploading,
    handleFileUpload,
    handleRefreshFile,
  };
};
