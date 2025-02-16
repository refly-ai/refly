import { useEffect } from 'react';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import {
  IContextItem,
  useContextPanelStore,
} from '@refly-packages/ai-workspace-common/stores/context-panel';

export const useSyncSelectedNodesToContext = () => {
  const { nodes } = useCanvasData();
  const selectedContextNodes = nodes.filter(
    (node) =>
      node.selected && ['resource', 'document', 'image', 'skillResponse'].includes(node.type),
  );

  const selectedEntityIds =
    selectedContextNodes?.map((node) => node.data?.entityId)?.filter(Boolean) ?? [];

  useEffect(() => {
    const { contextItems, setContextItems } = useContextPanelStore.getState();
    const contextEntityIds = new Set(contextItems.map((item) => item.entityId));

    const newContextItems: IContextItem[] = [
      ...contextItems.filter((item) => !item.isPreview),
      ...selectedContextNodes
        .filter((node) => !contextEntityIds.has(node.data?.entityId))
        .map((node) => ({
          entityId: node.data?.entityId,
          title: node.data?.title,
          type: node.type,
          isPreview: true,
          metadata: {
            ...node.data?.metadata,
            ...(node.type === 'skillResponse' && { withHistory: true }),
          },
        })),
    ];
    setContextItems(newContextItems);
  }, [JSON.stringify(selectedEntityIds)]);
};
