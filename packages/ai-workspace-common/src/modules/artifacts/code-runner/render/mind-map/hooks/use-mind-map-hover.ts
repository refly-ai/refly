import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

export const useMindMapHoverEffect = (nodeId: string) => {
  const { setNodes, setEdges } = useReactFlow();

  const updateNodeAndEdges = useCallback(
    (isHovered: boolean) => {
      // Batch update both nodes and edges in a single React state update
      const newZIndex = isHovered ? 1000 : 0;
      const newEdgeStyle = isHovered
        ? { stroke: '#3e63dd', strokeWidth: 2 }
        : { stroke: '#94a3b8', strokeWidth: 1.5 };

      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            return { ...node, zIndex: newZIndex };
          }
          return node;
        }),
      );

      setEdges((eds) =>
        eds.map((edge) =>
          edge.source === nodeId || edge.target === nodeId
            ? { ...edge, style: newEdgeStyle }
            : edge,
        ),
      );
    },
    [nodeId, setEdges, setNodes],
  );

  const handleMouseEnter = useCallback(() => {
    updateNodeAndEdges(true);
  }, [updateNodeAndEdges]);

  const handleMouseLeave = useCallback(() => {
    updateNodeAndEdges(false);
  }, [updateNodeAndEdges]);

  return {
    handleMouseEnter,
    handleMouseLeave,
  };
};
