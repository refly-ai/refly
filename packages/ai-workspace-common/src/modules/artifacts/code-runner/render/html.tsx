import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Space, Tooltip, message } from 'antd';
import { CopyIcon, DownloadIcon } from 'lucide-react';
import { PiMagnifyingGlassPlusBold } from 'react-icons/pi';
import { BRANDING_NAME } from '@refly/utils';
import { useTranslation } from 'react-i18next';
import { domToPng } from 'modern-screenshot';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';

interface HTMLRendererProps {
  htmlContent: string;
  title?: string;
  width?: string;
  height?: string;
}

const HTMLRenderer = memo(
  ({ htmlContent, title, width = '100%', height = '100%' }: HTMLRendererProps) => {
    const { t } = useTranslation();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [zoomImageUrl, setZoomImageUrl] = useState<string>('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    useEffect(() => {
      if (!iframeRef.current) return;

      const doc = iframeRef.current.contentDocument;
      if (!doc) return;

      // Create HTML document with styles for proper rendering
      const processedHtmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                overflow: auto;
              }
              #html-content {
                width: 100%;
                min-height: 100%;
              }
            </style>
          </head>
          <body>
            <div id="html-content">${htmlContent}</div>
          </body>
        </html>
      `;

      doc.open();
      doc.write(processedHtmlContent);
      doc.close();

      // Adjust iframe height to content if needed
      const adjustIframeHeight = () => {
        if (!iframeRef.current || !iframeRef.current.contentDocument) return;

        // We'll no longer adjust the iframe height automatically
        // to allow natural scrolling behavior within the iframe
      };

      // Allow content to render then adjust
      setTimeout(adjustIframeHeight, 100);
    }, [htmlContent, height]);

    const generatePng = async (fullPage = false) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument) return null;

      try {
        // Get the content element
        const contentElement = iframe.contentDocument.getElementById('html-content');
        if (!contentElement) {
          console.error('HTML content element not found');
          return null;
        }

        // For full page capture, temporarily adjust styles to capture everything
        if (fullPage && iframe.contentDocument.body) {
          // Save original styles
          const originalHeight = iframe.style.height;
          const originalOverflow = iframe.contentDocument.body.style.overflow;

          // Adjust to show full content
          const scrollHeight = iframe.contentDocument.body.scrollHeight;
          iframe.style.height = `${scrollHeight}px`;
          iframe.contentDocument.body.style.overflow = 'visible';

          // Wait a bit for styles to apply
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Capture the full content
          const dataUrl = await domToPng(contentElement, {
            features: {
              removeControlCharacter: false,
            },
            scale: 2,
            quality: 1.0,
            backgroundColor: 'white',
          });

          // Restore original styles
          iframe.style.height = originalHeight;
          iframe.contentDocument.body.style.overflow = originalOverflow;

          return dataUrl;
        }

        // Standard capture of visible area
        return await domToPng(contentElement, {
          features: {
            removeControlCharacter: false,
          },
          scale: 2,
          quality: 1.0,
          backgroundColor: 'white',
        });
      } catch (error) {
        console.error('Failed to generate PNG:', error);
        return null;
      }
    };

    const downloadImage = useCallback(
      async (fullPage = false) => {
        const messageKey = 'downloadImage';
        message.loading({
          content: t('artifact.html.downloadStarted', 'Generating image...'),
          key: messageKey,
        });

        try {
          const dataUrl = await generatePng(fullPage);
          if (!dataUrl) {
            throw new Error('Failed to generate PNG');
          }

          const response = await fetch(dataUrl);
          const blob = await response.blob();

          const link = document.createElement('a');
          link.download = `${BRANDING_NAME}_${title ?? 'html'}_${fullPage ? 'full' : 'visible'}.png`;
          link.href = URL.createObjectURL(blob);
          link.click();

          // Clean up
          setTimeout(() => {
            URL.revokeObjectURL(link.href);
            link.remove();
          }, 100);

          message.success({
            content: t('artifact.html.downloadSuccess', 'Image downloaded successfully'),
            key: messageKey,
          });
        } catch (error) {
          console.error('Failed to download image:', error);
          message.error({
            content: t('artifact.html.downloadError', 'Failed to download image'),
            key: messageKey,
          });
        }
      },
      [title, t],
    );

    const copyImage = useCallback(async () => {
      const messageKey = 'copyImage';
      message.loading({
        content: t('artifact.html.copyStarted', 'Copying to clipboard...'),
        key: messageKey,
      });

      try {
        const dataUrl = await generatePng(false);
        if (!dataUrl) {
          throw new Error('Failed to generate PNG');
        }

        const response = await fetch(dataUrl);
        const blob = await response.blob();

        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);

        message.success({
          content: t('artifact.html.copySuccess', 'Image copied to clipboard'),
          key: messageKey,
        });
      } catch (error) {
        console.error('Failed to copy image:', error);
        message.error({
          content: t('artifact.html.copyError', 'Failed to copy to clipboard'),
          key: messageKey,
        });
      }
    }, [t]);

    const handleZoom = useCallback(async () => {
      try {
        // For preview, always generate full page image
        const dataUrl = await generatePng(true);
        if (dataUrl) {
          setZoomImageUrl(dataUrl);
          setIsModalVisible(true);
        } else {
          message.error(t('artifact.html.previewError', 'Failed to generate preview'));
        }
      } catch (error) {
        console.error('Error generating zoom image:', error);
        message.error(t('artifact.html.previewError', 'Failed to generate preview'));
      }
    }, [t]);

    return (
      <div className="relative w-full h-full">
        {/* HTML Content Container */}
        <div className="w-full h-full overflow-hidden bg-white">
          <iframe
            ref={iframeRef}
            style={{ border: 'none', width, height }}
            title="html-renderer"
            className="w-full h-full"
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
            scrolling="auto"
          />
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-2 right-2 z-10">
          <Space.Compact className="shadow-sm rounded-md overflow-hidden backdrop-blur-sm">
            <Tooltip title={t('common.preview', 'Preview')}>
              <Button
                type="default"
                className="flex items-center justify-center bg-white/70 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-700/80 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-600 dark:hover:border-purple-400 border border-gray-200/80 dark:border-gray-700/80 text-gray-700 dark:text-gray-300"
                icon={<PiMagnifyingGlassPlusBold className="w-4 h-4" />}
                onClick={handleZoom}
              >
                <span className="sr-only">Preview</span>
              </Button>
            </Tooltip>
            <Tooltip title={t('artifact.svg.downloadAsPng', 'Download ')}>
              <Button
                type="default"
                className="flex items-center justify-center bg-white/70 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-700/80 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-600 dark:hover:border-blue-400 border-x border-gray-200/80 dark:border-gray-700/80 text-gray-700 dark:text-gray-300"
                icon={<DownloadIcon className="w-4 h-4" />}
                onClick={() => downloadImage(false)}
              >
                <span className="sr-only">PNG</span>
              </Button>
            </Tooltip>
            <Tooltip title={t('artifact.svg.copyToClipboard', 'Copy to clipboard')}>
              <Button
                type="default"
                className="flex items-center justify-center bg-white/70 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-700/80 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-600 dark:hover:border-purple-400 border border-gray-200/80 dark:border-gray-700/80 text-gray-700 dark:text-gray-300"
                icon={<CopyIcon className="w-4 h-4" />}
                onClick={copyImage}
              >
                <span className="sr-only">Copy</span>
              </Button>
            </Tooltip>
          </Space.Compact>
        </div>

        {/* Image Preview Modal */}
        <ImagePreview
          isPreviewModalVisible={isModalVisible}
          setIsPreviewModalVisible={setIsModalVisible}
          imageUrl={zoomImageUrl}
          imageTitle={title}
        />
      </div>
    );
  },
);

export default HTMLRenderer;
