import { useCallback, useEffect } from 'react';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useAddNode } from './use-add-node';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/types';
import { CodeArtifactNodeMeta } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/types';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-preview-control';
import { CanvasNodeType } from '@refly-packages/ai-workspace-common/requests';
import { useReactFlow } from '@xyflow/react';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';

export const useListenNodeOperationEvents = () => {
  const { readonly, canvasId } = useCanvasContext();
  const { addNode } = useAddNode();
  const { getNodes, getEdges } = useReactFlow();

  // Only use canvas store if in interactive mode and not readonly
  const { previewNode } = useNodePreviewControl({ canvasId });

  const jumpToDescendantNode = useCallback(
    (entityId: string, descendantNodeType: CanvasNodeType, shouldPreview?: boolean) => {
      const nodes = getNodes() as CanvasNode[];
      const thisNode = nodes.find((node) => node.data?.entityId === entityId);

      if (!thisNode) return [false, null];

      // Find the descendant nodes that are code artifacts and pick the latest one
      const edges = getEdges();
      const descendantNodeIds = edges
        .filter((edge) => edge.source === thisNode.id)
        .map((edge) => edge.target);
      const descendantNodes = nodes
        .filter((node) => descendantNodeIds.includes(node.id))
        .filter((node) => node.type === descendantNodeType)
        .sort(
          (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime(),
        );
      const artifactNode: CanvasNode<CodeArtifactNodeMeta> | null = descendantNodes[0];
      let nodeIdForEvent: string | undefined; // Track the node ID to use in the locate event

      if (artifactNode && shouldPreview) {
        // Use the existing node's information for the preview
        nodeIdForEvent = artifactNode.id;
        previewNode(artifactNode as unknown as CanvasNode);
      }

      if (nodeIdForEvent) {
        // Emit the locate event with the correct node ID
        locateToNodePreviewEmitter.emit('locateToNodePreview', { canvasId, id: nodeIdForEvent });
      }
    },
    [getNodes, getEdges, previewNode, canvasId],
  );

  useEffect(() => {
    const handleAddNode = ({ node, connectTo, shouldPreview, needSetCenter, positionCallback }) => {
      if (readonly) return;

      // Add the node and get the calculated position
      const position = addNode(node, connectTo, shouldPreview, needSetCenter);

      // If a position callback was provided and we have a position, call it
      if (positionCallback && typeof positionCallback === 'function' && position) {
        positionCallback(position);
      }
    };

    const handleJumpToNode = ({ entityId, descendantNodeType, shouldPreview }) => {
      if (readonly) return;
      jumpToDescendantNode(entityId, descendantNodeType, shouldPreview);
    };

    nodeOperationsEmitter.on('addNode', handleAddNode);
    nodeOperationsEmitter.on('jumpToDescendantNode', handleJumpToNode);

    return () => {
      nodeOperationsEmitter.off('addNode', handleAddNode);
      nodeOperationsEmitter.off('jumpToDescendantNode', handleJumpToNode);
    };
  }, [addNode, readonly]);
};
