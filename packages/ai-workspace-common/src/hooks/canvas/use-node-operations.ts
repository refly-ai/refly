import { useCallback, useState } from 'react';
import { applyNodeChanges, NodeChange, useStoreApi } from '@xyflow/react';
import { useCanvasStoreShallow, useContextPanelStoreShallow } from '@refly/stores';
import { useCanvasId } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-id';
import { useUploadMinimap } from '@refly-packages/ai-workspace-common/hooks/use-upload-minimap';
import { truncateContent, MAX_CONTENT_PREVIEW_LENGTH } from '../../utils/content';
import { getHelperLines } from '../../components/canvas/common/helper-line/util';
import { CanvasNode } from '@refly/canvas-common';
import { adoptUserNodes } from '@xyflow/system';
import { deletedNodesEmitter } from '@refly-packages/ai-workspace-common/events/deleted-nodes';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

// Add snap threshold constant
const SNAP_THRESHOLD = 10;

export const useNodeOperations = () => {
  const canvasId = useCanvasId();
  const { setState, getState } = useStoreApi<CanvasNode<any>>();
  const { removeNodePreview } = useCanvasStoreShallow((state) => ({
    removeNodePreview: state.removeNodePreview,
  }));
  const { removeContextItem } = useContextPanelStoreShallow((state) => ({
    removeContextItem: state.removeContextItem,
  }));
  const { debouncedHandleUpdateCanvasMiniMap } = useUploadMinimap(canvasId);
  const { syncCanvasData } = useCanvasContext();

  // Add helper line states
  const [helperLineHorizontal, setHelperLineHorizontal] = useState<number | undefined>(undefined);
  const [helperLineVertical, setHelperLineVertical] = useState<number | undefined>(undefined);
  const [lastSnapPosition, setLastSnapPosition] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // Custom apply node changes function for snap alignment
  const customApplyNodeChanges = useCallback(
    (changes: NodeChange[], nodes: any[]) => {
      // Reset helper lines
      setHelperLineHorizontal(undefined);
      setHelperLineVertical(undefined);

      // Check if it's a single node being dragged
      if (
        changes.length === 1 &&
        changes[0]?.type === 'position' &&
        changes[0]?.dragging &&
        changes[0]?.position
      ) {
        // Calculate helper lines and snap position
        const helperLines = getHelperLines(changes[0], nodes, SNAP_THRESHOLD);

        // Update changes with snap position if available
        const updatedChanges = changes.map((change) => {
          if (change.type === 'position' && change.position) {
            const newPosition = {
              x: helperLines.snapPosition.x ?? change.position.x,
              y: helperLines.snapPosition.y ?? change.position.y,
            };

            // Store last snap position for this node
            setLastSnapPosition((prev) => ({
              ...prev,
              [change.id]: newPosition,
            }));

            return {
              ...change,
              position: newPosition,
            };
          }
          return change;
        });

        // Set helper lines for display
        setHelperLineHorizontal(helperLines.horizontal);
        setHelperLineVertical(helperLines.vertical);

        return applyNodeChanges(updatedChanges, nodes);
      }

      return applyNodeChanges(changes, nodes);
    },
    [setHelperLineHorizontal, setHelperLineVertical, setLastSnapPosition],
  );

  const updateNodesWithSync = useCallback(
    (nodes: any[]) => {
      const { nodeLookup, parentLookup } = getState();
      const cleanedNodes = nodes.filter((node) => !!node);
      adoptUserNodes(cleanedNodes, nodeLookup, parentLookup, {
        elevateNodesOnSelect: false,
      });
      setState({ nodes: cleanedNodes });
      syncCanvasData();
    },
    [syncCanvasData],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<any>[]) => {
      const { nodes } = getState();
      const mutableNodes = nodes.map((node) => ({
        ...node,
        measured: node.measured ? { ...node.measured } : undefined,
      }));

      // Handle deleted nodes - filter out start type nodes to prevent deletion
      const deletedNodes = changes.filter((change) => change.type === 'remove');

      if (deletedNodes.length > 0) {
        // Filter out start type nodes from deletion changes
        const filteredChanges = changes.filter((change) => {
          if (change.type === 'remove') {
            const nodeToDelete = nodes.find((node) => node.id === change.id);
            // Prevent deletion of start type nodes
            if (nodeToDelete?.type === 'start') {
              return false;
            }
          }
          return true;
        });

        // Use filtered changes if any start nodes were filtered out
        const changesToApply =
          filteredChanges.length !== changes.length ? filteredChanges : changes;

        // Process remaining deleted nodes
        for (const change of deletedNodes) {
          if (change.type !== 'remove') continue;
          const nodeId = change.id;

          // Find the node that's being deleted to get its entityId
          const deletedNode = nodes.find((node) => node.id === nodeId);
          if (deletedNode?.data?.entityId) {
            // Emit event for deleted node to track it for preventing recreation
            deletedNodesEmitter.emit('nodeDeleted', deletedNode.data.entityId);
          }

          // Remove from context items and node previews
          removeContextItem(nodeId);
          removeNodePreview(canvasId, nodeId);
        }

        // Check if this is a position change for snap alignment
        const isPositionChange =
          changesToApply.length === 1 &&
          changesToApply[0]?.type === 'position' &&
          changesToApply[0]?.position;

        // Apply changes with or without helper lines based on change type
        const updatedNodes = isPositionChange
          ? customApplyNodeChanges(changesToApply, mutableNodes)
          : applyNodeChanges(changesToApply, mutableNodes);

        updateNodesWithSync(updatedNodes);
        debouncedHandleUpdateCanvasMiniMap();

        return updatedNodes;
      }

      // Check if this is a position change for snap alignment
      const isPositionChange =
        changes.length === 1 && changes[0]?.type === 'position' && changes[0]?.position;

      // Apply changes with or without helper lines based on change type
      const updatedNodes = isPositionChange
        ? customApplyNodeChanges(changes, mutableNodes)
        : applyNodeChanges(changes, mutableNodes);

      updateNodesWithSync(updatedNodes);
      debouncedHandleUpdateCanvasMiniMap();

      return updatedNodes;
    },
    [
      canvasId,
      updateNodesWithSync,
      removeContextItem,
      removeNodePreview,
      customApplyNodeChanges,
      debouncedHandleUpdateCanvasMiniMap,
      // Use deletedNodesEmitter event emitter to track deleted nodes
    ],
  );

  // Clear helper lines and apply final position
  const onNodeDragStop = useCallback(
    (nodeId: string) => {
      // Apply the last snap position if it exists
      if (lastSnapPosition[nodeId]) {
        const { nodes } = getState();
        const updatedNodes = nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              position: lastSnapPosition[nodeId],
            };
          }
          return node;
        });

        updateNodesWithSync(updatedNodes);

        // Clear the snap position for this node
        setLastSnapPosition((prev) => {
          const newState = { ...prev };
          delete newState[nodeId];
          return newState;
        });
      }

      // Clear helper lines
      setHelperLineHorizontal(undefined);
      setHelperLineVertical(undefined);
    },
    [canvasId, lastSnapPosition, updateNodesWithSync],
  );

  // New function to truncate content for skill-response nodes only
  const truncateAllNodesContent = useCallback(() => {
    const { nodes } = getState();

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
      const { nodes } = getState();

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
      const { nodes } = getState();

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
    onNodeDragStop,
    // Export helper line states for use in components
    helperLineHorizontal,
    helperLineVertical,
    // Reset helper lines method
    resetHelperLines: () => {
      setHelperLineHorizontal(undefined);
      setHelperLineVertical(undefined);
    },
  };
};
