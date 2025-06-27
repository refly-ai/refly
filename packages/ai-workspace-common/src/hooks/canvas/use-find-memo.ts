import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { MemoNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';

export const useFindMemo = () => {
  const { getNodes } = useReactFlow();

  return useCallback(
    ({ resultId, startNode }: { resultId?: string; startNode?: CanvasNode<typeof MemoNode> }) => {
      if (!startNode && !resultId) return [];

      if (!startNode) {
        const nodes = getNodes();
        startNode = nodes.find((node) => node.data?.entityId === resultId) as CanvasNode<
          typeof MemoNode
        >;
      }

      if (!startNode || startNode.type !== 'memo') return [];

      return [startNode];
    },
    [getNodes],
  );
};
