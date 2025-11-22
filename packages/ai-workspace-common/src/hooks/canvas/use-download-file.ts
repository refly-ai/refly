import { useCallback, useState } from 'react';
import { message } from 'antd';
import { serverOrigin } from '@refly/ui-kit';
import {
  buildSafeFileName,
  getExtFromContentType,
} from '@refly-packages/ai-workspace-common/utils/download-file';
import { useTranslation } from 'react-i18next';

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

      const baseTitle = currentFile?.name ?? t('common.untitled');
      const fileExt = getExtFromContentType(contentType ?? '');
      const fileName = buildSafeFileName(baseTitle, fileExt);
      console.log('fileName', fileName);
      console.log('fileExt', fileExt);
      setIsDownloading(true);

      try {
        const url = new URL(`${serverOrigin}/v1/drive/file/content/${currentFile?.fileId}`);
        url.searchParams.set('download', '1');

        const response = await fetch(url.toString(), {
          credentials: 'include',
        });

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
    [isDownloading, t],
  );

  return {
    handleDownload,
    isDownloading,
  };
};
