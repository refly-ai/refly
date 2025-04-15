import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Button, Space, Tooltip, message } from 'antd';
import { CopyIcon, DownloadIcon } from 'lucide-react';
import { PiMagnifyingGlassPlusBold } from 'react-icons/pi';
import { BRANDING_NAME } from '@refly/utils';
import { useTranslation } from 'react-i18next';
import { domToPng } from 'modern-screenshot';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';

interface SVGRendererProps {
  content: string;
  title?: string;
  width?: string;
  height?: string;
}

const SVG_ID = 'refly-svg-content';

const SVGRenderer = memo(
  ({ content, title, width = '100%', height = '100%' }: SVGRendererProps) => {
    const { t } = useTranslation();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeHeight, setIframeHeight] = useState<number | null>(null);
    const [iframeWidth, setIframeWidth] = useState<number | null>(null);
    const [aspectRatio, setAspectRatio] = useState<number | null>(null);
    const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
    const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
    const [zoomImageUrl, setZoomImageUrl] = useState<string>('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Set up the iframe content when the component mounts or content changes
    useEffect(() => {
      if (!iframeRef.current) return;

      const doc = iframeRef.current.contentDocument;
      if (!doc || !content) return;

      // Process the SVG content to add an ID to the SVG element
      let processedContent = content;
      if (content.includes('<svg') && !content.includes(`id="${SVG_ID}"`)) {
        // Add the ID attribute to the SVG tag
        processedContent = content.replace(/<svg/i, `<svg id="${SVG_ID}"`);
      }

      // Create a complete HTML document with the SVG content
      const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body, html {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: transparent;
            }
            svg {
              max-width: 100%;
              max-height: 100%;
              width: auto !important;
              height: auto !important;
              display: block;
              object-fit: contain;
            }
            #container {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            /* Override any fixed dimensions on SVG to ensure proper scaling */
            #${SVG_ID} {
              width: auto !important;
              height: auto !important;
              max-width: 100% !important;
              max-height: 100% !important;
              object-fit: contain !important;
            }
          </style>
          <script>
            // Function to calculate SVG dimensions based on multiple methods
            function getSvgDimensions(svg) {
              if (!svg) return { width: 0, height: 0 };
              
              // Method 1: Check explicit width/height attributes
              const widthAttr = svg.getAttribute('width');
              const heightAttr = svg.getAttribute('height');
              
              // Method 2: Check computed style
              const computedStyle = window.getComputedStyle(svg);
              const styleWidth = computedStyle.width;
              const styleHeight = computedStyle.height;
              
              // Method 3: Check viewBox attribute
              const viewBox = svg.getAttribute('viewBox');
              let viewBoxWidth = 0;
              let viewBoxHeight = 0;
              let viewBoxRatio = 1;
              
              if (viewBox) {
                const viewBoxValues = viewBox.split(' ').map(Number);
                if (viewBoxValues.length === 4) {
                  // viewBox format: min-x min-y width height
                  viewBoxWidth = viewBoxValues[2];
                  viewBoxHeight = viewBoxValues[3];
                  viewBoxRatio = viewBoxWidth / viewBoxHeight;
                }
              }
              
              // Method 4: Get bounding client rect (actual rendered size)
              const rect = svg.getBoundingClientRect();
              const boundingWidth = rect.width;
              const boundingHeight = rect.height;
              
              // Method 5: Check all child elements and get the max dimensions
              let maxChildWidth = 0;
              let maxChildHeight = 0;
              if (svg.children && svg.children.length > 0) {
                for (let i = 0; i < svg.children.length; i++) {
                  const childRect = svg.children[i].getBoundingClientRect();
                  maxChildWidth = Math.max(maxChildWidth, childRect.width);
                  maxChildHeight = Math.max(maxChildHeight, childRect.height);
                }
              }
              
              console.log('SVG dimensions measurements:', {
                widthAttr,
                heightAttr,
                styleWidth,
                styleHeight,
                viewBoxWidth,
                viewBoxHeight,
                boundingWidth,
                boundingHeight,
                maxChildWidth,
                maxChildHeight
              });
              
              // Determine the original dimensions (before any scaling)
              let originalWidth = 0;
              let originalHeight = 0;
              
              // Use viewBox dimensions as priority if available
              if (viewBoxWidth > 0 && viewBoxHeight > 0) {
                originalWidth = viewBoxWidth;
                originalHeight = viewBoxHeight;
              } 
              // Next try explicit width/height attributes that aren't percentage-based
              else if (widthAttr && !widthAttr.includes('%') && heightAttr && !heightAttr.includes('%')) {
                originalWidth = parseFloat(widthAttr);
                originalHeight = parseFloat(heightAttr);
              } 
              // Fall back to bounding dimensions
              else {
                originalWidth = boundingWidth || maxChildWidth || 300;
                originalHeight = boundingHeight || maxChildHeight || 300;
              }
              
              // Add a small padding
              originalWidth += 20;
              originalHeight += 20;
              
              return { 
                width: Math.ceil(originalWidth), 
                height: Math.ceil(originalHeight),
                aspectRatio: originalWidth / originalHeight 
              };
            }
            
            // Function to send SVG dimensions to parent
            function reportSize() {
              const svg = document.querySelector('#${SVG_ID}');
              if (svg) {
                const { width, height, aspectRatio } = getSvgDimensions(svg);
                
                window.parent.postMessage({
                  type: 'svg-resize',
                  width: width,
                  height: height,
                  aspectRatio: aspectRatio
                }, '*');
              }
            }
            
            // Function to ensure SVG preserves aspect ratio
            function ensureSvgAspectRatio() {
              const svg = document.querySelector('#${SVG_ID}');
              if (svg) {
                // Always set preserveAspectRatio to ensure content is not stretched
                svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                
                // Override any fixed dimensions
                svg.style.width = 'auto';
                svg.style.height = 'auto';
                svg.style.maxWidth = '100%';
                svg.style.maxHeight = '100%';
                svg.style.objectFit = 'contain';
                
                // Store original viewBox if not present
                if (!svg.hasAttribute('viewBox') && 
                    svg.hasAttribute('width') && 
                    svg.hasAttribute('height')) {
                  const width = parseFloat(svg.getAttribute('width'));
                  const height = parseFloat(svg.getAttribute('height'));
                  if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
                    svg.setAttribute('viewBox', \`0 0 \${width} \${height}\`);
                  }
                }
              }
            }
            
            // Setup mutation observer to detect changes in the SVG
            window.onload = function() {
              ensureSvgAspectRatio();
              reportSize();
              
              // Set up observer for any changes to the SVG
              const observer = new MutationObserver(() => {
                ensureSvgAspectRatio();
                reportSize();
              });
              
              const svg = document.querySelector('#${SVG_ID}');
              if (svg) {
                observer.observe(svg, { 
                  attributes: true,
                  childList: true,
                  subtree: true
                });
              }
              
              // Also report on window resize
              window.addEventListener('resize', reportSize);
            };
          </script>
        </head>
        <body><div id="container">${processedContent}</div></body>
      </html>
    `;

      doc.open();
      doc.write(htmlContent);
      doc.close();

      // Listen for messages from the iframe
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'svg-resize') {
          setIframeHeight(event.data.height);
          setIframeWidth(event.data.width);
          setAspectRatio(event.data.aspectRatio);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [content]);

    // Monitor container size for responsive adjustments
    useEffect(() => {
      if (!containerRef) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === containerRef) {
            setContainerDimensions({
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            });
          }
        }
      });

      resizeObserver.observe(containerRef);
      return () => resizeObserver.disconnect();
    }, [containerRef]);

    const generatePng = async () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument) return null;

      try {
        // Get the SVG element directly instead of using the entire body
        const svgElement = iframe.contentDocument.getElementById(SVG_ID);
        if (!svgElement) {
          console.error('SVG element not found');
          return null;
        }

        // Capture just the SVG element
        const dataUrl = await domToPng(svgElement, {
          features: {
            // Don't enable control character removal to prevent Safari emoji issues
            removeControlCharacter: false,
          },
          // Use higher scale for better quality on high DPI displays
          scale: 5,
          quality: 1.0,
          backgroundColor: 'transparent', // Use transparent background for the SVG
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
      [content, title, t],
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

    // Handle opening zoom modal
    const handleZoom = useCallback(async () => {
      try {
        const dataUrl = await generatePng();
        if (dataUrl) {
          setZoomImageUrl(dataUrl);
          setIsModalVisible(true);
        } else {
          message.error('Failed to generate zoom image');
        }
      } catch (error) {
        console.error('Error generating zoom image:', error);
        message.error('Failed to generate zoom image');
      }
    }, [generatePng, t]);

    // Calculate the style for the iframe
    const iframeStyle = useMemo(() => {
      if (!containerDimensions.width || !containerDimensions.height || !aspectRatio) {
        // Default style when we don't have enough information
        return {
          border: 'none',
          width: width,
          height: height,
          maxWidth: '100%',
          maxHeight: '100%',
          minHeight: '300px',
          objectFit: 'contain',
        } as React.CSSProperties;
      }

      // Calculate dimensions that fit within the container while maintaining aspect ratio
      let finalWidth: number;
      let finalHeight: number;

      const containerRatio = containerDimensions.width / containerDimensions.height;

      if (aspectRatio > containerRatio) {
        // SVG is wider than container (relative to height)
        finalWidth = Math.min(containerDimensions.width, iframeWidth ?? 0);
        finalHeight = finalWidth / aspectRatio;
      } else {
        // SVG is taller than container (relative to width)
        finalHeight = Math.min(containerDimensions.height, iframeHeight ?? 0);
        finalWidth = finalHeight * aspectRatio;
      }

      // Ensure we have sensible minimums and don't exceed container dimensions
      finalWidth = Math.min(Math.max(finalWidth, 50), containerDimensions.width);
      finalHeight = Math.min(Math.max(finalHeight, 50), containerDimensions.height);

      return {
        border: 'none',
        width: `${finalWidth}px`,
        height: `${finalHeight}px`,
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
      } as React.CSSProperties;
    }, [width, height, iframeWidth, iframeHeight, aspectRatio, containerDimensions]);

    return (
      <div className="relative w-full h-full">
        {/* SVG Container */}
        <div
          ref={setContainerRef}
          className="w-full h-full flex items-center justify-center overflow-hidden bg-transparent"
        >
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <iframe
              ref={iframeRef}
              style={iframeStyle}
              title="svg-renderer"
              sandbox="allow-same-origin allow-scripts"
              className="flex-shrink-0"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-2 right-2 z-10">
          <Space.Compact className="shadow-sm rounded-md overflow-hidden">
            <Tooltip title={t('common.preview')}>
              <Button
                type="default"
                className="flex items-center justify-center bg-white hover:bg-gray-50 hover:text-purple-600 hover:border-purple-600 border border-gray-200"
                icon={<PiMagnifyingGlassPlusBold className="w-4 h-4" />}
                onClick={handleZoom}
              >
                <span className="sr-only">Preview</span>
              </Button>
            </Tooltip>
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

export default SVGRenderer;
