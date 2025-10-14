import { useTranslation } from 'react-i18next';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { EndMessage } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';

import { CanvasNodeData, WorkflowNodeExecution } from '@refly/openapi-schema';
import { Empty, Modal } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';
import { NodeRenderer } from '@refly-packages/ai-workspace-common/components/slideshow/components/NodeRenderer';
import { type NodeRelation } from '@refly-packages/ai-workspace-common/components/slideshow/components/ArtifactRenderer';
import { safeParseJSON } from '@refly/utils/parse';

export const WorkflowAppProducts = ({ products }: { products: WorkflowNodeExecution[] }) => {
  const { t } = useTranslation();

  // State for fullscreen modal
  const [fullscreenNode, setFullscreenNode] = useState<NodeRelation | null>(null);

  // State for wide mode modal
  const [wideMode, setWideMode] = useState<{ isActive: boolean; nodeId: string | null }>({
    isActive: false,
    nodeId: null,
  });

  // Transform WorkflowNodeExecution to NodeRelation for NodeRenderer
  const transformWorkflowNodeToNodeRelation = (
    product: WorkflowNodeExecution,
    index: number,
  ): NodeRelation => {
    const nodeData = safeParseJSON(product!.nodeData)?.data as CanvasNodeData;

    return {
      relationId: product.nodeExecutionId || `workflow-${product.nodeId}-${index}`,
      pageId: undefined, // Optional field
      nodeId: product.nodeId,
      nodeType: product.nodeType || 'unknown',
      entityId: product.entityId || '',
      orderIndex: index,
      nodeData: nodeData,
    };
  };

  // Transform products to NodeRelation array with memoization
  const transformedNodes = useMemo(() => {
    return (
      products?.map((product, index) => transformWorkflowNodeToNodeRelation(product, index)) || []
    );
  }, [products]);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenNode(null);
  }, []);

  // Handle wide mode (onWideMode)
  const handleWideMode = useCallback(
    (nodeId: string) => {
      const node = transformedNodes.find((n) => n.nodeId === nodeId);
      if (node) {
        setWideMode({ isActive: true, nodeId });
      }
    },
    [transformedNodes],
  );

  const handleCloseWideMode = useCallback(() => {
    setWideMode({ isActive: false, nodeId: null });
  }, []);

  // Add Escape key to exit fullscreen mode
  useEffect(() => {
    if (!fullscreenNode) return;

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseFullscreen();
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [fullscreenNode, handleCloseFullscreen]);

  // Add Escape key to exit wide mode
  useEffect(() => {
    if (!wideMode.isActive) return;

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseWideMode();
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [wideMode.isActive, handleCloseWideMode]);

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {products?.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <Empty description={t('workflowApp.emptyLogs')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <>
          {transformedNodes?.map((node, index) => (
            <div
              key={node.relationId || `content-${index}`}
              id={`content-block-${index}`}
              className={`transition-all duration-300 h-[400px] rounded-lg bg-white dark:bg-gray-900 ${'shadow-refly-m hover:shadow-lg dark:hover:shadow-gray-600'}`}
            >
              <NodeRenderer
                node={node}
                key={node.relationId}
                isFocused={true} // Allow interaction with the content
                fromProducts={true}
                onWideMode={handleWideMode}
              />
            </div>
          ))}

          <EndMessage />
        </>
      )}

      {/* Fullscreen Modal */}
      <Modal
        open={!!fullscreenNode}
        footer={null}
        closable={false}
        onCancel={handleCloseFullscreen}
        width="100%"
        style={{ top: 0, padding: 0, maxWidth: '100vw' }}
        styles={{
          body: {
            height: '100vh',
            padding: 0,
            overflow: 'hidden',
          },
          mask: {
            background: 'rgba(0, 0, 0, 0.85)',
          },
        }}
        className="fullscreen-modal"
        wrapClassName="fullscreen-modal-wrap"
      >
        <div className="bg-black h-full w-full flex flex-col">
          {fullscreenNode && (
            <NodeRenderer
              node={fullscreenNode}
              isFullscreen={true}
              isModal={true}
              isFocused={true}
              fromProducts={true}
              onWideMode={handleWideMode}
            />
          )}
        </div>
      </Modal>

      {/* Wide Mode Modal */}
      {wideMode.isActive && (
        <Modal
          open={wideMode.isActive}
          footer={null}
          onCancel={handleCloseWideMode}
          width="85%"
          style={{ top: 20 }}
          styles={{
            body: {
              maxHeight: 'calc(100vh - 100px)',
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
          <div className="bg-white h-full w-full flex flex-col rounded-lg overflow-hidden dark:bg-gray-900">
            {/* Wide mode content */}
            <div className="flex-1 overflow-auto">
              {wideMode.nodeId && transformedNodes.find((n) => n.nodeId === wideMode.nodeId) ? (
                <div className="h-[calc(100vh-160px)]">
                  <NodeRenderer
                    node={transformedNodes.find((n) => n.nodeId === wideMode.nodeId)!}
                    isFullscreen={false}
                    isModal={true}
                    isMinimap={false}
                    isFocused={true}
                    onWideMode={handleWideMode}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 dark:text-gray-400">
                    {t('common.wideModeLoadFailed')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
