import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Spin, message, Modal, Select, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useGetPageDetail,
  useUpdatePage,
  useDeletePageNode,
  useSharePage,
} from '@refly-packages/ai-workspace-common/queries/queries';
import {
  ArrowLeftOutlined,
  ShareAltOutlined,
  CopyOutlined,
  GlobalOutlined,
  UserOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { NodeRenderer } from './components/NodeRenderer';
import { type NodeRelation } from './components/ArtifactRenderer';
import './styles/preview-mode.css';

// Import abstract components and hooks
import PageLayout from './components/PageLayout';
import PreviewMode from './components/PreviewMode';
import { usePreviewUI } from './hooks/usePreviewUI';
import { useSlideshow } from './hooks/useSlideshow';
import { getNodeTitle } from './utils/nodeUtils';
import { slideshowEmitter } from '@refly-packages/ai-workspace-common/events/slideshow';
import EmptyContentPrompt from './components/EmptyContentPrompt';
import { useCardScroll } from './hooks/useCardScroll';

interface PageDetailType {
  pageId: string;
  title: string;
  description: string | null;
  status: string;
  canvasId: string;
  createdAt: string;
  updatedAt: string;
  nodeRelations: NodeRelation[];
  pageConfig: {
    layout: string;
    theme: string;
  };
}

interface PageEditProps {
  source: 'slideshow' | 'page';
  pageId?: string;
  showMinimap: boolean;
  minimalMode?: boolean;
  setShowMinimap: (show: boolean) => void;
}

export function SlideshowEdit(props: PageEditProps) {
  const { pageId, showMinimap, setShowMinimap, source, minimalMode = false } = props;
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const [_formChanged, setFormChanged] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [nodesList, setNodes] = useState<NodeRelation[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [_isDeletingNode, setIsDeletingNode] = useState(false);
  const [wideMode, setWideMode] = useState<{ isActive: boolean; nodeId: string | null }>({
    isActive: false,
    nodeId: null,
  });

  // Use the card scroll hook for managing card interaction
  const { activeCardId, handleCardClick } = useCardScroll();

  // Share related states
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareOption, setShareOption] = useState<'internet' | 'notEnabled'>('internet');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Empty content modal state
  const [emptyContentModalVisible, setEmptyContentModalVisible] = useState(false);

  // Get sidebar state
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  // Force hide sidebar by default
  useEffect(() => {
    setCollapse(true);
  }, [setCollapse]);

  // Use abstract UI state management hook
  const {
    uiState,
    showPreviewMinimap,
    handleUiInteraction,
    handlePreviewMouseMove,
    handleMinimapMouseEnter,
    handleMinimapMouseLeave,
    handleSideHintClick,
  } = usePreviewUI({ isPreviewMode });

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
    nodes: nodesList,
    isPreviewMode,
    handleUiInteraction,
  });

  // UI interaction handling methods
  const toggleSidebar = useCallback(() => setCollapse(!collapse), [collapse, setCollapse]);

  const toggleMinimap = useCallback(() => {
    setShowMinimap(!showMinimap);
  }, [showMinimap, setShowMinimap]);

  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(!isPreviewMode);
    if (!isPreviewMode) {
      resetSlideIndex();
    }
  }, [isPreviewMode, resetSlideIndex]);

  // Get page details
  const {
    data: pageDetailResponse,
    isLoading: isLoadingPage,
    error: pageLoadError,
    refetch: refetchPageDetail,
  } = useGetPageDetail({ path: { pageId: pageId || '' } }, undefined, {
    enabled: !!pageId,
  });

  // Update page hook
  const { mutate: updatePage, isPending: isUpdating } = useUpdatePage();

  // Share page hook
  const { mutate: sharePage } = useSharePage();

  // Extract page data from response
  const pageDetail = pageDetailResponse?.data as PageDetailType | undefined;

  // Get node data
  const nodes = useMemo<NodeRelation[]>(() => {
    if (!pageDetail?.nodeRelations) return [];

    // Note: Originally had filtering logic, but it doesn't filter anything (node.nodeType === "codeArtifact" || 1)
    return pageDetail.nodeRelations.map((node) => ({
      ...node,
    }));
  }, [pageDetail?.nodeRelations]);

  // Update local state when page data is loaded
  useEffect(() => {
    if (pageDetail) {
      form.setFieldsValue({
        title: pageDetail.title,
        description: pageDetail.description,
      });
      setNodes(nodes);
      setFormChanged(false);
    }
  }, [form, pageDetail, nodes]);

  // Prepare node relations with updated order
  const prepareNodeRelations = useCallback((nodes: NodeRelation[]) => {
    return nodes.map((node, index) => ({
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      entityId: node.entityId,
      nodeData: node.nodeData,
      orderIndex: index,
    }));
  }, []);

  // Update page API call
  const updatePageApi = useCallback(
    (title: string, description: string | undefined, nodeRelations: NodeRelation[]) => {
      if (!pageId) return;

      // Convert NodeRelation to NodeRelationDto format
      const nodeRelationsDto = nodeRelations.map((node, index) => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        entityId: node.entityId,
        nodeData: node.nodeData,
        orderIndex: index,
      }));

      updatePage(
        {
          path: { pageId },
          body: {
            title,
            description,
            nodeRelations: nodeRelationsDto,
          },
        },
        {
          onSuccess: () => {
            message.success(t('pages.edit.saveSuccess'));
          },
          onError: (error) => {
            console.error('Failed to update page:', error);
            message.error(t('pages.edit.saveFailed'));
          },
        },
      );
    },
    [pageId, updatePage, t],
  );

  // Form submission handler
  const handleSubmit = useCallback(
    (values: any) => {
      if (!pageId) return;

      const { title, description } = values;

      const nodeRelations = prepareNodeRelations(nodesList);

      setFormChanged(false);

      updatePageApi(title, description, nodeRelations);
    },
    [pageId, nodesList, prepareNodeRelations, updatePageApi],
  );

  // Form and navigation handling
  const handleBack = useCallback(() => navigate('/pages'), [navigate]);
  const handleFormChange = useCallback(() => setFormChanged(true), []);

  // Handle node selection
  const handleNodeSelect = useCallback(
    (index: number) => {
      if (index >= 0 && index < nodesList.length) {
        setActiveNodeIndex(index);
        if (isPreviewMode) {
          setCurrentSlideIndex(index);
        } else {
          // Scroll to the corresponding content block
          const element = document.getElementById(`content-block-${index}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Enable scrolling for this card
            handleCardClick(`content-block-${index}`);
          }
        }
      }
    },
    [nodesList.length, isPreviewMode, setCurrentSlideIndex, handleCardClick],
  );

  // Handle node reordering
  const handleReorderNodes = useCallback(
    (newOrder: NodeRelation[]) => {
      setNodes(newOrder);
      setFormChanged(true);

      if (pageId) {
        const { title, description } = form.getFieldsValue();
        // Immediately call API to update node order
        updatePage(
          {
            path: { pageId },
            body: {
              title,
              description,
              nodeRelations: newOrder.map((node, index) => ({
                nodeId: node.nodeId,
                nodeType: node.nodeType,
                entityId: node.entityId,
                nodeData: node.nodeData,
                orderIndex: index,
              })),
            },
          },
          {
            onSuccess: () => {
              message.success(t('pages.edit.saveSuccess'));
            },
            onError: (error) => {
              console.error('Failed to reorder nodes:', error);
              message.error(t('pages.edit.saveFailed'));
            },
          },
        );
      }
    },
    [form, pageId, updatePage, t],
  );

  // Handle deleting a node
  const deletePageNodeMutation = useDeletePageNode();

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!pageId) return;

      try {
        setIsDeletingNode(true);

        // Use useDeletePageNode to delete the node
        await deletePageNodeMutation.mutateAsync({
          path: {
            pageId,
            nodeId,
          },
        });

        // Remove the node from local state
        setNodes((prevNodes) => prevNodes.filter((node) => node.nodeId !== nodeId));

        // If the deleted node is the currently selected node, select the first node
        if (nodesList[activeNodeIndex]?.nodeId === nodeId) {
          setActiveNodeIndex(0);
        }

        message.success(t('common.deleteSuccess'));
        setFormChanged(true);
      } catch (error) {
        console.error('Failed to delete node:', error);
        message.error(t('common.deleteFailed'));
      } finally {
        setIsDeletingNode(false);
      }
    },
    [pageId, activeNodeIndex, nodesList, deletePageNodeMutation],
  );

  // Handle starting a slideshow from a specific node
  const handleStartSlideshow = useCallback(
    (nodeId: string) => {
      // Find the index of the clicked node
      const nodeIndex = nodesList.findIndex((node) => node.nodeId === nodeId);
      if (nodeIndex !== -1) {
        // Set the current slideshow index to the found node index
        setCurrentSlideIndex(nodeIndex);
        // Open preview mode
        setIsPreviewMode(true);
      }
    },
    [nodesList, setCurrentSlideIndex],
  );

  // Handle wide mode
  const handleWideMode = useCallback(
    (nodeId: string) => {
      const node = nodesList.find((n) => n.nodeId === nodeId);
      if (node) {
        setWideMode({ isActive: true, nodeId });
      }
    },
    [nodesList],
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

  useEffect(() => {
    const handleUpdate = (data: { canvasId: string; pageId: string; entityId: string }) => {
      if (data.pageId === pageId) {
        refetchPageDetail().then(({ data: pageDetailResponse }) => {
          const detail = pageDetailResponse?.data as PageDetailType;
          const nodeRelations = detail?.nodeRelations || [];

          // After refetching, scroll to the interacted node
          setTimeout(() => {
            const index = nodeRelations.findIndex((node) => node.entityId === data.entityId);
            const showNodeElement = document.querySelector(
              index >= 0 ? `[id^="content-block-${index}"]` : '[id^="content-block-"]:last-child',
            );
            showNodeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        });
      }
    };

    slideshowEmitter.on('update', handleUpdate);

    return () => {
      slideshowEmitter.off('update', handleUpdate);
    };
  }, [pageId, refetchPageDetail]);

  // Handle sharing a page
  const handleShare = useCallback(() => {
    setShareModalVisible(true);
  }, []);

  // Execute share operation
  const handleShareSubmit = useCallback(() => {
    if (!pageId) return;

    setIsSharing(true);

    sharePage(
      { path: { pageId } },
      {
        onSuccess: (response) => {
          const shareData = response?.data?.data;
          if (shareData?.shareId) {
            // Construct share URL in frontend to decouple from backend
            // Use environment variable or fallback to current origin
            const baseUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin;
            const shareUrl = `${baseUrl}/share/pages/${shareData.shareId}`;
            setShareUrl(shareUrl);

            // Try to copy to clipboard automatically using Clipboard API
            try {
              navigator.clipboard.writeText(shareUrl).then(
                () => {
                  setIsCopied(true);
                  message.success(t('common.copy.success'));
                  setTimeout(() => setIsCopied(false), 3000);
                },
                () => {
                  console.error('Failed to copy to clipboard');
                },
              );
            } catch (error) {
              console.error('Clipboard API not available:', error);
            }
          } else {
            setIsSharing(false);
            message.error(t('common.shareFailed'));
          }
        },
        onError: () => {
          setIsSharing(false);
          message.error(t('common.shareFailed'));
        },
      },
    );
  }, [pageId, sharePage, t]);

  // Copy share link
  const handleCopyShareUrl = useCallback(() => {
    if (!shareUrl) return;

    navigator.clipboard.writeText(shareUrl).then(
      () => {
        setIsCopied(true);
        message.success(t('common.copy.success'));
        setTimeout(() => setIsCopied(false), 3000);
      },
      () => {
        message.error(t('common.copyFailed'));
      },
    );
  }, [shareUrl, t]);

  // Close share modal
  const handleCloseShareModal = useCallback(() => {
    setShareModalVisible(false);
  }, []);

  // Handle empty content modal
  const handleOpenEmptyContentModal = useCallback(() => {
    setEmptyContentModalVisible(true);
  }, []);

  const handleCloseEmptyContentModal = useCallback(() => {
    setEmptyContentModalVisible(false);
  }, []);

  // Handle adding new node
  const handleAddNode = useCallback(() => {
    setEmptyContentModalVisible(true);
  }, []);

  // Render page content
  const renderPageContent = useMemo(() => {
    if (isLoadingPage) {
      return (
        <div className="flex items-center justify-center py-20">
          <Spin size="large" tip={t('common.loading')} />
        </div>
      );
    }

    if (pageLoadError) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-all shadow-sm hover:shadow-md dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-950">
          <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-950 mb-4">
            <FileTextOutlined style={{ fontSize: '28px', color: '#bfbfbf' }} />
          </div>
          <p className="text-gray-500 font-medium">{t('common.emptyContent', 'No content')}</p>
        </div>
      );
    }

    if (!pageDetail) {
      return (
        <div
          className="flex flex-col items-center justify-center h-[400px] bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-all shadow-sm hover:shadow-md dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-950"
          onClick={handleOpenEmptyContentModal}
        >
          <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-950 mb-4">
            <FileTextOutlined style={{ fontSize: '28px', color: '#bfbfbf' }} />
          </div>
          <p className="text-gray-500 font-medium dark:text-gray-400">
            {t('common.emptyContent', 'No content')}
          </p>
          <p className="text-gray-400 text-sm mt-1 dark:text-gray-500">
            {t('common.clickToAdd', 'Click to add')}
          </p>
        </div>
      );
    }

    if (isPreviewMode) {
      return (
        <PreviewMode
          nodes={nodesList}
          currentSlideIndex={currentSlideIndex}
          showPreviewMinimap={showPreviewMinimap}
          uiState={uiState}
          title={form.getFieldValue('title')}
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
      );
    }

    return (
      <div>
        {/* Content section - using virtualized list for optimization */}
        {nodesList.length > 0 ? (
          <div className="space-y-6">
            {nodesList.map((node, index) => (
              <div
                key={node.relationId || `content-${index}`}
                id={`content-block-${index}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveNodeIndex(index);
                  // Use content-block-ID for consistency
                  handleCardClick(`content-block-${index}`);
                }}
                className={`transition-all duration-300 h-[400px] rounded-lg bg-white dark:bg-gray-900 ${
                  activeNodeIndex === index
                    ? 'shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_30px_rgba(255,255,255,0.15)] transform -translate-y-1'
                    : 'shadow-md hover:shadow-lg dark:shadow-md dark:shadow-gray-950 dark:hover:shadow-lg dark:hover:shadow-gray-950'
                }`}
              >
                <NodeRenderer
                  onDelete={handleDeleteNode}
                  onStartSlideshow={handleStartSlideshow}
                  onWideMode={handleWideMode}
                  node={node}
                  isFocused={activeCardId === `content-block-${index}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center h-[400px] bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-all shadow-sm hover:shadow-md  dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-950"
            onClick={handleOpenEmptyContentModal}
          >
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-950 mb-4">
              <FileTextOutlined style={{ fontSize: '28px', color: '#bfbfbf' }} />
            </div>
            <p className="text-gray-500 font-medium dark:text-gray-400">
              {t('common.emptyContent', 'No content')}
            </p>
            <p className="text-gray-400 text-sm mt-1 dark:text-gray-500">
              {t('common.clickToAdd', 'Click to add')}
            </p>
          </div>
        )}
      </div>
    );
  }, [
    isLoadingPage,
    pageLoadError,
    pageDetail,
    isPreviewMode,
    nodesList,
    currentSlideIndex,
    nextSlide,
    prevSlide,
    togglePreviewMode,
    handlePreviewMouseMove,
    uiState,
    showPreviewMinimap,
    handleMinimapMouseEnter,
    handleMinimapMouseLeave,
    handlePreviewSlideSelect,
    handleSideHintClick,
    previewContentRef,
    form,
    handleSubmit,
    handleFormChange,
    handleBack,
    handleShare,
    isUpdating,
    activeNodeIndex,
    handleNodeSelect,
    handleDeleteNode,
    handleStartSlideshow,
    navigate,
    handleOpenEmptyContentModal,
    activeCardId,
    handleCardClick,
    t,
  ]);

  // Loading state
  if (isLoadingPage) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  // Preview mode rendering
  if (isPreviewMode) {
    return (
      <Modal
        open={isPreviewMode}
        footer={null}
        closable={false}
        onCancel={togglePreviewMode}
        width="100%"
        style={{ top: 0, padding: 0, maxWidth: '100vw' }}
        bodyStyle={{ height: '100vh', padding: 0, overflow: 'hidden' }}
        className="preview-modal"
        maskStyle={{ background: 'rgba(0, 0, 0, 0.85)' }}
        wrapClassName="preview-modal-wrap"
      >
        <div className="bg-black h-full w-full flex flex-col">
          {/* Use abstract PreviewMode component */}
          <PreviewMode
            nodes={nodesList}
            currentSlideIndex={currentSlideIndex}
            showPreviewMinimap={showPreviewMinimap}
            uiState={uiState}
            title={form.getFieldValue('title')}
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
      </Modal>
    );
  }

  return (
    <PageLayout
      source={source}
      showMinimap={showMinimap}
      collapse={collapse}
      nodes={nodesList}
      activeNodeIndex={activeNodeIndex}
      onNodeSelect={handleNodeSelect}
      onReorderNodes={handleReorderNodes}
      toggleMinimap={toggleMinimap}
      toggleSidebar={toggleSidebar}
      headerContent={
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center flex-1 min-w-0">
            {source === 'page' && (
              <Button
                onClick={handleBack}
                icon={<ArrowLeftOutlined />}
                type="text"
                className="mr-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex-shrink-0 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
              />
            )}

            <div className="text-xl font-semibold text-gray-800 mr-2 truncate dark:text-gray-100">
              {pageDetail?.title || t('common.untitled')}
            </div>
          </div>

          <div className="flex items-center flex-shrink-0 ml-2">
            <Tooltip title={t('common.addNode')}>
              <Button
                type="text"
                size={minimalMode ? 'small' : 'middle'}
                onClick={handleAddNode}
                icon={<PlusOutlined />}
                className={`flex items-center text-gray-600 hover:!text-green-600 hover:bg-gray-50 dark:hover:bg-gray-950 dark:text-gray-300 dark:hover:!text-green-300 ${
                  minimalMode ? 'text-xs' : ''
                }`}
              >
                {!minimalMode && t('common.addNode')}
              </Button>
            </Tooltip>
            <Tooltip title={t('common.shareLink')}>
              <Button
                type="text"
                size={minimalMode ? 'small' : 'middle'}
                onClick={handleShare}
                icon={<ShareAltOutlined />}
                className={`flex items-center text-gray-600 hover:!text-green-600 hover:bg-gray-50 dark:hover:bg-gray-950 dark:text-gray-300 dark:hover:!text-green-300 ${
                  minimalMode ? 'text-xs' : ''
                }`}
              >
                {!minimalMode && t('common.shareLink')}
              </Button>
            </Tooltip>
            {nodesList.length > 0 && (
              <Tooltip title={t('pages.share.slideshow')}>
                <Button
                  type="text"
                  size={minimalMode ? 'small' : 'middle'}
                  onClick={togglePreviewMode}
                  icon={<PlayCircleOutlined />}
                  className={`flex items-center text-gray-600 hover:!text-green-600 hover:bg-gray-50 dark:hover:bg-gray-950 dark:text-gray-300 dark:hover:!text-green-300 ${
                    minimalMode ? 'text-xs' : ''
                  }`}
                >
                  {!minimalMode && t('pages.share.slideshow')}
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      }
    >
      {/* Content module */}
      {renderPageContent}

      {/* Empty Content Modal */}
      <Modal
        title={
          <div className="flex items-center text-lg font-medium">
            <PlusOutlined className="mr-2 text-gray-900 dark:text-gray-200" />{' '}
            {t('common.addContent', 'Add Content')}
          </div>
        }
        open={emptyContentModalVisible}
        onCancel={handleCloseEmptyContentModal}
        footer={null}
        width={680}
        bodyStyle={{
          padding: 0,
          maxHeight: '75vh',
          overflow: 'hidden',
          borderRadius: '0 0 8px 8px',
        }}
        style={{ top: 20 }}
        className="empty-content-modal"
        maskClosable={true}
        centered={false}
        destroyOnClose={true}
        closeIcon={
          <CloseCircleOutlined className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
        }
      >
        <div className="flex flex-col" style={{ height: '75vh' }}>
          <EmptyContentPrompt
            canvasId={pageDetail?.canvasId}
            pageId={pageId}
            height="100%"
            excludeNodeIds={nodesList.map((node) => node.entityId).filter(Boolean) as string[]}
            onNodeAdded={() => {
              refetchPageDetail();
              handleCloseEmptyContentModal();
              message.success(t('common.contentAdded', 'Content added'));
            }}
          />
        </div>
      </Modal>

      {/* Share modal */}
      <Modal
        centered
        title={
          <div className="flex items-center text-lg font-medium">
            <ShareAltOutlined className="mr-2 text-green-500 dark:text-green-400" />{' '}
            {t('common.shareLink')}
          </div>
        }
        open={shareModalVisible}
        onCancel={handleCloseShareModal}
        footer={null}
        width={420}
        className="share-modal"
        maskClosable={false}
      >
        <div className="py-2">
          <div className="mb-4">
            <div className="text-gray-700 mb-2 dark:text-gray-200">{t('common.whoCanView')}</div>
            <Select
              value={shareOption}
              onChange={(value) => setShareOption(value)}
              style={{ width: '100%' }}
              options={[
                {
                  value: 'internet',
                  label: (
                    <div className="flex items-center">
                      <GlobalOutlined className="mr-2 text-green-500 dark:text-green-400" />
                      {t('common.internetUsers')}
                    </div>
                  ),
                },
                {
                  value: 'notEnabled',
                  label: (
                    <div className="flex items-center">
                      <UserOutlined className="mr-2 text-gray-500 dark:text-gray-400" />
                      {t('common.notEnabled')}
                    </div>
                  ),
                  disabled: true,
                },
              ]}
            />
          </div>

          {!shareUrl ? (
            <Button
              type="primary"
              block
              icon={<ShareAltOutlined />}
              onClick={handleShareSubmit}
              loading={isSharing}
              className="bg-green-600 hover:bg-green-700 border-none mt-2 dark:bg-green-500"
            >
              {t('common.copyShareLink')}
            </Button>
          ) : (
            <div className="mt-4">
              <div className="text-gray-700 mb-2 dark:text-gray-200">{t('common.shareUrl')}</div>
              <div className="flex items-center">
                <Input value={shareUrl} readOnly className="flex-1 bg-gray-50 dark:bg-gray-950" />
                <Button
                  type={isCopied ? 'primary' : 'default'}
                  icon={<CopyOutlined />}
                  onClick={handleCopyShareUrl}
                  className="ml-2 flex items-center justify-center h-[32px]"
                >
                  {isCopied ? t('common.copied') : t('common.copy.title')}
                </Button>
              </div>
              <div className="mt-4 text-gray-500 dark:text-gray-400 text-sm">
                {t('common.shareUrlDesc')}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Wide mode modal */}
      <Modal
        centered
        open={wideMode.isActive}
        footer={null}
        onCancel={handleCloseWideMode}
        width="85%"
        style={{ top: 20 }}
        bodyStyle={{
          maxHeight: 'calc(100vh - 100px)',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '8px',
        }}
        className="wide-mode-modal"
        maskStyle={{ background: 'rgba(0, 0, 0, 0.65)' }}
      >
        <div className="bg-white h-full w-full flex flex-col rounded-lg overflow-hidden dark:bg-gray-900">
          {/* Wide mode content */}
          <div className="flex-1 overflow-auto">
            {wideMode.nodeId && nodesList.find((n) => n.nodeId === wideMode.nodeId) ? (
              <div className="h-[calc(100vh-160px)]">
                <NodeRenderer
                  node={nodesList.find((n) => n.nodeId === wideMode.nodeId)!}
                  isFullscreen={false}
                  isModal={true}
                  isMinimap={false}
                  onDelete={handleDeleteNode}
                  onStartSlideshow={handleStartSlideshow}
                  onWideMode={handleWideMode}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 dark:bg-gray-400">{t('common.wideModeLoadFailed')}</p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}

function PageEdit() {
  const [showMinimap, setShowMinimap] = useState(true);
  const { pageId } = useParams<{ pageId: string }>();
  return (
    <SlideshowEdit
      pageId={pageId}
      showMinimap={showMinimap}
      setShowMinimap={setShowMinimap}
      source="page"
    />
  );
}

export default PageEdit;
