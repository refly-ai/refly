import { memo, useCallback, useRef } from 'react';
import { Button, Space, Tooltip, message } from 'antd';
import { CopyIcon, DownloadIcon } from 'lucide-react';
import { BRANDING_NAME } from '@refly/utils';
import { useTranslation } from 'react-i18next';
import { domToPng } from 'modern-screenshot';

interface SVGRendererProps {
  content: string;
  title?: string;
}

const SVGRenderer = memo(({ content, title }: SVGRendererProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const generatePng = async () => {
    const container = containerRef.current;
    if (!container) return null;

    try {
      const dataUrl = await domToPng(container, {
        features: {
          // Don't enable control character removal to prevent Safari emoji issues
          removeControlCharacter: false,
        },
        // Use higher scale for better quality on high DPI displays
        scale: 5,
        quality: 1.0,
        backgroundColor: '#ffffff',
      });

      return dataUrl;
    } catch (error) {
      console.error('Failed to generate PNG:', error);
      return null;
    }
  };

  const downloadImage = useCallback(
    async (type: 'png' | 'svg') => {
      const messageKey = 'downloadImage';
      message.loading({ content: t('artifact.svg.downloadStarted'), key: messageKey });

      try {
        let dataUrl = '';
        let blob: Blob;

        if (type === 'png') {
          dataUrl = await generatePng();
          if (!dataUrl) {
            throw new Error('Failed to generate PNG');
          }
          const response = await fetch(dataUrl);
          blob = await response.blob();
        } else {
          // For SVG, properly serialize the SVG content with XML declaration
          const svgContent = `<?xml version="1.0" encoding="UTF-8"?>${content}`;
          blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
          dataUrl = URL.createObjectURL(blob);
        }

        const link = document.createElement('a');
        link.download = `${BRANDING_NAME}_${title ?? 'image'}.${type}`;
        link.href = dataUrl;
        link.click();

        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(dataUrl);
          link.remove();
        }, 100);

        message.success({ content: t('artifact.svg.downloadSuccess'), key: messageKey });
      } catch (error) {
        console.error('Failed to download image:', error);
        message.error({ content: t('artifact.svg.downloadError'), key: messageKey });
      }
    },
    [title, t],
  );

  const copyImage = useCallback(async () => {
    const messageKey = 'copyImage';
    message.loading({ content: t('artifact.svg.copyStarted'), key: messageKey });

    try {
      const dataUrl = await generatePng();
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

      message.success({ content: t('artifact.svg.copySuccess'), key: messageKey });
    } catch (error) {
      console.error('Failed to copy image:', error);
      message.error({ content: t('artifact.svg.copyError'), key: messageKey });
    }
  }, [t]);

  return (
    <div className="relative w-full h-full">
      {/* SVG Container */}
      <div className="w-full h-full flex items-center justify-center">
        <div
          ref={containerRef}
          className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-2 right-2 z-10">
        <Space.Compact className="shadow-sm rounded-md overflow-hidden">
          <Tooltip title={t('artifact.svg.downloadAsPng')}>
            <Button
              type="default"
              className="flex items-center justify-center bg-white hover:bg-gray-50 hover:text-blue-600 hover:border-blue-600 border-x border-gray-200"
              icon={<DownloadIcon className="w-4 h-4" />}
              onClick={() => downloadImage('png')}
            >
              <span className="sr-only">PNG</span>
            </Button>
          </Tooltip>
          <Tooltip title={t('artifact.svg.copyToClipboard')}>
            <Button
              type="default"
              className="flex items-center justify-center bg-white hover:bg-gray-50 hover:text-purple-600 hover:border-purple-600 border border-gray-200"
              icon={<CopyIcon className="w-4 h-4" />}
              onClick={copyImage}
            >
              <span className="sr-only">Copy</span>
            </Button>
          </Tooltip>
        </Space.Compact>
      </div>
    </div>
  );
});

export default SVGRenderer;
