import { memo, useState, useEffect, useCallback } from 'react';
import { Button } from 'antd';
import { DriveFile } from '@refly/openapi-schema';
import { File } from 'refly-icons';
import { getCodeLanguage } from '@refly-packages/ai-workspace-common/utils/file-type';
import { useDriveFileUrl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-drive-file-url';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/canvas/use-download-file';
import { cn } from '@refly/utils/cn';

// Import renderer components
import type { FileContent } from './types';

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

const LoadingState = memo(() => (
  <div className="h-full flex items-center justify-center">
    <div className="text-gray-500">Loading...</div>
  </div>
));

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

const ErrorState = memo(({ error, onRetry }: ErrorStateProps) => (
  <div className="h-full flex items-center justify-center flex-col gap-4">
    <div className="text-red-500 text-center">
      <File className="w-12 h-12 mx-auto mb-2" />
      <div>Failed to load file</div>
      <div className="text-sm text-gray-400 mt-1">{error}</div>
    </div>
    <Button onClick={onRetry} size="small">
      Retry
    </Button>
  </div>
));

interface FilePreviewProps {
  file: DriveFile;
  markdownClassName?: string;
  source?: 'card' | 'preview';
  disableTruncation?: boolean;
}

export const FilePreview = memo(
  ({
    file,
    markdownClassName = '',
    source = 'card',
    disableTruncation = false,
  }: FilePreviewProps) => {
    const [fileContent, setFileContent] = useState<FileContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');

    // useFileUrl now automatically fetches publicURL if needed in share pages
    const { fileUrl, isLoading: isLoadingUrl } = useDriveFileUrl({ file });

    const fetchFileContent = useCallback(async () => {
      // Wait for URL to be ready
      if (isLoadingUrl) {
        return;
      }

      if (!fileUrl) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Use credentials for all requests (publicURL doesn't need it, but it won't hurt)
        const fetchOptions: RequestInit = { credentials: 'include' };
        const response = await fetch(fileUrl, fetchOptions);

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }

        // Use file.type (MIME type) instead of response header for publicURL
        // because publicURL headers might return application/octet-stream
        let contentType = file.type;
        if (file.type === 'application/octet-stream') {
          contentType = response.headers.get('content-type') || 'application/octet-stream';
        }
        const arrayBuffer = await response.arrayBuffer();

        // Create object URL for the blob with correct MIME type
        const blob = new Blob([arrayBuffer], { type: contentType });
        const url = URL.createObjectURL(blob);

        setFileContent({
          data: arrayBuffer,
          contentType,
          url,
        });
      } catch (err) {
        console.error('Error fetching file content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    }, [fileUrl, file.type, isLoadingUrl]);

    useEffect(() => {
      fetchFileContent();

      // Cleanup object URL on unmount
      return () => {
        if (fileContent?.url) {
          URL.revokeObjectURL(fileContent.url);
        }
      };
    }, [fetchFileContent]);

    const contentType = (file?.type ?? '') as string;
    const { handleDownload: downloadFile, isDownloading } = useDownloadFile();
    const handleDownload = useCallback(() => {
      downloadFile({ currentFile: file, contentType });
    }, [downloadFile, file, contentType]);

    const handleTabChange = useCallback((tab: 'code' | 'preview') => {
      setActiveTab(tab);
    }, []);

    const renderFilePreview = () => {
      if (loading) return <LoadingState />;
      if (error) return <ErrorState error={error} onRetry={fetchFileContent} />;
      if (!fileContent) return null;

      const { category, language } = extractContentCategory(fileContent.contentType, file.name);

      const rendererSource = source;

      switch (category) {
        case 'svg':
          return <SvgRenderer fileContent={fileContent} file={file} />;
        case 'image':
          return <ImageRenderer fileContent={fileContent} file={file} />;
        case 'html':
          return (
            <HtmlRenderer
              source={rendererSource}
              fileContent={fileContent}
              file={file}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              disableTruncation={disableTruncation}
            />
          );
        case 'markdown':
          return (
            <MarkdownRenderer
              source={source}
              fileContent={fileContent}
              file={file}
              className={markdownClassName}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              disableTruncation={disableTruncation}
            />
          );
        case 'code':
          return (
            <CodeRenderer
              source={rendererSource}
              fileContent={fileContent}
              file={file}
              language={language!}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              disableTruncation={disableTruncation}
            />
          );
        case 'text':
          return (
            <MarkdownRenderer
              source={rendererSource}
              fileContent={fileContent}
              file={file}
              className={markdownClassName}
              disableTruncation={disableTruncation}
            />
          );
        case 'pdf':
          return <PdfRenderer fileContent={fileContent} file={file} />;
        case 'json':
          return (
            <JsonRenderer
              source={rendererSource}
              fileContent={fileContent}
              file={file}
              disableTruncation={disableTruncation}
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
    };

    return (
      <div
        className={cn('flex-1 h-full overflow-hidden', {
          'max-h-[230px]': source === 'card',
        })}
      >
        {renderFilePreview()}
      </div>
    );
  },
);
