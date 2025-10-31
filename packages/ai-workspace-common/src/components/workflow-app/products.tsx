import { useTranslation } from 'react-i18next';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';

import { CanvasNodeData, WorkflowNodeExecution } from '@refly/openapi-schema';
import { Empty, Modal } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';
import { NodeRenderer } from '@refly-packages/ai-workspace-common/components/slideshow/components/NodeRenderer';
import { type NodeRelation } from '@refly-packages/ai-workspace-common/components/slideshow/components/ArtifactRenderer';
import { safeParseJSON } from '@refly/utils/parse';

export const WorkflowAppProducts = ({ products }: { products: WorkflowNodeExecution[] }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [itemsPerRow, setItemsPerRow] = useState<number>(2);

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

  // Calculate items per row based on container width
  useEffect(() => {
    if (containerRef.current) {
      const calculateItemsPerRow = () => {
        const containerWidth = containerRef.current?.offsetWidth ?? 0;
        const gap = 16; // gap-4 = 16px
        // Assume minimum item width is approximately half of container for 2-column layout
        // Use a threshold to determine when to switch to 1 column
        // If container can fit 2 items with gap: 2 * minWidth + gap
        const minItemWidthForTwo = 300; // Minimum width for each item in 2-column layout

        if (containerWidth >= 2 * minItemWidthForTwo + gap) {
          setItemsPerRow(2);
        } else {
          setItemsPerRow(1);
        }
      };

      // Initial calculation
      calculateItemsPerRow();

      // Use ResizeObserver to watch for container size changes
      const resizeObserver = new ResizeObserver(() => {
        calculateItemsPerRow();
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {products?.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <Empty description={t('workflowApp.emptyLogs')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div className={`grid gap-4 ${itemsPerRow === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {transformedNodes?.map((node, index) => (
            <div
              key={node.relationId || `content-${index}`}
              id={`content-block-${index}`}
              className="transition-all duration-300 h-[248px] overflow-hidden dark:bg-gray-900"
              style={{
                borderRadius: '12px',
                border: '1px solid #0E9F77',
                background: 'var(--fill---refly-fill-StaticWhite, #FFF)',
                boxShadow: '0 2px 20px 4px rgba(0, 0, 0, 0.04)',
              }}
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
        </div>
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
