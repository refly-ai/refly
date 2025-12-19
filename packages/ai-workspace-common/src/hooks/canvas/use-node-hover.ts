import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

export const useNodeHoverEffect = (nodeId: string) => {
  const { setNodes, getNodes } = useReactFlow();

  const updateNodeAndEdges = useCallback(
    (isHovered: boolean, selected?: boolean) => {
      const zIndex = isHovered ? 1001 : selected ? 1000 : 1;
      setNodes((nodes) => {
        return nodes.map((node) => {
          if (node.id === nodeId && node.type !== 'memo') {
            return { ...node, style: { ...node.style, zIndex } };
          }
          return node;
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
