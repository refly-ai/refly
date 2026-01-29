import { memo, useCallback, useMemo } from 'react';
import { Modal, Button } from 'antd';
import { LuDownload, LuX } from 'react-icons/lu';
import { DriveFile } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { getCodeLanguage } from '@refly-packages/ai-workspace-common/utils/file-type';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/canvas/use-download-file';
import type { FileContent } from './types';

// Import renderer components
import { SvgRenderer } from './svg';
import { ImageRenderer } from './image';
import { CodeRenderer, JsonRenderer } from './code';
import { PdfRenderer } from './pdf';
import { VideoRenderer } from './video';
import { AudioRenderer } from './audio';
import { UnsupportedRenderer } from './unsupported';
import { HtmlRenderer } from './html';
import { MarkdownRenderer } from './markdown';

interface ContentCategoryResult {
  category: string;
  language?: string;
}

const extractContentCategory = (contentType: string, fileName: string): ContentCategoryResult => {
  // Media types
  if (contentType === 'image/svg+xml') return { category: 'svg' };
  if (contentType.startsWith('image/')) return { category: 'image' };
  if (contentType.startsWith('video/')) return { category: 'video' };
  if (contentType.startsWith('audio/')) return { category: 'audio' };

  // Document types
  if (contentType === 'application/pdf') return { category: 'pdf' };
  if (contentType === 'application/json') return { category: 'json' };
  if (contentType === 'application/javascript') return { category: 'code' };

  // Text types - further categorize by file extension
  if (contentType.startsWith('text/')) {
    const language = getCodeLanguage(fileName);

    if (language === 'html') return { category: 'html' };
    if (language === 'markdown' || language === 'mdx') return { category: 'markdown' };
    if (language) return { category: 'code', language };

    return { category: 'text' };
  }

  return { category: 'unsupported' };
};

interface FilePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  file: DriveFile;
  fileContent: FileContent | null;
}

export const FilePreviewModal = memo(
  ({ visible, onClose, file, fileContent }: FilePreviewModalProps) => {
    const { t } = useTranslation();
    const contentType = (file?.type ?? '') as string;
    const { handleDownload: downloadFile, isDownloading } = useDownloadFile();

    const handleDownload = useCallback(() => {
      downloadFile({ currentFile: file, contentType });
    }, [downloadFile, file, contentType]);

    const renderFilePreview = useCallback(() => {
      if (!fileContent) {
        return (
          <div className="text-sm text-refly-text-3 text-center h-full flex items-center justify-center">
            {t('driveFile.fileNoContent')}
          </div>
        );
      }

      const { category, language } = extractContentCategory(fileContent.contentType, file.name);

      switch (category) {
        case 'svg':
          return <SvgRenderer fileContent={fileContent} file={file} />;
        case 'image':
          return <ImageRenderer fileContent={fileContent} file={file} />;
        case 'html':
          return (
            <HtmlRenderer
              source="preview"
              fileContent={fileContent}
              file={file}
              activeTab="preview"
              onTabChange={() => {}}
              disableTruncation={false}
              purePreview={true}
            />
          );
        case 'markdown':
          return (
            <MarkdownRenderer
              source="preview"
              fileContent={fileContent}
              file={file}
              activeTab="preview"
              onTabChange={() => {}}
              disableTruncation={false}
            />
          );
        case 'code':
          return (
            <CodeRenderer
              source="preview"
              fileContent={fileContent}
              file={file}
              language={language!}
              activeTab="code"
              onTabChange={() => {}}
              disableTruncation={false}
            />
          );
        case 'text':
          return (
            <MarkdownRenderer
              source="preview"
              fileContent={fileContent}
              file={file}
              disableTruncation={false}
            />
          );
        case 'pdf':
          return <PdfRenderer fileContent={fileContent} file={file} />;
        case 'json':
          return (
            <JsonRenderer
              source="preview"
              fileContent={fileContent}
              file={file}
              disableTruncation={false}
            />
          );
        case 'video':
          return <VideoRenderer fileContent={fileContent} file={file} />;
        case 'audio':
          return <AudioRenderer fileContent={fileContent} file={file} />;
        default:
          return (
            <UnsupportedRenderer
              fileContent={fileContent}
              file={file}
              onDownload={handleDownload}
              isDownloading={isDownloading}
            />
          );
      }
    }, [fileContent, file, handleDownload, isDownloading, t]);

    // Check if the file supports download
    const canDownload = useMemo(() => {
      if (!fileContent) return false;
      // All files can be downloaded
      return true;
    }, [fileContent]);

    return (
      <Modal
        open={visible}
        onCancel={onClose}
        width="90vw"
        style={{ maxWidth: '1400px', top: 20 }}
        styles={{
          body: { height: 'calc(90vh - 110px)', overflow: 'hidden', padding: 0 },
        }}
        title={
          <div className="flex items-center justify-between pr-10">
            <span className="text-base font-semibold truncate max-w-[60vw]">{file.name}</span>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            {canDownload && (
              <Button
                icon={<LuDownload className="text-base" />}
                onClick={handleDownload}
                loading={isDownloading}
              >
                {t('common.download')}
              </Button>
            )}
            <Button onClick={onClose}>{t('common.close')}</Button>
          </div>
        }
        closeIcon={<LuX className="text-xl" />}
        destroyOnClose
      >
        <div className="h-full w-full overflow-auto">{renderFilePreview()}</div>
      </Modal>
    );
  },
);

FilePreviewModal.displayName = 'FilePreviewModal';
