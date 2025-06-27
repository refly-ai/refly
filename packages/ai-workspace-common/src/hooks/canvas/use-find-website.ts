import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { CanvasNode, WebsiteNodeMeta } from '@refly/canvas-common';

/**
 * Hook to find website nodes in the canvas by resultId
 * Used to extract website information for context items
 */
export const useFindWebsite = () => {
  const { getNodes } = useReactFlow();

  return useCallback(
    ({ resultId, startNode }: { resultId?: string; startNode?: CanvasNode<WebsiteNodeMeta> }) => {
      if (!startNode && !resultId) return [];

      if (!startNode) {
        const nodes = getNodes();
        startNode = nodes.find(
          (node) => node.data?.entityId === resultId,
        ) as CanvasNode<WebsiteNodeMeta>;
      }

      if (!startNode || startNode.type !== 'website') return [];

      return [startNode];
    },
    [getNodes],
  );
};
