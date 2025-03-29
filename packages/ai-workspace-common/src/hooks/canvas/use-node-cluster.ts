import { useCallback } from 'react';
import { Node, useStoreApi } from '@xyflow/react';
import { useGroupNodes } from './use-batch-nodes-selection/use-group-nodes';
import { useNodePosition } from './use-node-position';
import { useNodeOperations } from './use-node-operations';

export const useNodeCluster = () => {
  const { getState } = useStoreApi();
  const { createGroupFromSelectedNodes } = useGroupNodes();
  const { layoutBranchAndUpdatePositions } = useNodePosition();
  const { updateNodesWithSync } = useNodeOperations();

  // Helper function to get all target nodes recursively
  const getTargetNodesCluster = useCallback((nodeIds: string | string[]): Node[] => {
    const { nodes, edges } = getState();
    const visited = new Set<string>();
    const cluster: Node[] = [];

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const node = nodes.find((n) => n.id === currentId);
      if (node) {
        cluster.push(node);
        // Find all target nodes
        for (const edge of edges) {
          if (edge.source === currentId) {
            traverse(edge.target);
          }
        }
      }
    };

    // Support both single nodeId and array of nodeIds
    const sourceNodeIds = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    for (const nodeId of sourceNodeIds) {
      traverse(nodeId);
    }

    return cluster;
  }, []);

  // Select all target nodes in the cluster
  const selectNodeCluster = useCallback(
    (nodeIds: string | string[]) => {
      const { nodes } = getState();
      const cluster = getTargetNodesCluster(nodeIds);

      const updatedNodes = nodes.map((node) => ({
        ...node,
        selected: cluster.some((n) => n.id === node.id),
      }));

      updateNodesWithSync(updatedNodes);
    },
    [getTargetNodesCluster, updateNodesWithSync],
  );

  // Create a group from the node cluster
  const groupNodeCluster = useCallback(
    (nodeIds: string | string[]) => {
      // First select all nodes in the cluster
      selectNodeCluster(nodeIds);
      // Then create a group from the selected nodes
      createGroupFromSelectedNodes();
    },
    [selectNodeCluster, createGroupFromSelectedNodes],
  );

  // Layout the node cluster
  const layoutNodeCluster = useCallback(
    (nodeIds: string | string[]) => {
      const { nodes, edges } = getState();

      const sourceNodeIds = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
      const sourceNodes = nodes.filter((node) => sourceNodeIds.includes(node.id));

      layoutBranchAndUpdatePositions(
        sourceNodes,
        nodes,
        edges,
        { fromRoot: true },
        {
          targetNodeId: sourceNodeIds[0],
          needSetCenter: false,
        },
      );
    },
    [layoutBranchAndUpdatePositions],
  );

  return {
    selectNodeCluster,
    groupNodeCluster,
    layoutNodeCluster,
  };
};
