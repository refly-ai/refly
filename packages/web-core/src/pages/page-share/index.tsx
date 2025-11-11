import { useParams } from 'react-router-dom';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spin, Button, Modal } from 'antd';
import { FileTextOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import '@refly-packages/ai-workspace-common/components/slideshow/styles/preview-mode.css';

// Import abstract components and hooks
import { NodeRenderer } from '@refly-packages/ai-workspace-common/components/slideshow/components/NodeRenderer';
import { type NodeRelation } from '@refly-packages/ai-workspace-common/components/slideshow/components/ArtifactRenderer';
import PageLayout from '@refly-packages/ai-workspace-common/components/slideshow/components/PageLayout';
import PreviewMode from '@refly-packages/ai-workspace-common/components/slideshow/components/PreviewMode';
import { usePreviewUI } from '@refly-packages/ai-workspace-common/components/slideshow/hooks/usePreviewUI';
import { useSlideshow } from '@refly-packages/ai-workspace-common/components/slideshow/hooks/useSlideshow';
import { getNodeTitle } from '@refly-packages/ai-workspace-common/components/slideshow/utils/nodeUtils';
import { useCardScroll } from '@refly-packages/ai-workspace-common/components/slideshow/hooks/useCardScroll';

const SharePage = () => {
  const { shareId = '' } = useParams();
  const { t } = useTranslation();

  const { data: shareData, loading: isLoading } = useFetchShareData(shareId);

  // Regular mode and preview mode related states
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [wideMode, setWideMode] = useState<{ isActive: boolean; nodeId: string | null }>({
    isActive: false,
    nodeId: null,
  });

  // Use the card scroll hook for managing card interaction
  const { activeCardId, handleCardClick } = useCardScroll();

  // Extract page data and node relations
  const pageData = useMemo(() => {
    if (!shareData) return null;
    return {
      page: shareData.page,
      content: shareData.content,
      nodeRelations: shareData.nodeRelations || [],
      pageConfig: shareData.pageConfig,
      shareInfo: shareData.shareInfo,
      isOwner: shareData.isOwner,
    };
  }, [shareData]);

  // Node data
  const nodes = useMemo<NodeRelation[]>(() => {
    if (!pageData?.nodeRelations) return [];
    return pageData.nodeRelations;
  }, [pageData?.nodeRelations]);

  // Set the initial card as scrollable when nodes are loaded
  useEffect(() => {
    if (nodes.length > 0) {
      // Activate the first card for scrolling by default
      handleCardClick('content-block-0');
    }
  }, [nodes, handleCardClick]);

  // Use abstract UI state management hook
  const {
    uiState,
    showPreviewMinimap,
    handleUiInteraction,
    handlePreviewMouseMove,
    handleMinimapMouseEnter,
    handleMinimapMouseLeave,
    handleSideHintClick,
  } = usePreviewUI({
    isPreviewMode,
  });

  // Use abstract slideshow preview hook
  const {
    currentSlideIndex,
    nextSlide,
    prevSlide,
    handlePreviewSlideSelect,
    previewContentRef,
    resetSlideIndex,
    setCurrentSlideIndex,
  } = useSlideshow({
    nodes,
    isPreviewMode,
    handleUiInteraction,
  });

  // Toggle preview mode
  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode((prev) => {
      if (!prev) {
        // Reset slideshow index when entering preview mode
        resetSlideIndex();
      }
      return !prev;
    });
  }, [resetSlideIndex]);

  // Toggle minimap
  const toggleMinimap = useCallback(() => setShowMinimap(!showMinimap), [showMinimap]);

  // Handle node selection
  const handleNodeSelect = useCallback(
    (index: number) => {
      setActiveNodeIndex(index);

      // Scroll to the corresponding content block
      const element = document.getElementById(`content-block-${index}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Also enable scrolling for this card
        handleCardClick(`content-block-${index}`);
      }
    },
    [handleCardClick],
  );

  // Handle starting a slideshow from a specific node
  const handleStartSlideshow = useCallback(
    (nodeId: string) => {
      // Find the index of the clicked node
      const nodeIndex = nodes.findIndex((node) => node.nodeId === nodeId);
      if (nodeIndex !== -1) {
        // Set the current slideshow index to the found node index
        setCurrentSlideIndex?.(nodeIndex);
        // Open preview mode
        setIsPreviewMode(true);
      }
    },
    [nodes, setCurrentSlideIndex],
  );

  // Handle wide mode
  const handleWideMode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.nodeId === nodeId);
      if (node) {
        setWideMode({ isActive: true, nodeId });
      }
    },
    [nodes],
  );

  // Close wide mode
  const handleCloseWideMode = useCallback(() => {
    setWideMode({ isActive: false, nodeId: null });
  }, []);

  // Wide mode keyboard shortcut
  useEffect(() => {
    if (!wideMode.isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseWideMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wideMode.isActive, handleCloseWideMode]);

  // Add Escape key to exit slideshow preview mode
  useEffect(() => {
    if (!isPreviewMode) return;

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        togglePreviewMode();
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isPreviewMode, togglePreviewMode]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[var(--screen-height)]">
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  // Data loading failed or invalid share link
  if (!shareData || !pageData?.page) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-2xl font-medium mb-4 text-gray-700">
          {t('pages.share.invalidShareLink')}
        </div>
        <div className="text-gray-500">{t('pages.share.expiredShareLink')}</div>
      </div>
    );
  }

  // Preview mode rendering
  if (isPreviewMode) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <div className="bg-black h-full w-full flex flex-col">
          <PreviewMode
            nodes={nodes}
            currentSlideIndex={currentSlideIndex}
            showPreviewMinimap={showPreviewMinimap}
            uiState={uiState}
            title={pageData?.page?.title || t('common.untitled')}
            onNext={nextSlide}
            onPrev={prevSlide}
            onClose={togglePreviewMode}
            onMouseMove={handlePreviewMouseMove}
            onSideHintClick={handleSideHintClick}
            onUiInteraction={handleUiInteraction}
            onPreviewSlideSelect={handlePreviewSlideSelect}
            onMinimapMouseEnter={handleMinimapMouseEnter}
            onMinimapMouseLeave={handleMinimapMouseLeave}
            getNodeTitle={getNodeTitle}
            previewContentRef={previewContentRef}
          />
        </div>
      </div>
    );
  }

  // Regular mode rendering - using abstract PageLayout component
  return (
    <>
      <PageLayout
        showMinimap={showMinimap}
        nodes={nodes}
        activeNodeIndex={activeNodeIndex}
        onNodeSelect={handleNodeSelect}
        toggleMinimap={toggleMinimap}
        readonly={true}
        headerContent={
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center">
              <div className="text-xl font-semibold text-gray-800 dark:text-gray-200 mr-2">
                {pageData?.page?.title || t('common.untitled')}
              </div>
              {pageData?.shareInfo && (
                <div className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  {t('pages.share.sharedAt')}:{' '}
                  {new Date(pageData.shareInfo.sharedAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex items-center">
              {nodes.length > 0 && (
                <Button
                  type="text"
                  onClick={togglePreviewMode}
                  icon={<PlayCircleOutlined />}
                  className="flex items-center mx-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  {t('pages.share.slideshow')}
                </Button>
              )}
            </div>
          </div>
        }
      >
        {/* Page description area */}
        {pageData?.page?.description && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
            <div className="text-gray-700 text-base">{pageData.page.description}</div>
          </div>
        )}

        {/* Content modules */}
        {nodes.length > 0 ? (
          <div className="space-y-6">
            {nodes.map((node, index) => {
              // Add debug output
              console.log(
                `Card ${index}: activeCardId=${activeCardId}, compare=${activeCardId === `content-block-${index}`}`,
              );

              return (
                <div
                  key={node.relationId || `content-${index}`}
                  id={`content-block-${index}`}
                  onClick={(e) => {
                    // Prevent event propagation to document
                    e.stopPropagation();
                    setActiveNodeIndex(index);
                    // Add debug output
                    console.log(
                      `Clicking card ${index}, setting activeCardId to content-block-${index}`,
                    );
                    // Enable scrolling for this specific card
                    handleCardClick(`content-block-${index}`);
                  }}
                  className={`transition-all duration-300 h-[400px] rounded-lg bg-white dark:bg-gray-900 ${
                    activeNodeIndex === index
                      ? 'shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_30px_rgba(255,255,255,0.15)] transform -translate-y-1 border border-blue-400'
                      : 'shadow-refly-m hover:shadow-lg dark:hover:shadow-gray-600'
                  }`}
                >
                  <NodeRenderer
                    node={node}
                    onStartSlideshow={handleStartSlideshow}
                    onWideMode={handleWideMode}
                    isFocused={activeCardId === `content-block-${index}`}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300 shadow-sm">
            <div className="text-6xl text-gray-300 mb-6">
              <FileTextOutlined />
            </div>
            <h3 className="text-xl font-medium text-gray-500 mb-3">{t('common.noContent')}</h3>
            <p className="text-gray-400 mb-6">{t('common.noContentDesc')}</p>
          </div>
        )}

        <div className="h-24" />
      </PageLayout>

      {/* Wide mode modal */}
      {wideMode.isActive && (
        <Modal
          open={wideMode.isActive}
          footer={null}
          onCancel={handleCloseWideMode}
          width="85%"
          style={{ top: 20 }}
          styles={{
            body: {
              maxHeight: 'calc(var(--screen-height) - 100px)',
              padding: 0,
              overflow: 'hidden',
            },
            mask: {
              background: 'rgba(0, 0, 0, 0.65)',
            },
          }}
          className="wide-mode-modal"
          closeIcon={<CloseCircleOutlined className="text-gray-500 hover:text-red-500" />}
        >
          <div className="bg-white h-full w-full flex flex-col rounded-lg overflow-hidden">
            {/* Wide mode content */}
            <div className="flex-1 overflow-auto">
              {wideMode.nodeId && nodes.find((n) => n.nodeId === wideMode.nodeId) ? (
                <div className="h-[calc(var(--screen-height)-160px)]">
                  <NodeRenderer
                    node={nodes.find((n) => n.nodeId === wideMode.nodeId)!}
                    isFullscreen={false}
                    isModal={true}
                    isMinimap={false}
                    isFocused={true}
                    onStartSlideshow={handleStartSlideshow}
                    onWideMode={handleWideMode}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">{t('common.wideModeLoadFailed')}</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default SharePage;
