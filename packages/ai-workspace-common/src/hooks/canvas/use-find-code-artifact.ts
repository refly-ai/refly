import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';

export const useFindCodeArtifact = () => {
  const { getNodes } = useReactFlow();

  return useCallback(
    ({ resultId, startNode }: { resultId?: string; startNode?: CanvasNode }) => {
      if (!startNode && !resultId) return [];

      if (!startNode) {
        const nodes = getNodes();
        startNode = nodes.find((node) => node.data?.entityId === resultId) as CanvasNode;
      }

      if (!startNode || startNode.type !== 'codeArtifact') return [];

      return [startNode];
    },
    [getNodes],
  );
};
