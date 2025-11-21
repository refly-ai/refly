import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Node } from '@xyflow/react';
const ZINDEX_ON_GROUP = 2;

export const useNodeHoverEffect = (nodeId: string) => {
  const { setNodes, getNodes } = useReactFlow();

  const updateNodeAndEdges = useCallback(
    (isHovered: boolean, selected?: boolean) => {
      const isGroupNode = getNodes().find((node) => node.id === nodeId)?.type === 'group';

      setNodes((nodes) => {
        // First pass - determine if this is a group node
        return nodes.map((node) => {
          if (node.id === nodeId) {
            const parent = nodes.find((n) => n.id === node.parentId);
            const parentSelected = parent?.selected;
            // For the target node itself
            if (isGroupNode) {
              return { ...node, style: { ...node.style, zIndex: selected ? 1 : -1 } };
            }

            return {
              ...node,
              style: {
                ...node.style,
                zIndex: node.selected ? 1000 : isHovered ? 1001 : parentSelected ? 2 : 0,
              },
            };
          }

          // For child nodes of the group
          if (node.parentId === nodeId) {
            if (selected) {
              return { ...node, style: { ...node.style, zIndex: ZINDEX_ON_GROUP } };
            }
            return { ...node, style: { ...node.style, zIndex: node.selected ? 1000 : 0 } };
          }

          const getIrrelevantNodeIndex = (node: Node) => {
            if (!node.parentId) {
              if (node.selected) {
                return node.type === 'group' ? 1 : 1000;
              }
              return node.type === 'group' ? -1 : 0;
            }
            const parent = nodes.find((n) => n.id === node.parentId);
            return parent?.selected ? 2 : 0;
          };

          return {
            ...node,
            style: {
              ...node.style,
              zIndex: getIrrelevantNodeIndex(node),
            },
          };
        });
      });
    },
    [nodeId, setNodes, getNodes],
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
