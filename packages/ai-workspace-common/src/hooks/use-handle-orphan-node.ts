import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo } from 'react';
import { CanvasEdge } from '@refly/openapi-schema';
import { genUniqueId } from '@refly/utils/id';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';

export const useHandleOrphanNode = () => {
  const { setEdges } = useReactFlow();

  const { nodes, edges } = useCanvasData();

  // Find the start node
  const startNode = useMemo(() => {
    return nodes?.find((node) => node.type === 'start');
  }, [nodes]);

  // Check if a node has upstream connections (excluding start node)
  const hasUpstreamConnections = useCallback(
    (nodeId: string) => {
      if (!edges?.length) return false;

      return edges.some((edge) => {
        // Check if this edge targets the node and source is not start
        if (edge.target === nodeId) {
          const sourceNode = nodes?.find((node) => node.id === edge.source);
          return sourceNode && sourceNode.type !== 'start';
        }
        return false;
      });
    },
    [edges, nodes],
  );

  // Get all edges connected to start node
  const getStartNodeEdges = useCallback(() => {
    if (!startNode || !edges?.length) return [];

    return edges.filter((edge) => edge.source === startNode.id || edge.target === startNode.id);
  }, [startNode, edges]);

  // Add connection from start node to target node
  const connectToStart = useCallback(
    (targetNodeId: string) => {
      if (!startNode || !setEdges) return;

      const newEdge: CanvasEdge = {
        id: `edge-${genUniqueId()}`,
        source: startNode.id,
        target: targetNodeId,
        type: 'default',
      };

      setEdges([...(edges ?? []), newEdge]);
    },
    [startNode, setEdges, edges],
  );

  // Remove connection from start node to target node
  const disconnectFromStart = useCallback(
    (targetNodeId: string) => {
      if (!startNode || !setEdges) return;

      const updatedEdges = (edges ?? []).filter(
        (edge) => !(edge.source === startNode.id && edge.target === targetNodeId),
      );
      setEdges(updatedEdges);
    },
    [startNode, setEdges, edges],
  );

  // Main effect to handle orphan nodes
  useEffect(() => {
    if (!startNode || !nodes?.length || !setEdges) return;

    // Process each non-start node
    for (const node of nodes) {
      if (node.type === 'start') continue;
      if (node.type === 'memo') {
        disconnectFromStart(node.id);
        continue;
      }

      const hasUpstream = hasUpstreamConnections(node.id);
      const hasStartConnection = edges?.some(
        (edge) => edge.source === startNode.id && edge.target === node.id,
      );

      if (!hasUpstream && !hasStartConnection) {
        // Node has no upstream connections and no start connection - connect to start
        connectToStart(node.id);
      } else if (hasUpstream && hasStartConnection) {
        // Node has upstream connections and start connection - remove start connection
        disconnectFromStart(node.id);
      }
    }
  }, [
    nodes?.length,
    edges?.length,
    startNode,
    hasUpstreamConnections,
    connectToStart,
    disconnectFromStart,
    setEdges,
  ]);

  return {
    startNode,
    hasUpstreamConnections,
    getStartNodeEdges,
    connectToStart,
    disconnectFromStart,
  };
};
