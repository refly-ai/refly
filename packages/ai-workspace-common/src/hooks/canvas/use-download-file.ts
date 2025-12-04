import { useCallback, useState } from 'react';
import { message } from 'antd';
import {
  buildSafeFileName,
  getExtFromContentType,
} from '@refly-packages/ai-workspace-common/utils/download-file';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router-dom';
import { getDriveFileUrl } from './use-drive-file-url';
import { usePublicFileUrlContext } from '@refly-packages/ai-workspace-common/context/public-file-url';
import type { DriveFile } from '@refly/openapi-schema';

interface DownloadableFile {
  fileId?: string;
  type?: string;
  name?: string;
}

interface DownloadFileParams {
  currentFile?: DownloadableFile | null;
  contentType?: string;
}

export const useDownloadFile = () => {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const usePublicFileUrl = usePublicFileUrlContext();

  // Check if current page is any share page (consistent with use-file-url.ts)
  const isShareCanvas = useMatch('/share/canvas/:canvasId');
  const isShareFile = useMatch('/share/file/:shareId');
  const isWorkflowApp = useMatch('/app/:shareId');
  const isSharePage = Boolean(isShareCanvas || isShareFile || isWorkflowApp);

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

      setIsDownloading(true);

      try {
        const file = currentFile as DriveFile;
        // Use async getFileUrl which handles publicURL fetching automatically
        // Pass download=true to trigger server-side URL processing for markdown/html/svg files
        const { fileUrl } = getDriveFileUrl(file, isSharePage, usePublicFileUrl, true);

        if (!fileUrl) {
          throw new Error('File URL not available');
        }

        // Use credentials for all requests
        const fetchOptions: RequestInit = { credentials: 'include' };
        const response = await fetch(fileUrl, fetchOptions);

        if (!response?.ok) {
          throw new Error(`Download failed: ${response?.status ?? 'unknown'}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        let type = contentType;
        if (type === 'application/octet-stream') {
          type = response.headers.get('content-type') || 'application/octet-stream';
        }

        let fileName = currentFile?.name ?? t('common.untitled');
        if (!fileName.includes('.')) {
          const fileExt = getExtFromContentType(type ?? '');
          fileName = buildSafeFileName(fileName, fileExt);
        }

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
    [isDownloading, t, isSharePage, usePublicFileUrl],
  );

  return {
    handleDownload,
    isDownloading,
  };
};
