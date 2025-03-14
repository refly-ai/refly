import { useCallback } from 'react';
import { applyNodeChanges, NodeChange } from '@xyflow/react';
import { useCanvasStore, useCanvasStoreShallow } from '../../stores/canvas';
import { useCanvasSync } from './use-canvas-sync';
import { useContextPanelStoreShallow } from '../../stores/context-panel';
import { useCanvasId } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-id';
import { useUploadMinimap } from '@refly-packages/ai-workspace-common/hooks/use-upload-minimap';
import { truncateContent, MAX_CONTENT_PREVIEW_LENGTH } from '../../utils/content';

export const useNodeOperations = () => {
  const canvasId = useCanvasId();
  const { setNodes, removeNodePreview } = useCanvasStoreShallow((state) => ({
    setNodes: state.setNodes,
    removeNodePreview: state.removeNodePreview,
  }));
  const { removeContextItem } = useContextPanelStoreShallow((state) => ({
    removeContextItem: state.removeContextItem,
  }));
  const { debouncedHandleUpdateCanvasMiniMap } = useUploadMinimap(canvasId);
  const { throttledSyncNodesToYDoc } = useCanvasSync();

  const updateNodesWithSync = useCallback(
    (updatedNodes: any[]) => {
      setNodes(canvasId, updatedNodes);
      throttledSyncNodesToYDoc(updatedNodes);
    },
    [canvasId, setNodes, throttledSyncNodesToYDoc],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<any>[]) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];

      const mutableNodes = nodes.map((node) => ({
        ...node,
        measured: node.measured ? { ...node.measured } : undefined,
      }));

      // Handle deleted nodes
      const deletedNodes = changes.filter((change) => change.type === 'remove');

      if (deletedNodes.length > 0) {
        for (const change of deletedNodes) {
          const nodeId = change.id;
          // Remove from context items and node previews
          removeContextItem(nodeId);
          removeNodePreview(canvasId, nodeId);
        }
      }

      const updatedNodes = applyNodeChanges(changes, mutableNodes);
      updateNodesWithSync(updatedNodes);
      debouncedHandleUpdateCanvasMiniMap();

      return updatedNodes;
    },
    [canvasId, updateNodesWithSync],
  );

  // New function to truncate content for skill-response nodes only
  const truncateAllNodesContent = useCallback(() => {
    const { data } = useCanvasStore.getState();
    const nodes = data[canvasId]?.nodes ?? [];

    // Filter only skill-response nodes that need truncation
    const skillResponseNodes = nodes.filter(
      (node) =>
        node.type === 'skillResponse' &&
        ((node.data?.contentPreview &&
          node.data.contentPreview.length > MAX_CONTENT_PREVIEW_LENGTH) ||
          (node.data?.metadata?.reasoningContent &&
            node.data.metadata.reasoningContent.length > MAX_CONTENT_PREVIEW_LENGTH)),
    );

    if (skillResponseNodes.length === 0) return; // Skip if no updates needed

    const updatedNodes = nodes.map((node) => {
      // Only process skill-response nodes with content
      if (
        node.type === 'skillResponse' &&
        (node.data?.contentPreview || node.data?.metadata?.reasoningContent)
      ) {
        const newNode = { ...node };
        newNode.data = { ...node.data };

        // Truncate main content preview if it exists
        if (newNode.data.contentPreview) {
          newNode.data.contentPreview = truncateContent(newNode.data.contentPreview);
        }

        // Truncate reasoning content if it exists
        if (newNode.data.metadata?.reasoningContent) {
          newNode.data.metadata = { ...newNode.data.metadata };
          newNode.data.metadata.reasoningContent = truncateContent(
            newNode.data.metadata.reasoningContent,
          );
        }

        return newNode;
      }
      return node;
    });

    updateNodesWithSync(updatedNodes);
  }, [canvasId, updateNodesWithSync]);

  const setNodeSizeMode = useCallback(
    (nodeId: string, mode: 'compact' | 'adaptive') => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];

      const updatedNodes = nodes.map((node) => {
        if (node.id === nodeId) {
          const newNode = { ...node };
          newNode.data = { ...node.data };
          newNode.data.metadata = { ...(node?.data?.metadata || {}) };

          // Store original width if switching to compact mode
          if (mode === 'compact') {
            newNode.data.metadata.originalWidth =
              newNode.measured?.width || Number.parseInt(newNode.style?.width as string) || 288;

            newNode.style = {
              ...newNode.style,
              width: '288px',
              height: 'auto',
              maxHeight: '384px',
            };
          } else {
            // For adaptive mode, use originalWidth or default width
            const width = newNode.data.metadata.originalWidth || 288;
            newNode.style = {
              ...newNode.style,
              width: `${width}px`,
              height: 'auto',
              maxHeight: undefined,
            };
          }

          newNode.data.metadata.sizeMode = mode;

          return newNode;
        }
        return node;
      });

      updateNodesWithSync(updatedNodes);
    },
    [canvasId, updateNodesWithSync],
  );

  const updateAllNodesSizeMode = useCallback(
    (mode: 'compact' | 'adaptive') => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];

      const updatedNodes = nodes.map((node) => {
        if (node.data.metadata?.sizeMode === mode) {
          return node;
        }

        const newNode = { ...node };
        newNode.data = { ...node.data };
        newNode.data.metadata = { ...(node?.data?.metadata || {}) };

        if (mode === 'compact') {
          newNode.data.metadata.originalWidth =
            newNode.measured?.width || Number.parseInt(newNode.style?.width as string) || 288;

          newNode.style = {
            ...newNode.style,
            width: '288px',
            height: 'auto',
            maxHeight: '384px',
          };
        } else {
          const width = newNode.data.metadata.originalWidth || 288;
          newNode.style = {
            ...newNode.style,
            width: `${width}px`,
            height: 'auto',
            maxHeight: undefined,
          };
        }

        newNode.data.metadata.sizeMode = mode;
        return newNode;
      });

      updateNodesWithSync(updatedNodes);
    },
    [canvasId, updateNodesWithSync],
  );

  return {
    onNodesChange,
    updateNodesWithSync,
    setNodeSizeMode,
    updateAllNodesSizeMode,
    truncateAllNodesContent,
  };
};
