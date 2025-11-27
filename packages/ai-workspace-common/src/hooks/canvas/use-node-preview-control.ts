import { useCallback, useEffect } from 'react';
import { useCanvasStoreShallow } from '@refly/stores';
import { CanvasNode } from '@refly/canvas-common';
import { useReactFlow } from '@xyflow/react';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';

interface UseNodePreviewControlOptions {
  canvasId: string;
}

interface NodePreviewControl {
  nodePreviewId: string | null;
  previewNode: (node: CanvasNode | null) => void;
  closeNodePreview: (node: CanvasNode) => void;
  handleNodePreview: (node: CanvasNode | null) => void;
}

export const useNodePreviewControl = ({
  canvasId,
}: UseNodePreviewControlOptions): NodePreviewControl => {
  const { getNodes } = useReactFlow();
  const { setSelectedNode } = useNodeSelection();
  const { setNodePreview, nodePreviewId, canvasInitialized } = useCanvasStoreShallow((state) => ({
    setNodePreview: state.setNodePreview,
    nodePreviewId: state.config[canvasId]?.nodePreviewId,
    canvasInitialized: state.canvasInitialized[canvasId],
  }));

  // Cleanup non-existent node previews
  useEffect(() => {
    if (!nodePreviewId) return;
    if (!canvasInitialized) return;

    setTimeout(() => {
      const nodes = getNodes();
      const canvasNodeIds = new Set(nodes.map((node) => node.id));
      if (!canvasNodeIds.has(nodePreviewId)) {
        setNodePreview(canvasId, null);
      }
    }, 1000);
  }, [canvasId, canvasInitialized, nodePreviewId, setNodePreview]);

  const previewNode = useCallback(
    (node: CanvasNode | null) => {
      setNodePreview(canvasId, node);
      setSelectedNode(node);
    },
    [canvasId, setNodePreview, setSelectedNode],
  );

  const closeNodePreview = useCallback(() => {
    setNodePreview(canvasId, null);
  }, [canvasId, setNodePreview]);

  /**
   * Handle node click with preview logic
   */
  const handleNodePreview = useCallback(
    (node: CanvasNode | null) => {
      setNodePreview(canvasId, node);
      setSelectedNode(node);
    },
    [canvasId, setNodePreview, setSelectedNode],
  );

  return {
    // State
    nodePreviewId,
    previewNode,
    closeNodePreview,
    handleNodePreview,
  };
};
