import { useCallback } from 'react';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import {
  useCanvasStore,
  useCanvasStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasNodeType } from '@refly/openapi-schema';

export const useUpdateNodeTitle = () => {
  const { canvasId } = useCanvasContext();
  const { updateNodePreview } = useCanvasStoreShallow((state) => ({
    updateNodePreview: state.updateNodePreview,
  }));

  const setNodeDataByEntity = useSetNodeDataByEntity();

  const handleTitleUpdate = useCallback(
    (newTitle: string, entityId: string, nodeId: string, nodeType: CanvasNodeType) => {
      // 1. 更新节点数据
      setNodeDataByEntity(
        {
          entityId: entityId,
          type: nodeType,
        },
        {
          title: newTitle,
        },
      );

      // 2. 从 store 获取最新的 nodePreviews 状态
      const latestNodePreviews = useCanvasStore.getState().config[canvasId]?.nodePreviews || [];
      const preview = latestNodePreviews.find((p) => p?.id === nodeId);

      // 3. 更新预览节点的标题
      if (preview) {
        updateNodePreview(canvasId, {
          ...preview,
          data: {
            ...preview.data,
            title: newTitle,
          },
        });
      }
    },
    [setNodeDataByEntity, updateNodePreview, canvasId],
  );

  return handleTitleUpdate;
};
