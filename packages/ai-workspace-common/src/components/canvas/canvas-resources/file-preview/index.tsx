import { memo, useState, useEffect, useCallback } from 'react';
import { Button } from 'antd';
import { DriveFile } from '@refly/openapi-schema';
import { serverOrigin } from '@refly/ui-kit';
import { Download, File } from 'refly-icons';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';

interface FilePreviewProps {
  file: DriveFile;
}

interface FileContent {
  data: ArrayBuffer;
  contentType: string;
  url: string;
}

export const FilePreview = memo(({ file }: FilePreviewProps) => {
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

  const fetchFileContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${serverOrigin}/v1/drive/file/content/${file.fileId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await response.arrayBuffer();

      // Create object URL for the blob
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
  }, [file.fileId]);

  useEffect(() => {
    fetchFileContent();

    // Cleanup object URL on unmount
    return () => {
      if (fileContent?.url) {
        URL.revokeObjectURL(fileContent.url);
      }
    };
  }, [fetchFileContent]);

  const handleDownload = useCallback(async () => {
    if (!fileContent?.url) return;

    const link = document.createElement('a');
    link.href = `${fileContent.url}?download=1`;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [fileContent?.url, file.name]);

  const renderFilePreview = () => {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="h-full flex items-center justify-center flex-col gap-4">
          <div className="text-red-500 text-center">
            <File className="w-12 h-12 mx-auto mb-2" />
            <div>Failed to load file</div>
            <div className="text-sm text-gray-400 mt-1">{error}</div>
          </div>
          <Button onClick={fetchFileContent} size="small">
            Retry
          </Button>
        </div>
      );
    }

    if (!fileContent) return null;

    const { contentType, url } = fileContent;

    // Image files
    if (contentType.startsWith('image/')) {
      return (
        <div className="h-full flex items-center justify-center max-w-[1024px] mx-auto overflow-hidden relative">
          <img
            src={url}
            alt={file.name}
            className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
            loading="lazy"
            onClick={() => setIsPreviewModalVisible(true)}
          />

          {/* Image Preview Modal */}
          <div className="absolute inset-0 pointer-events-none">
            <ImagePreview
              isPreviewModalVisible={isPreviewModalVisible}
              setIsPreviewModalVisible={setIsPreviewModalVisible}
              imageUrl={url}
            />
          </div>
        </div>
      );
    }

    // Text files
    if (contentType.startsWith('text/')) {
      const textContent = new TextDecoder().decode(fileContent.data);
      return (
        <div className="h-full overflow-auto p-4">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{textContent}</div>
        </div>
      );
    }

    // PDF files
    if (contentType === 'application/pdf') {
      return (
        <div className="h-full flex flex-col">
          <iframe src={url} className="w-full h-full border-0" title={file.name} />
        </div>
      );
    }

    // Video files
    if (contentType.startsWith('video/')) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4">
            <video
              src={url}
              controls
              className="max-w-full max-h-full object-contain"
              preload="metadata"
            >
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      );
    }

    // Audio files
    if (contentType.startsWith('audio/')) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4">
            <audio src={url} controls className="w-full max-w-md" preload="metadata">
              <track kind="captions" />
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      );
    }

    // Unsupported file types - show download option
    return (
      <div className="h-full flex items-center justify-center flex-col gap-4">
        <div className="text-center">
          <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <div className="text-lg font-medium text-gray-700 mb-2">{file.name}</div>
          <div className="text-sm text-gray-500 mb-4">File type: {contentType}</div>
          <div className="text-sm text-gray-400">Preview not available for this file type</div>
        </div>
        <Button type="primary" icon={<Download className="w-4 h-4" />} onClick={handleDownload}>
          Download File
        </Button>
      </div>
    );
  };

  return <div className="h-full overflow-hidden bg-white">{renderFilePreview()}</div>;
});
