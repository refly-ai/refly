import { useCallback } from 'react';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useCanvasStore, useCanvasStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useDebouncedCallback } from 'use-debounce';

export const useUpdateNodeQuery = () => {
  const { canvasId } = useCanvasContext();
  const { updateNodePreview } = useCanvasStoreShallow((state) => ({
    updateNodePreview: state.updateNodePreview,
  }));

  const setNodeDataByEntity = useSetNodeDataByEntity();

  // Debounced update function to prevent excessive API calls
  const debouncedUpdateNodeData = useDebouncedCallback(
    (entityId: string, nodeType: CanvasNodeType, newQuery: string) => {
      setNodeDataByEntity(
        {
          entityId: entityId,
          type: nodeType,
        },
        {
          metadata: {
            structuredData: {
              query: newQuery,
            },
          },
        },
      );
    },
    500, // 500ms debounce delay
  );

  const handleQueryUpdate = useCallback(
    (newQuery: string, entityId: string, nodeId: string, nodeType: CanvasNodeType) => {
      // Update local node preview immediately for responsive UI
      const latestNodePreviews = useCanvasStore.getState().config[canvasId]?.nodePreviews || [];
      const preview = latestNodePreviews.find((p) => p?.id === nodeId);

      if (preview) {
        updateNodePreview(canvasId, {
          ...preview,
          data: {
            ...preview.data,
            metadata: {
              ...preview.data.metadata,
              structuredData: {
                ...preview.data.metadata?.structuredData,
                query: newQuery,
              },
            },
          },
        });
      }

      // Debounced update to backend to prevent excessive API calls
      debouncedUpdateNodeData(entityId, nodeType, newQuery);
    },
    [setNodeDataByEntity, updateNodePreview, canvasId, debouncedUpdateNodeData],
  );

  return handleQueryUpdate;
};
