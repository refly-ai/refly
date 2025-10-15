import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  CanvasNode,
  CanvasNodeData,
  CanvasNodeFilter,
  purgeContextItems,
} from '@refly/canvas-common';
import { IContextItem } from '@refly/common-types';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { deepmerge } from '@refly/utils';

export const useSetNodeDataByEntity = () => {
  const { getNodes, setNodes } = useReactFlow<CanvasNode<any>>();
  const { syncCanvasData } = useCanvasContext();

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
          data: n.id === node.id ? deepmerge(n.data, nodeData) : n.data,
        }));
        setNodes(updatedNodes);
        syncCanvasData();
      }
    },
    [setNodes, syncCanvasData],
  );
};
