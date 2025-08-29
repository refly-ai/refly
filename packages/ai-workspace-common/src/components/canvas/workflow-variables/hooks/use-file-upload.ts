import { useCallback, useState } from 'react';
import { message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ACCEPT_FILE_EXTENSIONS, MIME_TYPE_VALIDATION } from '../constants';
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

  const handleFileUpload = useCallback(
    async (file: File, fileList: UploadFile[]) => {
      try {
        // Check file count limit
        const maxFileCount = 1;
        if (fileList.length >= maxFileCount) {
          message.error(t('common.tooManyFiles') || `Maximum ${maxFileCount} files allowed`);
          return false;
        }

        // Check for duplicate file names
        const existingFileNames = fileList.map((f) => f.name);
        if (existingFileNames.includes(file.name)) {
          message.error(t('common.duplicateFileName') || 'File with this name already exists');
          return false;
        }

        // File validation
        const { maxSize, category, fileType } = getFileCategoryAndLimit(file);

        // Check if file type is supported
        if (category === 'unknown') {
          message.error(t('common.unsupportedFileType') || `Unsupported file type: .${fileType}`);
          return false;
        }

        // Additional MIME type validation for better security
        const allowedMimeTypes =
          MIME_TYPE_VALIDATION[category as keyof typeof MIME_TYPE_VALIDATION] || [];
        const isValidMimeType = allowedMimeTypes.some((type) => file.type.startsWith(type));

        if (!isValidMimeType) {
          message.error(
            t('common.unsupportedFileType') ||
              `File MIME type not supported for ${category}: ${file.type}`,
          );
          return false;
        }

        // Check file size limit
        if (maxSize > 0 && file.size > maxSize) {
          const maxSizeMB = maxSize / (1024 * 1024);
          message.error(
            t('common.fileTooLarge') || `${category} file size exceeds ${maxSizeMB}MB limit`,
          );
          return false;
        }

        setUploading(true);

        // Generate temporary UID for the file
        const tempUid = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Call uploadFile function to get storageKey
        const data = await uploadFile(file, tempUid);

        if (!data?.storageKey) {
          message.error(t('common.uploadFailed') || 'Upload failed');
          return false;
        }

        message.success(t('common.uploadSuccess') || 'Upload successful');
        return data;
      } catch (error) {
        console.error('Upload error:', error);
        message.error(t('common.uploadFailed') || 'Upload failed');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [t, uploadFile],
  );

  const handleRefreshFile = useCallback(
    async (_fileList: UploadFile[], onFileListChange: (fileList: UploadFile[]) => void) => {
      // Create a hidden file input element
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = ACCEPT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
      fileInput.multiple = false;
      fileInput.style.display = 'none';

      // Add event listener for file selection
      fileInput.addEventListener('change', async (event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;

        if (files && files.length > 0) {
          const file = files[0];

          try {
            // Validate and upload the new file
            const { maxSize, category, fileType } = getFileCategoryAndLimit(file);

            // Check if file type is supported
            if (category === 'unknown') {
              message.error(
                t('common.unsupportedFileType') || `Unsupported file type: .${fileType}`,
              );
              return;
            }

            // Check file size limit
            if (maxSize > 0 && file.size > maxSize) {
              const maxSizeMB = maxSize / (1024 * 1024);
              message.error(
                t('common.fileTooLarge') || `${category} file size exceeds ${maxSizeMB}MB limit`,
              );
              return;
            }

            setUploading(true);

            // Generate new UID for the file
            const tempUid = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Upload the new file
            const data = await uploadFile(file, tempUid);

            if (!data?.storageKey) {
              message.error(t('common.uploadFailed') || 'Upload failed');
              return;
            }

            // Replace the existing file with the new one
            const newFile: UploadFile = {
              uid: tempUid,
              name: file.name,
              status: 'done',
              url: data.storageKey,
            };

            // Replace the file list with the new file
            const newFileList = [newFile];
            onFileListChange(newFileList);

            message.success(t('common.uploadSuccess') || 'File refreshed successfully');
          } catch (error) {
            console.error('File refresh error:', error);
            message.error(t('common.uploadFailed') || 'File refresh failed');
          } finally {
            setUploading(false);
          }
        }

        // Clean up the file input
        document.body.removeChild(fileInput);
      });

      // Add to DOM and trigger click
      document.body.appendChild(fileInput);
      fileInput.click();
    },
    [t, uploadFile],
  );

  return {
    uploading,
    handleFileUpload,
    handleRefreshFile,
  };
};
