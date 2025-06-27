import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';

export const useFindImages = () => {
  const { getNodes } = useReactFlow();

  return useCallback(
    ({ resultId, startNode }: { resultId?: string; startNode?: CanvasNode }) => {
      if (!startNode && !resultId) return [];

      if (!startNode) {
        const nodes = getNodes();
        startNode = nodes.find((node) => node.data?.entityId === resultId) as CanvasNode;
      }

      if (!startNode || startNode.type !== 'image') return [];

      // Extract the storageKey and other metadata
      const imageData = {
        storageKey: (startNode.data?.metadata?.storageKey as string) ?? '',
        title: startNode.data?.title ?? 'Image',
        entityId: startNode.data?.entityId ?? '',
        // Include any other relevant image metadata
        metadata: {
          ...(startNode.data?.metadata ?? {}),
          imageUrl: startNode.data?.metadata?.imageUrl ?? '',
          storageKey: startNode.data?.metadata?.storageKey ?? '',
        },
      };

      return [imageData];
    },
    [getNodes],
  );
};
