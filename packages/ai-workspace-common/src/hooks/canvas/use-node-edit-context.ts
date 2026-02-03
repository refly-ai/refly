import { useEffect, useRef } from 'react';
import { useStore, useReactFlow } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { CanvasNode, SkillNodeMeta } from '@refly/canvas-common';
import { useCopilotStoreShallow, NodeEditContext } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

/**
 * Hook to sync selected node with copilot store's nodeEditContext.
 * When a single skillResponse node is selected, it extracts the node's
 * context (taskId, current state, graph connections) and stores it
 * for use by the copilot agent in targeted editing operations.
 */
export const useNodeEditContext = () => {
  const { canvasId } = useCanvasContext();
  const { getNodes, getEdges } = useReactFlow<CanvasNode<SkillNodeMeta>>();

  const { setNodeEditContext } = useCopilotStoreShallow((state) => ({
    setNodeEditContext: state.setNodeEditContext,
  }));

  // Use ReactFlow's internal store to watch for selection changes
  const selectedNodes = useStore(
    useShallow((state) => state.nodes.filter((node) => node.selected)),
  );

  // Track previous context key to avoid unnecessary updates
  // Using ref to avoid triggering re-renders and potential infinite loops
  const prevContextKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Only handle single node selection
    if (selectedNodes.length !== 1) {
      // Clear context if no single selection
      if (prevContextKeyRef.current !== null) {
        setNodeEditContext(canvasId, null);
        prevContextKeyRef.current = null;
      }
      return;
    }

    const selectedNode = selectedNodes[0] as CanvasNode<SkillNodeMeta>;

    // Only handle skillResponse nodes for targeted editing
    if (selectedNode.type !== 'skillResponse') {
      if (prevContextKeyRef.current !== null) {
        setNodeEditContext(canvasId, null);
        prevContextKeyRef.current = null;
      }
      return;
    }

    const metadata = selectedNode.data?.metadata;
    const taskId = metadata?.taskId;

    // Build a stable key to detect meaningful changes
    // Only include fields that affect the context
    const toolsetIds =
      metadata?.selectedToolsets
        ?.map((t) => t.id)
        ?.sort()
        ?.join(',') ?? '';
    const contextKey = `${selectedNode.id}|${taskId ?? ''}|${metadata?.query ?? ''}|${toolsetIds}|${selectedNode.data?.title ?? ''}`;

    // Skip if context hasn't actually changed
    if (prevContextKeyRef.current === contextKey) {
      return;
    }
    prevContextKeyRef.current = contextKey;

    // If no taskId, the node wasn't created from a workflow plan
    // and cannot be targeted for incremental editing
    if (!taskId) {
      setNodeEditContext(canvasId, null);
      return;
    }

    // Get all nodes and edges to find graph context
    const allNodes = getNodes();
    const edges = getEdges();

    // Find upstream nodes (nodes that connect TO this node)
    const upstreamTaskIds = edges
      .filter((edge) => edge.target === selectedNode.id)
      .map((edge) => {
        const sourceNode = allNodes.find((n) => n.id === edge.source) as
          | CanvasNode<SkillNodeMeta>
          | undefined;
        return sourceNode?.data?.metadata?.taskId;
      })
      .filter((id): id is string => Boolean(id));

    // Find downstream nodes (nodes that this node connects TO)
    const downstreamTaskIds = edges
      .filter((edge) => edge.source === selectedNode.id)
      .map((edge) => {
        const targetNode = allNodes.find((n) => n.id === edge.target) as
          | CanvasNode<SkillNodeMeta>
          | undefined;
        return targetNode?.data?.metadata?.taskId;
      })
      .filter((id): id is string => Boolean(id));

    // Build the node edit context
    const context: NodeEditContext = {
      nodeId: selectedNode.id,
      entityId: selectedNode.data?.entityId ?? '',
      taskId,
      nodeType: selectedNode.type as NodeEditContext['nodeType'],
      currentState: {
        query: metadata?.query,
        toolsets: metadata?.selectedToolsets?.map((t) => t.id),
        title: selectedNode.data?.title,
      },
      graphContext: {
        upstreamTaskIds,
        downstreamTaskIds,
      },
      editMode: 'modify', // Default to modify mode
    };

    setNodeEditContext(canvasId, context);
  }, [selectedNodes, canvasId, getNodes, getEdges, setNodeEditContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setNodeEditContext(canvasId, null);
    };
  }, [canvasId, setNodeEditContext]);
};
