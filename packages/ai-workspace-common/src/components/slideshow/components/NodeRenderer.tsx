import { memo, useMemo, CSSProperties, useCallback } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { NodeBlockHeader } from './NodeBlockHeader';
import {
  LazyCodeArtifactRenderer,
  LazyDocumentRenderer,
  LazySkillResponseRenderer,
  LazyImageRenderer,
  WithSuspense,
  LazyMemoRenderer,
  LazyResourceRenderer,
  LazyWebsiteRenderer,
  LazyVideoRenderer,
} from './LazyComponents';
import { useTranslation } from 'react-i18next';
import { Tooltip, Button } from 'antd';
import { DownloadIcon } from 'lucide-react';
import {
  downloadNodeData,
  hasDownloadableData,
  copyNodeData,
  hasCopyableData,
  shareNodeData,
  hasShareableData,
  type NodeData,
} from '@refly-packages/ai-workspace-common/utils/download-node-data';
import { Share } from 'refly-icons';
import { logEvent } from '@refly/telemetry-web';

// Create a generic content container component to reduce code duplication
const ContentContainer = ({
  children,
  isFullscreen = false,
  isFocused = false,
  isMinimap = false,
  isModal = false,
}: {
  children: React.ReactNode;
  isFullscreen?: boolean;
  isFocused?: boolean;
  isMinimap?: boolean;
  isModal?: boolean;
}) => {
  // Content container style
  const contentStyle: CSSProperties = {
    overflow: 'auto',
    flex: 1,
    height: isFullscreen ? '100%' : undefined,
    position: 'relative',
  };

  // Overlay style
  const overlayStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    background: 'transparent',
    cursor: 'pointer',
  };

  return (
    <div style={contentStyle}>
      {children}

      {/* Transparent overlay to prevent scrolling when not focused */}
      {!isFocused && !isFullscreen && !isMinimap && !isModal && <div style={overlayStyle} />}
    </div>
  );
};

// Content renderer component
const NodeRenderer = memo(
  ({
    node,
    isFullscreen = false,
    isModal = false,
    isMinimap = false,
    isFocused = false,
    fromProducts = false,
    onDelete,
    onStartSlideshow,
    onWideMode,
  }: {
    node: NodeRelation;
    isFullscreen?: boolean;
    isModal?: boolean;
    isMinimap?: boolean;
    isFocused?: boolean;
    fromProducts?: boolean;
    onDelete?: (nodeId: string) => void;
    onStartSlideshow?: (nodeId: string) => void;
    onWideMode?: (nodeId: string) => void;
  }) => {
    const { t } = useTranslation();

    // Check if node has downloadable data
    const nodeData: NodeData = useMemo(
      () => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        entityId: node.entityId,
        title: node.nodeData?.title,
        metadata: node.nodeData?.metadata,
      }),
      [node],
    );

    const canDownload = useMemo(() => hasDownloadableData(nodeData), [nodeData]);
    const canCopy = useMemo(() => hasCopyableData(nodeData), [nodeData]);
    const canShare = useMemo(() => hasShareableData(nodeData), [nodeData]);

    // Handle download for any node type
    const handleDownload = useCallback(async () => {
      if (fromProducts) {
        logEvent('download_template_result', null, {
          nodeId: nodeData.nodeId,
          nodeType: nodeData.nodeType,
          title: nodeData.title,
        });
      }
      await downloadNodeData(nodeData, t);
    }, [nodeData, t, fromProducts]);

    // Handle copy for any node type
    const handleCopy = useCallback(async () => {
      if (fromProducts) {
        logEvent('copy_template_result', null, {
          nodeId: nodeData.nodeId,
          nodeType: nodeData.nodeType,
          title: nodeData.title,
        });
      }
      await copyNodeData(nodeData, t);
    }, [nodeData, t, fromProducts]);

    // Handle share for any node type
    const handleShare = useCallback(async () => {
      if (fromProducts) {
        logEvent('share_template_result', null, {
          nodeId: nodeData.nodeId,
          nodeType: nodeData.nodeType,
          title: nodeData.title,
        });
      }
      await shareNodeData(nodeData, t);
    }, [nodeData, t, fromProducts]);

    // Generic node block header
    const renderNodeHeader =
      !isFullscreen && !isModal ? (
        <NodeBlockHeader
          isFullscreen={isFullscreen}
          isModal={isModal}
          node={node}
          isMinimap={isMinimap}
          onMaximize={onStartSlideshow && (() => onStartSlideshow?.(node.nodeId))}
          onWideMode={onWideMode && (() => onWideMode?.(node.nodeId))}
          onDelete={onDelete}
          rightActions={
            <div className="flex items-center gap-1">
              {canDownload && (
                <Tooltip title={t('canvas.nodeActions.download', 'Download')}>
                  <Button
                    type="text"
                    className="flex items-center justify-center border-none bg-white/70 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-700/80 hover:text-blue-600 dark:hover:text-blue-400 text-gray-700 dark:text-gray-300"
                    icon={<DownloadIcon size={16} />}
                    onClick={handleDownload}
                  >
                    {/* <span className="sr-only" /> */}
                  </Button>
                </Tooltip>
              )}
              {canShare && (
                <Tooltip title={t('canvas.nodeActions.share', 'Share')}>
                  <Button
                    type="text"
                    className="flex items-center justify-center border-none bg-white/70 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-700/80 hover:text-blue-600 dark:hover:text-blue-400 text-gray-700 dark:text-gray-300"
                    icon={<Share size={16} />}
                    onClick={handleShare}
                  >
                    {/* <span className="sr-only" /> */}
                  </Button>
                </Tooltip>
              )}
            </div>
          }
        />
      ) : null;

    // Use useMemo to cache rendered content, avoiding unnecessary recalculations
    const renderContent = useMemo(() => {
      // Return appropriate renderer based on node type
      switch (node.nodeType) {
        case 'codeArtifact':
          return (
            <div className="flex flex-col h-full">
              {renderNodeHeader}
              <ContentContainer
                isFullscreen={isFullscreen}
                isFocused={isFocused}
                isMinimap={isMinimap}
                isModal={isModal}
              >
                <WithSuspense>
                  <LazyCodeArtifactRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </ContentContainer>
            </div>
          );
        case 'document':
          return (
            <div className="flex flex-col h-full">
              {renderNodeHeader}
              <ContentContainer
                isFullscreen={isFullscreen}
                isFocused={isFocused}
                isMinimap={isMinimap}
                isModal={isModal}
              >
                <WithSuspense>
                  <LazyDocumentRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </ContentContainer>
            </div>
          );
        case 'skillResponse':
          return (
            <div className="flex flex-col h-full">
              {renderNodeHeader}
              <ContentContainer
                isFullscreen={isFullscreen}
                isFocused={isFocused}
                isMinimap={isMinimap}
                isModal={isModal}
              >
                <WithSuspense>
                  <LazySkillResponseRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </ContentContainer>
            </div>
          );
        case 'image':
          return (
            <div className="flex flex-col h-full">
              {renderNodeHeader}
              <ContentContainer
                isFullscreen={isFullscreen}
                isFocused={isFocused}
                isMinimap={isMinimap}
                isModal={isModal}
              >
                <WithSuspense>
                  <LazyImageRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </ContentContainer>
            </div>
          );
        case 'video':
          return (
            <div className="flex flex-col h-full">
              {renderNodeHeader}
              <ContentContainer
                isFullscreen={isFullscreen}
                isFocused={isFocused}
                isMinimap={isMinimap}
                isModal={isModal}
              >
                <WithSuspense>
                  <LazyVideoRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </ContentContainer>
            </div>
          );
        case 'memo':
          return (
            <div className="flex flex-col h-full">
              {renderNodeHeader}
              <ContentContainer
                isFullscreen={isFullscreen}
                isFocused={isFocused}
                isMinimap={isMinimap}
                isModal={isModal}
              >
                <WithSuspense>
                  <LazyMemoRenderer node={node} isFullscreen={isFullscreen} isMinimap={isMinimap} />
                </WithSuspense>
              </ContentContainer>
            </div>
          );
        case 'resource':
          return (
            <div className="flex flex-col h-full">
              {renderNodeHeader}
              <ContentContainer
                isFullscreen={isFullscreen}
                isFocused={isFocused}
                isMinimap={isMinimap}
                isModal={isModal}
              >
                <WithSuspense>
                  <LazyResourceRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </ContentContainer>
            </div>
          );
        case 'website':
          return (
            <div className="flex flex-col h-full">
              {renderNodeHeader}
              <ContentContainer
                isFullscreen={isFullscreen}
                isFocused={isFocused}
                isMinimap={isMinimap}
                isModal={isModal}
              >
                <WithSuspense>
                  <LazyWebsiteRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </ContentContainer>
            </div>
          );
        default:
          // Display message for unsupported types
          return (
            <div
              className={`p-6 bg-white rounded-lg flex flex-col items-center justify-center text-gray-400 ${
                !isFullscreen ? 'h-[400px]' : 'h-full'
              } shadow-refly-m ${isMinimap ? 'p-2 h-full' : ''}`}
            >
              <div className={`${isMinimap ? 'text-xs' : 'text-lg'}`}>
                {isMinimap
                  ? t('pages.components.nodeRenderer.unsupportedComponent')
                  : t('pages.components.nodeRenderer.onlyCodeComponentSupported')}
              </div>
              {!isMinimap && <div className="text-sm text-gray-400 mt-2">{node.nodeType}</div>}
            </div>
          );
      }
    }, [
      node,
      isFullscreen,
      isModal,
      isMinimap,
      isFocused,
      onDelete,
      onStartSlideshow,
      onWideMode,
      t,
      renderNodeHeader,
      canDownload,
      canCopy,
      canShare,
      handleDownload,
      handleCopy,
      handleShare,
    ]);

    return renderContent;
  },
  // Custom comparison function, only re-render when key properties change
  (prevProps, nextProps) => {
    // Check if key properties have changed
    return (
      prevProps.node.nodeId === nextProps.node.nodeId &&
      prevProps.node.nodeType === nextProps.node.nodeType &&
      prevProps.isFullscreen === nextProps.isFullscreen &&
      prevProps.isModal === nextProps.isModal &&
      prevProps.isMinimap === nextProps.isMinimap &&
      prevProps.isFocused === nextProps.isFocused
    );
  },
);

export { NodeRenderer };
