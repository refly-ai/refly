import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

const ZINDEX_ON_GROUP = 1001;

export const useNodeHoverEffect = (nodeId: string) => {
  const { setEdges, setNodes, getNodes } = useReactFlow();

  const updateNodeAndEdges = useCallback(
    (isHovered: boolean, selected?: boolean) => {
      // Batch update both nodes and edges in a single React state update
      const newZIndex = isHovered ? 1001 : 0;

      const isGroupNode = getNodes().find((node) => node.id === nodeId)?.type === 'group';

      setNodes((nodes) => {
        // First pass - determine if this is a group node
        return nodes.map((node) => {
          if (node.id === nodeId) {
            // For the target node itself
            if (isGroupNode) {
              return { ...node, zIndex: selected ? 1000 : -1 };
            }

            return { ...node, zIndex: newZIndex };
          }

          // For child nodes of the group
          if (isGroupNode && selected && node.parentId === nodeId) {
            return { ...node, zIndex: ZINDEX_ON_GROUP };
          }

          // Reset other nodes when they're not part of the current operation
          if (!isHovered && !selected && node.parentId === nodeId) {
            return { ...node, zIndex: 0 };
          }

          return node;
        });
      });

      setEdges((eds) => {
        return eds.map((edge) => {
          // Handle edges connected to the node
          if (edge.source === nodeId || edge.target === nodeId) {
            return {
              ...edge,
              data: { ...edge.data, hover: isHovered },
            };
          }

          // Handle edges between nodes in the same group when group is selected
          if (isGroupNode && selected) {
            const sourceNode = getNodes().find((node) => node.id === edge.source);
            const targetNode = getNodes().find((node) => node.id === edge.target);

            if (sourceNode?.parentId === nodeId && targetNode?.parentId === nodeId) {
              return { ...edge, zIndex: ZINDEX_ON_GROUP };
            }
          }

          // Reset edge hover state for other edges
          return { ...edge, data: { ...edge.data, hover: false } };
        });
      });
    },
    [nodeId, setEdges, setNodes, getNodes],
  );

  const handleMouseEnter = useCallback(
    (selected?: boolean) => {
      updateNodeAndEdges(true, selected);
    },
    [updateNodeAndEdges],
  );

  const handleMouseLeave = useCallback(
    (selected?: boolean) => {
      updateNodeAndEdges(false, selected);
    },
    [updateNodeAndEdges],
  );

  return {
    handleMouseEnter,
    handleMouseLeave,
  };
};
