import { useCallback } from 'react';
import { useCanvasStoreShallow } from '../../stores/canvas';
import { CanvasNode } from '../../components/canvas/nodes';
import { addPinnedNodeEmitter } from '../../events/addPinnedNode';

interface UseNodePreviewControlOptions {
  canvasId: string;
}

export const useNodePreviewControl = ({ canvasId }: UseNodePreviewControlOptions) => {
  const { clickToPreview, setClickToPreview, addPinnedNode, removePinnedNode, pinnedNodes } = useCanvasStoreShallow(
    (state) => ({
      clickToPreview: state.clickToPreview,
      setClickToPreview: state.setClickToPreview,
      addPinnedNode: (canvasId: string, node: CanvasNode) => state.addPinnedNode(canvasId, node),
      removePinnedNode: (canvasId: string, nodeId: string) => state.removePinnedNode(canvasId, nodeId),
      pinnedNodes: state.config[canvasId]?.pinnedNodes || [],
    }),
  );

  /**
   * Toggle click-to-preview functionality
   */
  const toggleClickToPreview = useCallback(() => {
    setClickToPreview(!clickToPreview);
  }, [clickToPreview, setClickToPreview]);

  /**
   * Pin a node for preview
   */
  const pinNode = useCallback(
    (node: CanvasNode) => {
      addPinnedNode(canvasId, node);
      addPinnedNodeEmitter.emit('addPinnedNode', { id: node.id, canvasId });
    },
    [canvasId, addPinnedNode],
  );

  /**
   * Unpin a node from preview
   */
  const unpinNode = useCallback(
    (node: CanvasNode) => {
      removePinnedNode(canvasId, node.id);
    },
    [canvasId, removePinnedNode],
  );

  /**
   * Check if a node is pinned
   */
  const isNodePinned = useCallback(
    (nodeId: string) => {
      return pinnedNodes.some((node) => node.id === nodeId);
    },
    [pinnedNodes],
  );

  /**
   * Clear all pinned nodes
   */
  const clearPinnedNodes = useCallback(() => {
    pinnedNodes.forEach((node) => {
      removePinnedNode(canvasId, node.id);
    });
  }, [canvasId, pinnedNodes, removePinnedNode]);

  /**
   * Handle node click with preview logic
   */
  const handleNodePreview = useCallback(
    (node: CanvasNode) => {
      if (!clickToPreview) {
        return false;
      }
      pinNode(node);
      return true;
    },
    [clickToPreview, pinNode],
  );

  return {
    // State
    clickToPreview,
    pinnedNodes,

    // Actions
    toggleClickToPreview,
    pinNode,
    unpinNode,
    isNodePinned,
    clearPinnedNodes,
    handleNodePreview,
  };
};
