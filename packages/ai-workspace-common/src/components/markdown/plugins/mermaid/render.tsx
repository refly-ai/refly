import { useEffect, useRef, memo, ReactNode, useCallback, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import { useTranslation } from 'react-i18next';
import debounce from 'lodash.debounce';
import { cn, BRANDING_NAME } from '@refly/utils';
import { CopyIcon, DownloadIcon } from 'lucide-react';
import { Tooltip, Button, Space, message } from 'antd';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';
import { domToPng } from 'modern-screenshot';
import copyToClipboard from 'copy-to-clipboard';
import { IconCodeArtifact } from '@refly-packages/ai-workspace-common/components/common/icon';
import { CopyOutlined, CodeOutlined, EyeOutlined } from '@ant-design/icons';
import { MarkdownMode } from '../../types';
import { PiMagnifyingGlassPlusBold } from 'react-icons/pi';
import { useCreateCodeArtifact } from '@refly-packages/ai-workspace-common/hooks/use-create-code-artifact';
import { useThemeStoreShallow } from '../../../../stores/theme';

// Initialize mermaid config
const initializeMermaid = (isDarkMode: boolean) => {
  mermaid.initialize({
    startOnLoad: true,
    theme: isDarkMode ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
  });
};

interface MermaidProps {
  children: ReactNode;
  id?: string; // resultId for connecting to skill response node
  mode?: MarkdownMode;
}

// Generate unique ID for each mermaid diagram
const generateUniqueId = (() => {
  let counter = 0;
  return () => `mermaid-diagram-${counter++}`;
})();

// Cache for rendered diagrams (key: mermaidCode + theme)
const diagramCache = new Map<string, string>();

const MermaidComponent = memo(
  ({ children, id, mode = 'interactive' }: MermaidProps) => {
    const mermaidRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<string>('');
    const { t } = useTranslation();
    const [showOriginalCode, setShowOriginalCode] = useState(false);
    const [rendered, setRendered] = useState(false);
    const [viewMode, setViewMode] = useState<'code' | 'preview'>('preview');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [zoomImageUrl, setZoomImageUrl] = useState<string>('');

    // Get theme information from the store
    const { isDarkMode } = useThemeStoreShallow((state) => ({
      isDarkMode: state.isDarkMode,
    }));

    const isInteractive = mode === 'interactive';

    // Generate a unique ID for this instance
    const diagramId = useMemo(() => generateUniqueId(), []);

    // Memoize the mermaid code to prevent unnecessary recalculations
    const mermaidCode = useMemo(() => children?.toString().trim() ?? '', [children]);

    // Create a cache key that includes the theme mode
    const cacheKey = useMemo(
      () => `${mermaidCode}_${isDarkMode ? 'dark' : 'light'}`,
      [mermaidCode, isDarkMode],
    );

    // Extract a title for the diagram file name
    const diagramTitle = useMemo(() => {
      const firstLine = mermaidCode.split('\n')[0] || '';
      // Try to extract a meaningful title from the first line
      const titleMatch = firstLine.match(/\s+([a-zA-Z0-9\s]+)$/);
      return (titleMatch?.[1] || 'diagram').trim().replace(/\s+/g, '_').slice(0, 20);
    }, [mermaidCode]);

    // Initialize mermaid with the current theme
    useEffect(() => {
      // Update mermaid config when theme changes
      initializeMermaid(isDarkMode);

      // Re-render the diagram when theme changes
      if (rendered) {
        renderDiagram();
      }
    }, [isDarkMode]);

    // Memoize the render function to maintain referential equality
    const renderDiagram = useCallback(
      debounce(async () => {
        if (!mermaidRef.current) return;

        try {
          // Check cache first with theme-aware key
          const cachedSvg = diagramCache.get(cacheKey);
          if (cachedSvg) {
            mermaidRef.current.innerHTML = cachedSvg;
            svgRef.current = cachedSvg;
            setShowOriginalCode(false);
            setRendered(true);
            return;
          }

          // Clear previous content
          mermaidRef.current.innerHTML = '';

          // Ensure mermaid is initialized with current theme
          initializeMermaid(isDarkMode);

          // Validate mermaid syntax first
          await mermaid.parse(mermaidCode);

          // Generate and render the diagram with unique ID
          const { svg } = await mermaid.render(diagramId, mermaidCode);

          // Cache the result with theme-aware key
          diagramCache.set(cacheKey, svg);
          svgRef.current = svg;

          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = svg;
            setShowOriginalCode(false);
            setRendered(true);
          }
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          setShowOriginalCode(true);
          setRendered(false);
          if (mermaidRef.current) {
            // Show original code in a pre tag with error message
            mermaidRef.current.innerHTML = `
              <div class="text-red-500 text-xs mb-2">${t('components.markdown.mermaidError')}</div>
              <pre class="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                <code>${mermaidCode}</code>
              </pre>
            `;
          }
        }
      }, 300),
      [mermaidCode, t, diagramId, cacheKey, isDarkMode],
    );

    // Toggle between code and preview mode
    const toggleViewMode = useCallback(() => {
      setViewMode((prev) => {
        const newMode = prev === 'code' ? 'preview' : 'code';

        // If switching back to preview, ensure diagram is rendered
        if (newMode === 'preview' && mermaidRef.current) {
          setTimeout(() => {
            renderDiagram();
          }, 0);
        }

        return newMode;
      });
    }, [renderDiagram]);

    // Generate PNG from the rendered SVG
    const generatePng = useCallback(async () => {
      if (!mermaidRef.current) return '';

      try {
        // Find SVG element within the mermaid container
        const svgElement = mermaidRef.current.querySelector('svg') as SVGElement;
        if (!svgElement) return '';

        // Set background based on theme
        const originalBg = svgElement.style.background;
        svgElement.style.background = isDarkMode ? '#1f2937' : 'white';

        // Use domToPng with proper settings for diagrams
        const dataUrl = await domToPng(svgElement, {
          features: {
            removeControlCharacter: false,
          },
          scale: 5, // Higher resolution
          quality: 1,
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
        });

        // Restore original background
        svgElement.style.background = originalBg;

        return dataUrl;
      } catch (error) {
        console.error('Error generating PNG:', error);
        return '';
      }
    }, [isDarkMode]);

    // Copy the diagram to clipboard
    const copyImage = useCallback(async () => {
      const messageKey = 'copyMermaid';
      message.loading({
        content: t('components.markdown.mermaid.copyStarted') ?? 'Starting to copy...',
        key: messageKey,
      });

      try {
        const dataUrl = await generatePng();
        if (!dataUrl) {
          throw new Error('Failed to generate image');
        }

        const res = await fetch(dataUrl);
        const blob = await res.blob();

        // Ensure the blob has the correct MIME type
        const pngBlob = new Blob([blob], { type: 'image/png' });

        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': pngBlob,
          }),
        ]);

        message.success({
          content: t('components.markdown.mermaid.copySuccess') ?? 'Diagram copied to clipboard',
          key: messageKey,
        });
      } catch (error) {
        console.error('Failed to copy image:', error);
        message.error({
          content: t('components.markdown.mermaid.copyError') ?? 'Failed to copy image',
          key: messageKey,
        });
      }
    }, [generatePng, t]);

    // Download the diagram as PNG
    const downloadImage = useCallback(async () => {
      const messageKey = 'downloadMermaid';
      message.loading({
        content: t('components.markdown.mermaid.downloadStarted') ?? 'Starting download...',
        key: messageKey,
      });

      try {
        const dataUrl = await generatePng();
        if (!dataUrl) {
          throw new Error('Failed to generate image');
        }

        // Convert data URL to blob to ensure proper file format
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const pngBlob = new Blob([blob], { type: 'image/png' });
        const blobUrl = URL.createObjectURL(pngBlob);

        const link = document.createElement('a');
        link.download = `${BRANDING_NAME}_mermaid_${diagramTitle}.png`;
        link.href = blobUrl;
        link.click();

        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          link.remove();
        }, 100);

        message.success({
          content:
            t('components.markdown.mermaid.downloadSuccess') ?? 'Diagram downloaded successfully',
          key: messageKey,
        });
      } catch (error) {
        console.error('Failed to download image:', error);
        message.error({
          content: t('components.markdown.mermaid.downloadError') ?? 'Failed to download image',
          key: messageKey,
        });
      }
    }, [generatePng, diagramTitle, t]);

    // Copy the source code to clipboard
    const copySourceCode = useCallback(() => {
      if (!mermaidCode) return;

      const messageKey = 'copySourceCode';
      try {
        copyToClipboard(mermaidCode);
        message.success({
          content:
            t('components.markdown.mermaid.copySourceSuccess') ?? 'Source code copied to clipboard',
          key: messageKey,
        });
      } catch (error) {
        console.error('Failed to copy source code:', error);
        message.error({
          content: t('components.markdown.mermaid.copySourceError') ?? 'Failed to copy source code',
          key: messageKey,
        });
      }
    }, [mermaidCode, t]);

    const createCodeArtifact = useCreateCodeArtifact();

    // Handle creating a mermaid code artifact node
    const handleCreateMermaidArtifact = useCallback(() => {
      if (!mermaidCode) {
        message.error(
          t('components.markdown.mermaid.emptyCode', 'Cannot create empty Mermaid artifact'),
        );
        return;
      }

      if (!isInteractive) {
        return;
      }

      createCodeArtifact({
        codeContent: mermaidCode,
        title: `Mermaid Diagram (${diagramTitle})`,
        language: 'mermaid',
        type: 'application/refly.artifacts.mermaid',
        connectTo: [{ type: 'skillResponse', entityId: id }],
      });
    }, [mermaidCode, diagramTitle, id, t, isInteractive]);

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

    useEffect(() => {
      renderDiagram();
      return () => {
        renderDiagram.cancel();
      };
    }, [renderDiagram]);

    // Memoize the className to prevent inline object creation
    const containerClassName = useMemo(
      () =>
        cn(
          'mermaid-diagram w-full flex justify-center items-center overflow-x-auto relative group pt-8',
          showOriginalCode && 'bg-gray-50 dark:bg-gray-800 rounded',
        ),
      [showOriginalCode],
    );

    return (
      <div className={containerClassName}>
        <div
          ref={mermaidRef}
          className={`w-full flex justify-center ${viewMode === 'code' ? 'hidden' : ''}`}
        />

        {viewMode === 'code' && (
          <pre className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded overflow-x-auto">
            <code className="text-gray-800 dark:text-gray-200">{mermaidCode}</code>
          </pre>
        )}

        {/* Action Buttons - Only show when successfully rendered or in code view */}
        {(rendered || viewMode === 'code') && (
          <div className="absolute top-0 right-2 z-50 flex transition-all duration-200 ease-in-out bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
            <Space>
              {viewMode === 'preview' && (
                <>
                  <Tooltip title={t('common.preview')}>
                    <Button
                      type="text"
                      size="small"
                      className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      icon={
                        <PiMagnifyingGlassPlusBold className="w-4 h-4 flex items-center justify-center" />
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleZoom();
                      }}
                    />
                  </Tooltip>

                  <Tooltip
                    title={t('components.markdown.mermaid.downloadAsPng', 'Download as PNG')}
                  >
                    <Button
                      type="text"
                      size="small"
                      className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      icon={<DownloadIcon className="w-4 h-4 flex items-center justify-center" />}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        downloadImage();
                      }}
                    />
                  </Tooltip>

                  <Tooltip
                    title={t('components.markdown.mermaid.copyToClipboard', 'Copy to clipboard')}
                  >
                    <Button
                      type="text"
                      size="small"
                      className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      icon={<CopyIcon className="w-4 h-4 flex items-center justify-center" />}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        copyImage();
                      }}
                    />
                  </Tooltip>
                </>
              )}

              <Tooltip title={t('components.markdown.mermaid.copySourceCode', 'Copy source code')}>
                <Button
                  type="text"
                  size="small"
                  className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  icon={<CopyOutlined className="w-4 h-4 flex items-center justify-center" />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copySourceCode();
                  }}
                />
              </Tooltip>
              <Tooltip
                title={
                  viewMode === 'code'
                    ? t('components.markdown.viewPreview', 'View preview')
                    : t('components.markdown.viewCode', 'View code')
                }
              >
                <Button
                  type="text"
                  size="small"
                  className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  icon={
                    viewMode === 'code' ? (
                      <EyeOutlined className="w-4 h-4 flex items-center justify-center" />
                    ) : (
                      <CodeOutlined className="w-4 h-4 flex items-center justify-center" />
                    )
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleViewMode();
                  }}
                />
              </Tooltip>
              {isInteractive && (
                <Tooltip
                  title={t('components.markdown.mermaid.createArtifact', 'Create diagram artifact')}
                >
                  <Button
                    type="text"
                    size="small"
                    className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    icon={<IconCodeArtifact className="w-4 h-4 flex items-center justify-center" />}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCreateMermaidArtifact();
                    }}
                  />
                </Tooltip>
              )}
            </Space>
          </div>
        )}
        <ImagePreview
          isPreviewModalVisible={isModalVisible}
          setIsPreviewModalVisible={setIsModalVisible}
          imageUrl={zoomImageUrl}
          imageTitle={`${BRANDING_NAME}_mermaid_${diagramTitle}`}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.children?.toString() === nextProps.children?.toString() &&
      prevProps.mode === nextProps.mode
    );
  },
);

MermaidComponent.displayName = 'MermaidComponent';

export default MermaidComponent;
