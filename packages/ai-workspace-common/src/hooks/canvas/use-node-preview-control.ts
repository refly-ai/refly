import { useCallback, useEffect } from 'react';
import { useCanvasStore, useCanvasStoreShallow } from '../../stores/canvas';
import { CanvasNode } from '../../components/canvas/nodes';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { useReactFlow } from '@xyflow/react';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';

interface UseNodePreviewControlOptions {
  canvasId: string;
}

interface NodePreviewControl {
  clickToPreview: boolean;
  nodePreviews: CanvasNode[];
  toggleClickToPreview: () => void;
  previewNode: (node: CanvasNode) => void;
  closeNodePreview: (node: CanvasNode) => void;
  closeNodePreviewByEntityId: (entityId: string) => void;
  pinNode: (node: CanvasNode) => void;
  unpinNode: (node: CanvasNode) => void;
  isNodePinned: (nodeId: string) => boolean;
  clearPinnedNodes: () => void;
  handleNodePreview: (node: CanvasNode) => boolean;
}

export const useNodePreviewControl = ({
  canvasId,
}: UseNodePreviewControlOptions): NodePreviewControl => {
  const { getNodes } = useReactFlow();
  const { provider } = useCanvasContext();
  const { setSelectedNode } = useNodeSelection();
  const {
    clickToPreview,
    setClickToPreview,
    addNodePreview,
    setNodePreview,
    removeNodePreview,
    nodePreviews,
  } = useCanvasStoreShallow((state) => ({
    clickToPreview: state.clickToPreview,
    setClickToPreview: state.setClickToPreview,
    addNodePreview: state.addNodePreview,
    setNodePreview: state.setNodePreview,
    removeNodePreview: state.removeNodePreview,
    nodePreviews: state.config[canvasId]?.nodePreviews || [],
  }));

  // Cleanup non-existent node previews
  useEffect(() => {
    if (!nodePreviews?.length) return;
    if (provider?.status !== 'connected') return;

    setTimeout(() => {
      const nodes = getNodes();
      const canvasNodeIds = new Set(nodes.map((node) => node.id));
      for (const preview of nodePreviews) {
        if (!canvasNodeIds.has(preview.id)) {
          removeNodePreview(canvasId, preview.id);
        }
      }
    }, 1000);
  }, [canvasId, provider, nodePreviews, removeNodePreview]);

  /**
   * Toggle click-to-preview functionality
   */
  const toggleClickToPreview = useCallback(() => {
    setClickToPreview(!clickToPreview);
  }, [clickToPreview, setClickToPreview]);

  /**
   * Pin a node for preview
   */
  const previewNode = useCallback(
    (node: CanvasNode) => {
      addNodePreview(canvasId, node);
      setSelectedNode(node);
    },
    [canvasId, addNodePreview, setSelectedNode],
  );

  const closeNodePreview = useCallback(
    (node: CanvasNode) => {
      removeNodePreview(canvasId, node.id);
    },
    [canvasId, removeNodePreview],
  );

  const closeNodePreviewByEntityId = useCallback(
    (entityId: string) => {
      const node = nodePreviews.find((node) => node.data?.entityId === entityId);
      if (node) {
        removeNodePreview(canvasId, node.id);
      }
    },
    [canvasId, nodePreviews, removeNodePreview],
  );

  const pinNode = useCallback(
    (node: CanvasNode) => {
      setNodePreview(canvasId, { ...node, isPinned: true });
    },
    [canvasId, setNodePreview],
  );

  /**
   * Unpin a node from preview
   */
  const unpinNode = useCallback(
    (node: CanvasNode) => {
      setNodePreview(canvasId, { ...node, isPinned: false });
    },
    [canvasId, setNodePreview],
  );

  /**
   * Check if a node is pinned
   */
  const isNodePinned = useCallback(
    (nodeId: string) => {
      const { config } = useCanvasStore.getState();
      const nodePreviews = config[canvasId]?.nodePreviews || [];
      return nodePreviews.some((n) => n.id === nodeId && n.isPinned);
    },
    [canvasId],
  );

  /**
   * Clear all pinned nodes
   */
  const clearPinnedNodes = useCallback(() => {
    for (const node of nodePreviews) {
      removeNodePreview(canvasId, node.id);
    }
  }, [canvasId, nodePreviews, removeNodePreview]);

  /**
   * Handle node click with preview logic
   */
  const handleNodePreview = useCallback(
    (node: CanvasNode) => {
      if (!clickToPreview) {
        return false;
      }
      addNodePreview(canvasId, node);
      setSelectedNode(node);
      locateToNodePreviewEmitter.emit('locateToNodePreview', { canvasId, id: node.id });
      return true;
    },
    [canvasId, clickToPreview, addNodePreview, setSelectedNode],
  );

  return {
    // State
    clickToPreview,
    nodePreviews,

    // Actions
    toggleClickToPreview,
    previewNode,
    closeNodePreview,
    closeNodePreviewByEntityId,
    pinNode,
    unpinNode,
    isNodePinned,
    clearPinnedNodes,
    handleNodePreview,
  };
};
