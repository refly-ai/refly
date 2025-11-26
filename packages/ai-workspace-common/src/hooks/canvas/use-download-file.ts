import { useCallback, useState } from 'react';
import { message } from 'antd';
import {
  buildSafeFileName,
  getExtFromContentType,
} from '@refly-packages/ai-workspace-common/utils/download-file';
import { useTranslation } from 'react-i18next';
import { getFileUrl } from './use-file-url';
import type { DriveFile } from '@refly/openapi-schema';

interface DownloadableFile {
  fileId?: string;
  type?: string;
  name?: string;
  publicURL?: string;
}

interface DownloadFileParams {
  currentFile?: DownloadableFile | null;
  contentType?: string;
}

export const useDownloadFile = () => {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const isSharePage = location?.pathname?.startsWith('/share/') ?? false;

  const handleDownload = useCallback(
    async ({ currentFile, contentType }: DownloadFileParams) => {
      if (isDownloading) {
        return;
      }

      if (!currentFile?.fileId) {
        message.error(t('canvas.resourceLibrary.download.invalidUrl'));
        return;
      }

      const triggerDownload = (href: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      let fileName = currentFile?.name ?? t('common.untitled');
      if (!fileName.includes('.')) {
        const fileExt = getExtFromContentType(contentType ?? '');
        fileName = buildSafeFileName(fileName, fileExt);
      }
      setIsDownloading(true);

      try {
        // Use the getFileUrl pure function
        const file = currentFile as DriveFile;
        const { fileUrl, shouldFetch } = getFileUrl(file, isSharePage, true);

        if (!fileUrl) {
          throw new Error('File URL not available');
        }

        const fetchOptions: RequestInit = shouldFetch ? { credentials: 'include' } : {};
        const response = await fetch(fileUrl, fetchOptions);

        if (!response?.ok) {
          throw new Error(`Download failed: ${response?.status ?? 'unknown'}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        triggerDownload(objectUrl, fileName);
        message.success(t('canvas.resourceLibrary.download.success'));

        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        console.error('Download failed:', error);
        message.error(t('canvas.resourceLibrary.download.error'));
      } finally {
        setIsDownloading(false);
      }
    },
    [isDownloading, t, isSharePage],
  );

  return {
    handleDownload,
    isDownloading,
  };
};
