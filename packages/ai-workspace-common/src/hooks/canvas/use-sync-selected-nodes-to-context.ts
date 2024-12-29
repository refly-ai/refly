import { useEffect } from 'react';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { NodeItem } from '@refly-packages/ai-workspace-common/stores/context-panel';

export const useSyncSelectedNodesToContext = (
  contextItems: NodeItem[],
  setContextItems: (items: NodeItem[]) => void,
) => {
  const { nodes } = useCanvasData();
  const selectedContextNodes = nodes.filter(
    (node) => node.selected && ['resource', 'document', 'memo', 'skillResponse'].includes(node.type),
  );

  const selectedNodeIds = selectedContextNodes?.map((node) => node.id) ?? [];

  useEffect(() => {
    const newContextItems = [
      ...contextItems.filter((item) => !item.isPreview),
      ...selectedContextNodes
        .filter((node) => !contextItems.some((item) => item.id === node.id))
        .map((node) => ({ ...node, isPreview: true })),
    ];
    setContextItems(newContextItems);
  }, [JSON.stringify(selectedNodeIds), setContextItems]);
};
