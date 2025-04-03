import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  CanvasNode,
  ResponseNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';

export const useFindThreadHistory = () => {
  const { getNode, getNodes, getEdges } = useReactFlow();

  return useCallback(
    ({ resultId, startNode }: { resultId?: string; startNode?: CanvasNode<ResponseNodeMeta> }) => {
      if (!startNode && !resultId) return [];

      if (!startNode) {
        const nodes = getNodes();
        startNode = nodes.find(
          (node) => node.data?.entityId === resultId,
        ) as CanvasNode<ResponseNodeMeta>;
      }

      if (!startNode || startNode.type !== 'skillResponse') return [];

      const edges = getEdges();

      console.log('startNode', startNode);

      // Create a more detailed mapping for debugging
      const allConnections = edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        sourceNode: getNode(edge.source),
        targetNode: getNode(edge.target),
      }));

      console.log('All connections:', allConnections);

      // Create two maps to handle bidirectional traversal if needed
      const targetToSourceMap = new Map();
      const sourceToTargetsMap = new Map();

      for (const edge of edges) {
        // Map target -> source for backward traversal (support multiple incoming connections)
        if (!targetToSourceMap.has(edge.target)) {
          targetToSourceMap.set(edge.target, []);
        }
        targetToSourceMap.get(edge.target).push(edge.source);

        // Map source -> targets for forward traversal if needed
        if (!sourceToTargetsMap.has(edge.source)) {
          sourceToTargetsMap.set(edge.source, []);
        }
        sourceToTargetsMap.get(edge.source).push(edge.target);
      }

      // For debugging
      console.log('Target to Source Map:', [...targetToSourceMap.entries()]);

      const history = [startNode];
      const visited = new Set<string>();

      // Helper function to recursively find source nodes
      const findSourceNodes = (nodeId: string) => {
        // Prevent infinite loops in case of circular dependencies
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const sourceIds = targetToSourceMap.get(nodeId) || [];
        for (const sourceId of sourceIds) {
          const sourceNode = getNode(sourceId);
          console.log('Exploring source node:', sourceId, sourceNode?.type);

          if (sourceNode?.type === 'skillResponse') {
            // Only add if not already in history
            if (!history.some((node) => node.id === sourceNode.id)) {
              history.push(sourceNode as CanvasNode<ResponseNodeMeta>);
            }
            // Continue traversing up the chain
            findSourceNodes(sourceId);
          }
        }
      };

      // Start the recursive search from the start node
      findSourceNodes(startNode.id);

      console.log(
        'Found history nodes:',
        history.map((node) => ({
          id: node.id,
          type: node.type,
          entityId: node.data?.entityId,
        })),
      );

      // Return nodes in reverse order (oldest to newest)
      return history.reverse();
    },
    [getNode, getNodes, getEdges],
  );
};
