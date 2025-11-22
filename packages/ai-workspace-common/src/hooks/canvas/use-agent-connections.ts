import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { genUniqueId } from '@refly/utils/id';
import { useEdgeStyles } from '@refly-packages/ai-workspace-common/components/canvas/constants';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';

export const useAgentConnections = () => {
  const edgeStyles = useEdgeStyles();
  const { getNodes, getEdges, addEdges, deleteElements } = useReactFlow();

  const getUpstreamAgentNodes = useCallback(
    (sourceNodeId: string) => {
      const edges = getEdges();
      const nodes = getNodes();
      return edges
        .filter((edge) => edge.target === sourceNodeId)
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .filter((node) => node?.type === 'skillResponse') as CanvasNode<ResponseNodeMeta>[];
    },
    [getEdges, getNodes],
  );

  const connectToUpstreamAgent = useCallback(
    (nodeId: string, upstreamEntityId: string) => {
      const nodes = getNodes();
      const edges = getEdges();
      const upstreamNode = nodes.find((node) => node.data?.entityId === upstreamEntityId);
      if (!upstreamNode) {
        return;
      }
      const upstreamNodeId = upstreamNode?.id ?? '';
      if (!upstreamNodeId) {
        return;
      }

      // Check if connection already exists
      const existingEdge = edges.find(
        (edge) => edge.source === upstreamNodeId && edge.target === nodeId,
      );
      if (existingEdge) {
        return;
      }

      const newEdge = {
        source: upstreamNodeId,
        target: nodeId,
        id: `edge-${genUniqueId()}`,
        animated: false,
        style: edgeStyles.default,
      };
      addEdges([newEdge]);
    },
    [getNodes, getEdges, addEdges, edgeStyles],
  );

  const disconnectFromUpstreamAgent = useCallback(
    (nodeId: string, upstreamEntityId: string) => {
      const nodes = getNodes();
      const edges = getEdges();
      const upstreamNode = nodes.find((node) => node.data?.entityId === upstreamEntityId);
      if (!upstreamNode) {
        return;
      }
      const upstreamNodeId = upstreamNode?.id ?? '';
      if (!upstreamNodeId) {
        return;
      }
      const edge = edges.find((edge) => edge.source === upstreamNodeId && edge.target === nodeId);
      if (!edge) {
        return;
      }
      deleteElements({ edges: [edge] });
    },
    [getNodes, getEdges, deleteElements],
  );

  return {
    getUpstreamAgentNodes,
    connectToUpstreamAgent,
    disconnectFromUpstreamAgent,
  };
};
