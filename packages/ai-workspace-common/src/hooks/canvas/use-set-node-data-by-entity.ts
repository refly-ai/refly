import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { CanvasNode, CanvasNodeData } from '../../components/canvas/nodes';
import { useCanvasSync } from './use-canvas-sync';
import { purgeContextItems } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { CanvasNodeFilter } from './use-node-selection';

export const useSetNodeDataByEntity = () => {
  const { getNodes, setNodes } = useReactFlow<CanvasNode<any>>();
  const { syncNodesToYDoc } = useCanvasSync();

  return useCallback(
    (filter: CanvasNodeFilter, nodeData: Partial<CanvasNodeData>) => {
      // Purge context items if they exist
      if (Array.isArray(nodeData.metadata?.contextItems)) {
        nodeData.metadata.contextItems = purgeContextItems(
          nodeData.metadata.contextItems as IContextItem[],
        );
      }

      const currentNodes = getNodes();
      const node = currentNodes.find(
        (n) => n.type === filter.type && n.data?.entityId === filter.entityId,
      );

      if (node) {
        const updatedNodes = currentNodes.map((n) => ({
          ...n,
          data:
            n.id === node.id
              ? { ...n.data, ...nodeData, metadata: { ...n.data.metadata, ...nodeData.metadata } }
              : n.data,
        }));
        setNodes(updatedNodes);
        syncNodesToYDoc(updatedNodes);
      }
    },
    [setNodes, syncNodesToYDoc],
  );
};
