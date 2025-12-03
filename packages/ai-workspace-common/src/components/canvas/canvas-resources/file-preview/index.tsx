import { memo, useState, useEffect, useCallback } from 'react';
import { Button } from 'antd';
import { DriveFile } from '@refly/openapi-schema';
import { Download, File } from 'refly-icons';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';
import { isCodeFile, getCodeLanguage } from '@refly-packages/ai-workspace-common/utils/file-type';
import { useDriveFileUrl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-drive-file-url';
import SyntaxHighlighter from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/syntax-highlighter';
import Renderer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/render';
import CodeViewer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer';
import { cn } from '@refly/utils/cn';
import { useMatch } from 'react-router-dom';
interface FilePreviewProps {
  file: DriveFile;
  markdownClassName?: string;
  source?: 'card' | 'preview';
}

interface FileContent {
  data: ArrayBuffer;
  contentType: string;
  url: string;
}

export const FilePreview = memo(
  ({ file, markdownClassName = '', source = 'card' }: FilePreviewProps) => {
    const [fileContent, setFileContent] = useState<FileContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');

    // Check if current page is a share page
    const isShareFile = useMatch('/share/file/:shareId');

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

    const handleDownload = useCallback(async () => {
      if (!fileContent?.url) return;

      const link = document.createElement('a');
      link.href = `${fileContent.url}?download=1`;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, [fileContent?.url, file.name]);

    const handleTabChange = useCallback((tab: 'code' | 'preview') => {
      setActiveTab(tab);
    }, []);

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

      // SVG files - render in Shadow DOM to isolate styles while preserving cookie for internal image requests
      if (contentType === 'image/svg+xml') {
        const svgContent = new TextDecoder().decode(fileContent.data);
        return (
          <div className="h-full flex items-center justify-center max-w-[1024px] mx-auto overflow-hidden relative">
            <div
              className="max-w-full max-h-full cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setIsPreviewModalVisible(true)}
              ref={(el) => {
                if (el && !el.shadowRoot) {
                  const shadow = el.attachShadow({ mode: 'open' });
                  shadow.innerHTML = svgContent;
                }
              }}
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

      // Image files (non-SVG)
      if (contentType.startsWith('image/')) {
        return (
          <div className="h-full flex items-center justify-center max-w-[1024px] mx-auto overflow-hidden relative">
            <img
              src={url}
              alt={file.name}
              className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity rounded-lg"
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
        const language = getCodeLanguage(file.name);

        // HTML file handling
        if (language === 'html') {
          // If source is 'card' or in share page, use simple Renderer preview
          if (source === 'card' || isShareFile) {
            return (
              <div className="h-full overflow-hidden">
                <Renderer
                  content={textContent}
                  type="text/html"
                  title={file.name}
                  showActions={false}
                  purePreview={true}
                />
              </div>
            );
          }

          // If source is 'preview' and not in share page, use CodeViewer with code/preview tabs
          if (source === 'preview') {
            return (
              <div className="h-full">
                <CodeViewer
                  code={textContent}
                  language="html"
                  title={file.name}
                  entityId={file.fileId}
                  isGenerating={false}
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  onClose={() => {}}
                  onRequestFix={() => {}}
                  readOnly={true}
                  type="text/html"
                  showActions={false}
                  purePreview={false}
                />
              </div>
            );
          }
        }

        // Markdown file handling
        if (language === 'markdown') {
          // If source is 'card', use simple Markdown preview
          if (source === 'card') {
            return (
              <div className="h-full overflow-y-auto">
                <Markdown content={textContent} className={markdownClassName} />
              </div>
            );
          }

          // If source is 'preview', use CodeViewer with code/preview tabs
          if (source === 'preview') {
            return (
              <div className="h-full">
                <CodeViewer
                  code={textContent}
                  language="markdown"
                  title={file.name}
                  entityId={file.fileId}
                  isGenerating={false}
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  onClose={() => {}}
                  onRequestFix={() => {}}
                  readOnly={true}
                  type="text/markdown"
                  showActions={false}
                  purePreview={false}
                />
              </div>
            );
          }
        }

        // Check if it's a code file
        const isCode = isCodeFile(file.name);

        // Render as code with syntax highlighting
        if (isCode && language) {
          return (
            <div className="h-full overflow-y-auto">
              <SyntaxHighlighter code={textContent} language={language} />
            </div>
          );
        }

        // Render as markdown for non-code text files
        return (
          <div className="h-full overflow-y-auto">
            <Markdown content={textContent} className={markdownClassName} />
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

      // JSON files
      if (contentType === 'application/json') {
        const textContent = new TextDecoder().decode(fileContent.data);
        return (
          <div className="h-full overflow-y-auto">
            <SyntaxHighlighter code={textContent} language="json" />
          </div>
        );
      }

      // Video files
      if (contentType.startsWith('video/')) {
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <video
                src={url}
                controls
                className="max-w-full max-h-full object-contain rounded-lg"
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
            <div className="flex-1 flex items-center justify-center">
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
