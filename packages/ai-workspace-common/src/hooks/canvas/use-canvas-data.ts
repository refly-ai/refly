import { useReactFlow } from '@xyflow/react';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';

export const useCanvasData = () => {
  const { getNodes, getEdges } = useReactFlow<CanvasNode<any>>();

  return {
    nodes: getNodes(),
    edges: getEdges(),
  };
};
