import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useCanvasContext } from '../../context/canvas';
import { useCanvasStore, useCanvasStoreShallow } from '../../stores/canvas';
import { CanvasNodeData } from '../../components/canvas/nodes';
import { useCanvasSync } from './use-canvas-sync';
import { purgeContextItems } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { CanvasNodeFilter } from './use-node-selection';

export const useSetNodeDataByEntity = () => {
  const { canvasId: contextCanvasId } = useCanvasContext();
  const { canvasId: routeCanvasId } = useParams();
  const { setNodes } = useCanvasStoreShallow((state) => ({
    setNodes: state.setNodes,
  }));

  const { syncNodesToYDoc } = useCanvasSync();

  return useCallback(
    (filter: CanvasNodeFilter, nodeData: Partial<CanvasNodeData>, selectedCanvasId?: string) => {
      // Purge context items if they exist
      if (Array.isArray(nodeData.metadata?.contextItems)) {
        nodeData.metadata.contextItems = purgeContextItems(
          nodeData.metadata.contextItems as IContextItem[],
        );
      }

      const { data } = useCanvasStore.getState();
      const canvasId = selectedCanvasId ?? contextCanvasId ?? routeCanvasId;
      const currentNodes = data[canvasId]?.nodes ?? [];
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
        setNodes(canvasId, updatedNodes);
        syncNodesToYDoc(updatedNodes);
      }
    },
    [contextCanvasId, routeCanvasId, setNodes, syncNodesToYDoc],
  );
};
