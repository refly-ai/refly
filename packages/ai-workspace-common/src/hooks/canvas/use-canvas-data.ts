import { useReactFlow } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';

export const useCanvasData = () => {
  const { getNodes, getEdges } = useReactFlow<CanvasNode<any>>();

  return {
    nodes: getNodes(),
    edges: getEdges(),
  };
};
