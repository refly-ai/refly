import { useCallback } from 'react';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import {
  useCanvasStore,
  useCanvasStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasNodeType } from '@refly/openapi-schema';
import { editorEmitter } from '@refly-packages/utils/event-emitter/editor';

export const useUpdateNodeTitle = () => {
  const { canvasId } = useCanvasContext();
  const { updateNodePreview } = useCanvasStoreShallow((state) => ({
    updateNodePreview: state.updateNodePreview,
  }));

  const setNodeDataByEntity = useSetNodeDataByEntity();

  const handleTitleUpdate = useCallback(
    (newTitle: string, entityId: string, nodeId: string, nodeType: CanvasNodeType) => {
      const latestNodePreviews = useCanvasStore.getState().config[canvasId]?.nodePreviews || [];
      const preview = latestNodePreviews.find((p) => p?.id === nodeId);

      if (preview) {
        updateNodePreview(canvasId, {
          ...preview,
          data: {
            ...preview.data,
            title: newTitle,
          },
        });
      }

      setNodeDataByEntity(
        {
          entityId: entityId,
          type: nodeType,
        },
        {
          title: newTitle,
        },
      );

      if (nodeType === 'document') {
        editorEmitter.emit('syncDocumentTitle', { docId: entityId, title: newTitle });
      }
    },
    [setNodeDataByEntity, updateNodePreview, canvasId],
  );

  return handleTitleUpdate;
};
